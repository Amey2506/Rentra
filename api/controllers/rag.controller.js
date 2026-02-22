import prisma from "../lib/prisma.js";
import ragService from "../lib/ragService.js";
import crypto from "crypto";

// Helper function to generate file hash
function generateFileHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ==================== DOCUMENT ROUTES ====================

export const uploadDocument = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    console.log("Upload attempt started for user:", tokenUserId);
    
    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("File received:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Generate file hash to check for duplicates
    const fileHash = generateFileHash(req.file.buffer);
    console.log("File hash generated:", fileHash.substring(0, 10) + "...");

    // First, check if a document with the same original name exists for this user
    const sameNameDocument = await prisma.document.findFirst({
      where: {
        userId: tokenUserId,
        originalName: req.file.originalname,
      },
    });

    const overwrite = String(req.body?.overwrite || "false").toLowerCase() === "true";

    if (sameNameDocument && !overwrite) {
      console.log("File with the same name exists; requesting overwrite confirmation");
      return res.status(409).json({
        code: "NAME_EXISTS",
        message: `A file named '${req.file.originalname}' already exists.`,
        document: {
          id: sameNameDocument.id,
          originalName: sameNameDocument.originalName,
          filename: sameNameDocument.filename,
        },
      });
    }

    // Also check if this exact file was already uploaded by this user (same content)
    const existingDocumentByHash = await prisma.document.findFirst({
      where: {
        userId: tokenUserId,
        fileHash: fileHash,
      },
    });

    if (existingDocumentByHash && !overwrite) {
      console.log("Duplicate file content detected");
      return res.status(409).json({
        code: "DUPLICATE_FILE",
        message: "This document has already been uploaded",
        document: {
          id: existingDocumentByHash.id,
          originalName: existingDocumentByHash.originalName,
          filename: existingDocumentByHash.filename,
        },
      });
    }

    // Parse PDF and get text
    console.log("Starting PDF parsing...");
    const pdfText = await ragService.parsePDF(req.file.buffer);
    console.log("PDF parsing completed, text length:", pdfText?.length || 0);

    if (!pdfText || pdfText.trim().length === 0) {
      console.log("Failed to extract text from PDF");
      return res.status(400).json({ message: "Failed to extract text from PDF" });
    }

    // Process document with RAG
    console.log("Starting RAG processing...");
    const processedData = await ragService.processDocument(
      pdfText,
      req.file.originalname
    );
    console.log("RAG processing completed, chunks:", processedData.chunkCount);

    // Save to database (create or update on overwrite)
    console.log(overwrite && sameNameDocument ? "Overwriting existing document..." : "Saving new document to database...");
    let document;

    if (overwrite && sameNameDocument) {
      // Update existing document with same name
      document = await prisma.document.update({
        where: { id: sameNameDocument.id },
        data: {
          fileHash: fileHash,
          content: pdfText,
          embeddings: processedData.embeddings,
        },
      });

      // Ensure RAG service replaces old embeddings if needed
      try {
        ragService.removeDocument(sameNameDocument.originalName);
      } catch (e) {
        console.warn("Non-critical: failed to remove old document from RAG service", e?.message);
      }
    } else {
      document = await prisma.document.create({
        data: {
          filename: req.file.filename || req.file.originalname,
          originalName: req.file.originalname,
          fileHash: fileHash,
          content: pdfText,
          embeddings: processedData.embeddings,
          userId: tokenUserId,
        },
      });
    }

    console.log("Document saved successfully with ID:", document.id);
    res.status(overwrite && sameNameDocument ? 200 : 201).json({ document, overwritten: overwrite && !!sameNameDocument });
  } catch (error) {
    console.error("Error uploading document:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Failed to upload document",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getDocuments = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const documents = await prisma.document.findMany({
      where: {
        userId: tokenUserId,
      },
      select: {
        id: true,
        originalName: true,
        filename: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};

export const deleteDocument = async (req, res) => {
  const tokenUserId = req.userId;
  const { id } = req.params;

  try {
    // Verify document belongs to user
    const document = await prisma.document.findFirst({
      where: {
        id: id,
        userId: tokenUserId,
      },
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Delete associated chat sessions
    await prisma.chatSession.deleteMany({
      where: {
        documentId: id,
      },
    });

    // Delete document
    await prisma.document.delete({
      where: {
        id: id,
      },
    });

    // Remove from RAG service
    ragService.removeDocument(document.originalName);

    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
};

// ==================== CHAT SESSION ROUTES ====================

export const createChatSession = async (req, res) => {
  const tokenUserId = req.userId;
  const { title, documentId } = req.body;

  try {
    // Verify document belongs to user if provided
    if (documentId) {
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId: tokenUserId,
        },
      });

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
    }

    const chatSession = await prisma.chatSession.create({
      data: {
        title: title || "New Chat Session",
        userId: tokenUserId,
        documentId: documentId || null,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            originalName: true,
          },
        },
      },
    });

    res.status(201).json(chatSession);
  } catch (error) {
    console.error("Error creating chat session:", error);
    res.status(500).json({ message: "Failed to create chat session" });
  }
};

export const getChatSessions = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chatSessions = await prisma.chatSession.findMany({
      where: {
        userId: tokenUserId,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            originalName: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.status(200).json(chatSessions);
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    res.status(500).json({ message: "Failed to fetch chat sessions" });
  }
};

export const getChatSession = async (req, res) => {
  const tokenUserId = req.userId;
  const { id } = req.params;

  try {
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: id,
        userId: tokenUserId,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            originalName: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chatSession) {
      return res.status(404).json({ message: "Chat session not found" });
    }

    res.status(200).json(chatSession);
  } catch (error) {
    console.error("Error fetching chat session:", error);
    res.status(500).json({ message: "Failed to fetch chat session" });
  }
};

export const deleteChatSession = async (req, res) => {
  const tokenUserId = req.userId;
  const { id } = req.params;

  try {
    // Verify session belongs to user
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: id,
        userId: tokenUserId,
      },
    });

    if (!chatSession) {
      return res.status(404).json({ message: "Chat session not found" });
    }

    // Delete session (messages cascade delete)
    await prisma.chatSession.delete({
      where: {
        id: id,
      },
    });

    res.status(200).json({ message: "Chat session deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    res.status(500).json({ message: "Failed to delete chat session" });
  }
};

// ==================== MESSAGE ROUTES ====================

export const sendMessage = async (req, res) => {
  const tokenUserId = req.userId;
  const { sessionId } = req.params;
  const { message } = req.body;

  try {
    // Get chat session with all data
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        userId: tokenUserId,
      },
      include: {
        document: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chatSession) {
      return res.status(404).json({ message: "Chat session not found" });
    }

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        content: message,
        role: "user",
        sessionId: sessionId,
      },
    });

    let assistantResponse =
      "I'm sorry, but I need a document to be uploaded to answer your questions. Please upload a legal document first.";

    // Process with RAG if document exists
    if (chatSession.document) {
      try {
        const chatHistory = chatSession.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const ragResponse = await ragService.processQuery(
          message,
          chatSession.document.originalName,
          chatHistory
        );

        assistantResponse = ragResponse.response;
      } catch (error) {
        console.error("Error processing RAG query:", error);
        assistantResponse =
          "I encountered an error while processing your question. Please try again.";
      }
    }

    // Save assistant response
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        content: assistantResponse,
        role: "assistant",
        sessionId: sessionId,
      },
    });

    // Update session timestamp
    await prisma.chatSession.update({
      where: {
        id: sessionId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};