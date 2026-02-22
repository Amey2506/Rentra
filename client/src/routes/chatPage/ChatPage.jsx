import React, { useContext, useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext";
import { SocketContext } from '../../context/SocketContext'; 
import "./chatPage.scss";

function ChatPage({ onMessageSent }) { 
  const { id: chatId } = useParams();
  const { currentUser } = useContext(AuthContext);
  const { socket, joinChat } = useContext(SocketContext) || {};
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // -------------------------------------------------------------------
  // HANDLER FUNCTIONS (MOVED TO TOP FOR STRUCTURAL CORRECTNESS)
  // -------------------------------------------------------------------

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    const messageText = newMessage;
    setNewMessage("");

    // 1. CREATE TEMPORARY OPTIMISTIC MESSAGE
    const tempId = Date.now();
    const optimisticMessage = {
      id: tempId,
      text: messageText,
      userId: currentUser.id,
      createdAt: new Date().toISOString(),
      isOptimistic: true 
    };

    // 2. Optimistic UI update: APPEND the temporary message immediately
    setChat(prev => ({ 
      ...prev, 
      messages: [...(prev?.messages || []), optimisticMessage] 
    }));

    try {
      // 3. API CONFIRMATION
      const res = await apiRequest.post(`/messages/${chatId}`, { text: messageText });
      const confirmedMessage = res.data;
      
      // 4. CRITICAL FIX: REPLACE optimistic message with real one from API response
      setChat(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === tempId ? confirmedMessage : msg
        )
      }));

      // Notify parent component after confirmed success
      if (onMessageSent) onMessageSent(chatId, confirmedMessage.text); 
    } catch (err) {
      console.error("Failed to send message:", err);
      
      // 5. Remove optimistic message on error
      setChat(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== tempId)
      }));
      
      alert("Error sending message. Please try again.");
      setNewMessage(messageText); 
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete all messages? This action cannot be undone.")) return;
    try {
      await apiRequest.delete(`/messages/all/${chatId}`);
      setChat(prev => ({ ...prev, messages: [] }));
    } catch (err) {
      console.error("Error deleting messages:", err);
      alert("Failed to delete messages.");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await apiRequest.delete(`/messages/${messageId}`);
      setChat(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== messageId)
      }));
    } catch (err) {
      console.error("Error deleting message:", err);
      alert("Failed to delete message.");
    }
  };

  // -------------------------------------------------------------------
  // END HANDLER FUNCTIONS
  // -------------------------------------------------------------------

  // Fetch chat when chatId changes
  useEffect(() => {
    setChat(null);
    setLoading(true);
    setError(null);
    let isMounted = true;

    const fetchChat = async () => {
      try {
        const res = await apiRequest.get(`/chats/${chatId}`);
        if (isMounted) {
          setChat(res.data);
          // ensure scroll to bottom after messages render
          setTimeout(() => scrollToBottom("auto"), 100);
        }
      } catch (err) {
        console.error("Failed to fetch chat:", err);
        if (isMounted) setError("Could not load chat. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (chatId) fetchChat();

    return () => { isMounted = false; };
  }, [chatId]);

  // Join socket room for this chat (ensures server emits reach this client)
  useEffect(() => {
    if (!socket || !chatId) return;

    // Use helper if provided or emit directly
    if (typeof joinChat === "function") {
      joinChat(String(chatId));
    } else {
      socket.emit("join_chat", String(chatId));
    }

    return () => {
      // optional leave if server handles leave; otherwise leaving room when socket disconnects is fine
      try { socket.emit("leave_chat", String(chatId)); } catch (e) { /* ignore */ }
    };
  }, [socket, chatId, joinChat]);

  // Listen for incoming messages (server emits "receive_message")
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (message) => {
      // ensure the message belongs to this chat
      if (!message) return;
      // some servers send chatId in message or message.chatId field, fallback to chatId param
      const incomingChatId = message.chatId || message.chat?.id || chatId;
      if (String(incomingChatId) !== String(chatId)) return;

      setChat(prev => {
        if (!prev) return prev;
        // remove optimistic messages (if any) and append real one
        const existingMessages = (prev.messages || []).filter(m => !m.isOptimistic);
        return {
          ...prev,
          messages: [...existingMessages, message]
        };
      });

      // notify parent/list pages if needed
      if (onMessageSent) onMessageSent(message.chatId || chatId, message.text);
    };

    socket.on("receive_message", handleReceive);

    return () => {
      socket.off("receive_message", handleReceive);
    };
  }, [socket, chatId, onMessageSent]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chat?.messages?.length > 0 && !showScrollButton) {
      scrollToBottom();
    }
  }, [chat?.messages, showScrollButton]);

  
  if (loading) {
    return (
      <div className="chatPage">
        <div className="loadingSpinner">
          <div className="spinner"></div>
          <p>Loading Chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chatPage">
        <div className="errorContainer">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>{error}</h3>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="chatPage">
        <div className="errorContainer">
          <h3>Chat Not Found</h3>
          <p>This conversation doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chatPage">
      <div className="chatHeader">
        <div className="headerLeft">
          <div className="avatar">
            {chat.receiver?.avatar ? (
              <img src={chat.receiver.avatar} alt={chat.receiver.username} />
            ) : (
              <span>{(chat.receiver?.username || "O")[0].toUpperCase()}</span>
            )}
          </div>
          <div className="headerInfo">
            <h2>{chat.receiver?.username || "Owner"}</h2>
            <span className="status">Available</span>
          </div>
        </div>
        <button className="deleteAllBtn" onClick={handleDeleteAll} title="Delete all messages">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>

      <div className="chatMessages" ref={messagesContainerRef} onScroll={handleScroll}>
        {chat.messages.length === 0 ? (
          <div className="noMessages">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <h3>No messages yet</h3>
            <p>Start the conversation about your property!</p>
          </div>
        ) : (
          chat.messages.map((msg, index) => {
            const isOwn = msg.userId === currentUser.id;
            const showDate = index === 0 || 
              new Date(msg.createdAt).toDateString() !== new Date(chat.messages[index - 1].createdAt).toDateString();

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="dateLabel">
                    {new Date(msg.createdAt).toLocaleDateString([], { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                )}
                <div className={`message ${isOwn ? "own" : "other"} ${msg.isOptimistic ? "sending" : ""}`}>
                  <div className="messageContent">
                    <p>{msg.text}</p>
                    <div className="messageFooter">
                      <span className="timestamp">{formatMessageTime(msg.createdAt)}</span>
                      {isOwn && !msg.isOptimistic && (
                        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                  </div>
                </div>
                  {isOwn && (
                    <button 
                      className="deleteBtn" 
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        {isTyping && (
          <div className="message other typing">
            <div className="typingIndicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && (
        <button className="scrollToBottom" onClick={() => scrollToBottom()}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      )}

      <form className="chatInput" onSubmit={handleSend} onKeyDown={handleKeyPress}>
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !newMessage.trim()}>
          {isSending ? (
            <div className="buttonSpinner"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

export default ChatPage;