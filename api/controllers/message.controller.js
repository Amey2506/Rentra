import prisma from "../lib/prisma.js";

export const addMessage = async (req, res) => {
  const chatId = req.params.chatId;
  const { text } = req.body;
  const tokenUserId = req.userId;

  try {
    const newMessage = await prisma.message.create({
      data: {
        text,
        chatId,
        userId: tokenUserId,
      },
    });

    // Update chat's lastMessage field for chat list preview
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessage: text },
    });

    // 🔥 Real-time socket emission
    if (global.io) {
      global.io.to(chatId).emit("getMessage", newMessage);
      console.log(`📡 Emitted getMessage for chat ${chatId}`);
    }

    res.status(200).json(newMessage);
  } catch (err) {
    console.error("Error adding message:", err);
    res.status(500).json({ message: "Failed to add message." });
  }
};

// --- DELETE ALL MESSAGES CONTROLLER ---
export const deleteMessages = async (req, res) => {
  const chatId = req.params.chatId;
  const tokenUserId = req.userId;

  try {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userIDs: { has: tokenUserId } },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found or unauthorized." });
    }

    const [messagesDeleted] = await prisma.$transaction([
      prisma.message.deleteMany({ where: { chatId } }),
      prisma.chat.update({
        where: { id: chatId },
        data: { lastMessage: null },
      }),
    ]);

    console.log(`🗑️ Deleted ${messagesDeleted.count} messages in chat ${chatId}`);

    res.status(200).json({
      message: "All messages deleted.",
      deletedCount: messagesDeleted.count,
    });
  } catch (err) {
    console.error("CRITICAL ERROR IN DELETE MESSAGES:", err);
    res.status(500).json({ message: "Failed to delete messages." });
  }
};
