import prisma from "../lib/prisma.js";

export const getChats = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chats = await prisma.chat.findMany({
      where: {
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
    });

    for (const chat of chats) {
      const receiverId = chat.userIDs.find((id) => id !== tokenUserId);

      const receiver = await prisma.user.findUnique({
        where: {
          id: receiverId,
        },
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      });
      chat.receiver = receiver;
    }

    res.status(200).json(chats);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get chats!" });
  }
};

export const getChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chat = await prisma.chat.findUnique({
      where: {
        id: req.params.id,
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    await prisma.chat.update({
      where: {
        id: req.params.id,
      },
      data: {
        seenBy: {
          push: [tokenUserId],
        },
      },
    });
    res.status(200).json(chat);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get chat!" });
  }
};

// ==========================================================
// FINAL addChat FUNCTION: CORRECTED LOGIC
// This uses hasEvery which is the most guaranteed way to check for two IDs.
// ==========================================================
export const addChat = async (req, res) => {
  const tokenUserId = req.userId;
  const { receiverId } = req.body; 

  try {
    // 1. Check if a chat already exists containing EXACTLY both user IDs
    const chatToFind = await prisma.chat.findFirst({
      where: {
        userIDs: {
            // This ensures BOTH IDs are present in the array
          hasEvery: [tokenUserId, receiverId], 
        },
        // NOTE: If your chat model allows group chats, you would need raw MongoDB 
        // to check array length = 2. For standard 1-on-1 chats, hasEvery is typically enough.
      },
    });

    let chatToReturn;

    if (chatToFind) { 
      // 2. If chat exists, return it
      chatToReturn = chatToFind;
      console.log("Existing chat found (FINAL):", chatToFind.id); 
    } else {
      // 3. If no chat exists, create a new one
      const newChat = await prisma.chat.create({
        data: {
          userIDs: [tokenUserId, receiverId],
        },
      });
      chatToReturn = newChat;
      console.log("New chat created:", newChat.id); 
    }

    // Return the found or created chat
    res.status(200).json(chatToReturn);
  } catch (err) {
    // Log the full error for debugging
    console.error("Error in addChat:", err); 
    res.status(500).json({ message: "Failed to add chat!" });
  }
};

export const readChat = async (req, res) => {
  const tokenUserId = req.userId;

  
  try {
    const chat = await prisma.chat.update({
      where: {
        id: req.params.id,
        userIDs: {
          hasSome: [tokenUserId],
        },
      },
      data: {
        seenBy: {
          set: [tokenUserId],
        },
      },
    });
    res.status(200).json(chat);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to read chat!" });
  }
};