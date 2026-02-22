import { useState, useEffect, useRef } from "react";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import apiRequest from "../../lib/apiRequest";
import "./chatbotPage.scss";

function ChatbotPage() {
  const { currentUser } = useContext(AuthContext);

  // State Management
  const [documents, setDocuments] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Effects
  useEffect(() => {
    if (currentUser) {
      loadDocuments();
      loadChatSessions();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeSession?.id) {
      loadMessages(activeSession.id);
    } else {
      setMessages([]);
      setIsLoading(false); // Reset loading state when no active session
    }
  }, [activeSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset loading state after a timeout to prevent stuck states
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn("Loading state timeout - resetting");
        setIsLoading(false);
      }, 30000); // 30 second timeout
      
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Keyboard shortcut to reset loading state (Escape key)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isLoading) {
        resetLoadingState();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLoading]);

  // Data Fetching
  const loadDocuments = async () => {
    try {
      const res = await apiRequest.get("/rag/documents");
      setDocuments(res.data);
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  };

  const loadChatSessions = async () => {
    try {
      const res = await apiRequest.get("/rag/chat/sessions");
      setChatSessions(res.data);
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    }
  };

  const loadMessages = async (sessionId) => {
    setIsLoading(true);
    try {
      const res = await apiRequest.get(`/rag/chat/sessions/${sessionId}`);
      const sessionData = res.data;
      
      // Set messages first
      setMessages(sessionData.messages || []);
      
      // Update active session only if it's different
      if (activeSession?.id !== sessionId) {
        setActiveSession(sessionData);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      alert("Failed to load messages. Please try again.");
    } finally {
      // Always reset loading state
      setIsLoading(false);
    }
  };

  // Document Handling
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e, overwriteDocId = null) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file only.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("document", file);

    try {
      let res;
      if (overwriteDocId) {
        // This requires a new PUT endpoint on your backend
        res = await apiRequest.put(`/rag/documents/${overwriteDocId}/overwrite`, formData);
        // Update the document in the list if needed
        setDocuments(docs => docs.map(d => d.id === overwriteDocId ? res.data.document : d));
      } else {
        res = await apiRequest.post("/rag/upload", formData);
        setDocuments((prev) => [res.data.document, ...prev]);
      }
      
      // Automatically start a new chat with the new document
      await startNewChatWithDocument(res.data.document.id, file.name);
      setIsNewChatModalOpen(false);

    } catch (error) {
      if (error.response?.status === 409) {
        if (window.confirm(`'${file.name}' already exists. Do you want to overwrite it?`)) {
          const existingDocId = error.response.data.existingDocumentId;
          await handleFileUpload(e, existingDocId);
        }
      } else {
        console.error("Error uploading document:", error);
        alert("Failed to upload document.");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deleteDocument = async (docId, e) => {
    e.stopPropagation();
    console.log("Delete document clicked:", docId); // ADD THIS
    
    if (!window.confirm("Are you sure you want to delete this document and all associated chats?")) {
      console.log("Delete cancelled by user"); // ADD THIS
      return;
    }
  
    console.log("Attempting to delete document:", docId); // ADD THIS
    try {
      await apiRequest.delete(`/rag/documents/${docId}`);
      console.log("Document deleted successfully"); // ADD THIS
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      loadChatSessions();
      if(activeSession?.documentId === docId){
        setActiveSession(null);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      console.error("Error details:", error.response); // ADD THIS
      alert("Failed to delete document: " + (error.response?.data?.message || error.message));
    }
  };

  // Chat Session Handling
  const startNewChatWithDocument = async (documentId, title) => {
    try {
      const res = await apiRequest.post("/rag/chat/sessions", {
        title: `Chat about ${title}`,
        documentId: documentId,
      });
      setChatSessions((prev) => [res.data, ...prev]);
      setActiveSession(res.data);
      setIsNewChatModalOpen(false);
    } catch (error) {
      console.error("Error creating new chat session:", error);
      alert("Failed to start new chat.");
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    console.log("Delete session clicked:", sessionId); // ADD THIS
    
    if (!window.confirm("Are you sure you want to delete this chat?")) {
      console.log("Delete cancelled by user"); // ADD THIS
      return;
    }
  
    console.log("Attempting to delete session:", sessionId); // ADD THIS
    try {
      await apiRequest.delete(`/rag/chat/sessions/${sessionId}`);
      console.log("Session deleted successfully"); // ADD THIS
      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      console.error("Error details:", error.response); // ADD THIS
      alert("Failed to delete session: " + (error.response?.data?.message || error.message));
    }
  };

  // Message Handling
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeSession) return;

    const userMessage = { role: "user", content: newMessage, id: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setIsLoading(true);

    try {
      const res = await apiRequest.post(`/rag/chat/sessions/${activeSession.id}/messages`, {
        message: newMessage,
      });
      setMessages((prev) => [...prev, res.data.assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errMessage = { role: "assistant", content: "Sorry, I ran into an error. Please try again.", id: Date.now() };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Emergency reset function for stuck loading states
  const resetLoadingState = () => {
    setIsLoading(false);
    console.log("Loading state manually reset");
  };

  return (
    <div className="chatbotPage">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebarContent">
          {/* New Chat Button */}
          <button className="newChatButton" onClick={() => setIsNewChatModalOpen(true)}>
            <span className="plusIcon">+</span>
            {!sidebarCollapsed && "New Chat"}
          </button>

          {/* Chat History Section */}
          <div className="sidebarSection">
            <div className="sectionLabel">{!sidebarCollapsed && "Chat History"}</div>
            <div className="scrollableList">
              {chatSessions.map((session) => (
                <div
                  key={session.id}
                  className={`listItem ${activeSession?.id === session.id ? "active" : ""}`}
                  onClick={() => setActiveSession(session)}
                >
                  <span className="listItemText" title={session.title}>
                    {sidebarCollapsed ? session.title.charAt(0).toUpperCase() : session.title}
                  </span>
                  <button 
                    className="deleteIcon" 
                    onClick={(e) => deleteSession(session.id, e)}
                    title="Delete chat"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="sidebarSection">
            <div className="sectionLabel">{!sidebarCollapsed && "Documents"}</div>
            
            {/* Upload Area */}
            <div className="uploadArea" onClick={handleFileSelect}>
              <span className="uploadIcon">📄</span>
              {!sidebarCollapsed && (
                <div>
                  <span className="uploadText">Upload PDF</span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".pdf" 
                    style={{ display: 'none' }} 
                  />
                </div>
              )}
            </div>

            {/* Documents List */}
            <div className="scrollableList">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`listItem document ${activeSession?.documentId === doc.id ? "active" : ""}`}
                  onClick={() => startNewChatWithDocument(doc.id, doc.originalName)}
                >
                  <span className="listItemText" title={doc.originalName}>
                    {sidebarCollapsed ? "📄" : doc.originalName}
                  </span>
                  <button 
                    className="deleteIcon" 
                    onClick={(e) => deleteDocument(doc.id, e)}
                    title="Delete document"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main">
        {/* Top Bar */}
        <div className="topBar">
          <button 
            className="sidebarToggle" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <span className="hamburger"></span>
            <span className="hamburger"></span>
            <span className="hamburger"></span>
          </button>
          <h1 className="pageTitle">Legal Assistant</h1>
          <div className="topBarSpacer"></div>
        </div>

        {/* Session Info */}
        {activeSession && (
          <div className="sessionInfo">
            <div className="sessionTitle">{activeSession.title}</div>
            {activeSession.document && (
              <div className="documentTag">
                📄 {activeSession.document.originalName}
              </div>
            )}
          </div>
        )}

        {/* Messages Container */}
        <div className="messagesContainer">
          {activeSession ? (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="messageContent">
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message assistant">
                  <div className="typingIndicator" onClick={resetLoadingState} style={{ cursor: 'pointer' }} title="Click to reset if stuck">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="emptyState">
              <div className="emptyIcon">💬</div>
              <h2>Start a Conversation</h2>
              <p>Click "New Chat" to begin discussing your legal documents.</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Section */}
        <div className="inputSection">
          <form className="inputContainer" onSubmit={sendMessage}>
            <div className="inputWrapper">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={activeSession ? "Ask about the document..." : "Please select a chat to begin"}
                disabled={isLoading || !activeSession}
                className="messageInput"
              />
              <button 
                type="submit" 
                disabled={isLoading || !newMessage.trim() || !activeSession}
                className="sendButton"
              >
                <span className="sendIcon">→</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="modalOverlay">
          <div className="modal">
            <div className="modalHeader">
              <h2>Start a New Chat</h2>
              <button 
                className="closeModalButton" 
                onClick={() => setIsNewChatModalOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modalContent">
              <p>Upload a new document or select an existing one to start a conversation.</p>
              
              <div className="uploadSection">
                <button 
                  className="uploadButton" 
                  onClick={handleFileSelect} 
                  disabled={uploading}
                >
                  <span className="uploadIcon">📄</span>
                  {uploading ? "Uploading..." : "Upload New Document"}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf" 
                  style={{ display: 'none' }} 
                />
              </div>

              <div className="divider">
                <span>OR</span>
              </div>

              <div className="existingDocsSection">
                <h3>Existing Documents</h3>
                <div className="existingDocsList">
                  {documents.length > 0 ? documents.map(doc => (
                    <div key={doc.id} className="docItem">
                      <div className="docInfo">
                        <span className="docIcon">📄</span>
                        <span className="docName">{doc.originalName}</span>
                      </div>
                      <div className="docActions">
                        <button 
                          className="newChatBtn"
                          onClick={() => startNewChatWithDocument(doc.id, doc.originalName)}
                        >
                          New Chat
                        </button>
                        <button 
                          className="deleteIcon" 
                          onClick={(e) => deleteDocument(doc.id, e)}
                          title="Delete document"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="noDocs">
                      <p>No documents uploaded yet.</p>
                      <p>Upload a document to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatbotPage;