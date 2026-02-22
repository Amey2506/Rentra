import express from "express";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  createChatSession,
  getChatSessions,
  getChatSession,
  sendMessage,
  deleteChatSession,
} from "../controllers/rag.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Document routes
router.post("/upload", verifyToken, upload.single("document"), uploadDocument);
router.get("/documents", verifyToken, getDocuments);
router.delete("/documents/:id", verifyToken, deleteDocument);

// Chat session routes
router.post("/chat/sessions", verifyToken, createChatSession);
router.get("/chat/sessions", verifyToken, getChatSessions);
router.get("/chat/sessions/:id", verifyToken, getChatSession);
router.delete("/chat/sessions/:id", verifyToken, deleteChatSession);

// Message routes
router.post("/chat/sessions/:sessionId/messages", verifyToken, sendMessage);

export default router;