// server/app.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import prisma from "./lib/prisma.js";

// Routes
import authRoute from "./routes/auth.route.js";
import postRoute from "./routes/post.route.js";
import testRoute from "./routes/test.route.js";
import userRoute from "./routes/user.route.js";
import chatRoute from "./routes/chat.route.js";
import messageRoute from "./routes/message.route.js";
import ragRoute from "./routes/rag.route.js";

const app = express();

// ----------------------------
// 🌍 Middleware setup
// ----------------------------
const FRONTEND_ORIGIN = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ----------------------------
// 🧩 Routes
// ----------------------------
app.use("/api/rag", ragRoute);
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/test", testRoute);
app.use("/api/chats", chatRoute);
app.use("/api/messages", messageRoute);
app.use("/api/posts", postRoute);

// ----------------------------
// ⚡ Socket.io Real-Time Setup
// ----------------------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Make the socket globally available
global.io = io;

// Keep track of connected users by their userId
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  socket.on("newUser", (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      console.log(`✅ Registered user ${userId} with socket ID ${socket.id}`);
    }
  });

  socket.on("sendMessage", async (data) => {
    const { chatId, senderId, text } = data;
    try {
      const newMessage = await prisma.message.create({
        data: { chatId, userId: senderId, text },
      });

      // Broadcast message to everyone in that chat room
      io.to(chatId).emit("getMessage", newMessage);
      console.log(`📤 Message sent in chat ${chatId}: ${text}`);
    } catch (err) {
      console.error("❌ Error in sendMessage:", err);
    }
  });

  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log(`👥 User joined chat room: ${chatId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Disconnected: ${socket.id}`);
    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
  });
});

// ----------------------------
// 🚀 Start Server
// ----------------------------
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

export { io };
export default app;
