// server/routes/message.route.js
import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import prisma from "../lib/prisma.js";
import { io } from "../app.js";

const router = express.Router();

/**
 * ➕ Add a message to a specific chat
 */
router.post("/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId; // ✅ from verifyToken
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Message text cannot be empty" });
    }

    // ✅ Create and include user info for frontend rendering
    const newMessage = await prisma.message.create({
      data: {
        chatId,
        userId,
        text,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // ✅ Emit message to Socket.IO chat room
    io.to(chatId).emit("receive_message", newMessage);

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("❌ Error adding message:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * 🗑️ Delete all messages for a chat
 */
router.delete("/all/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;

    await prisma.message.deleteMany({
      where: { chatId },
    });

    io.to(chatId).emit("messages_cleared");

    return res.status(200).json({ message: "All messages deleted" });
  } catch (err) {
    console.error("❌ Error deleting messages:", err);
    return res.status(500).json({ error: "Failed to delete messages" });
  }
});

export default router;
