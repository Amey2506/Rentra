import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";

export const SocketContext = createContext();

export const SocketContextProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]); // ✅ global live message storage

  // 1️⃣ Initialize socket connection
  useEffect(() => {
    const newSocket = io("http://localhost:5001", {
      withCredentials: true,
      transports: ["websocket"],
    });
    setSocket(newSocket);

    console.log("🔌 Connected to Socket.IO server");

    return () => {
      newSocket.disconnect();
      console.log("❌ Socket disconnected");
    };
  }, []);

  // 2️⃣ Register user once connected
  useEffect(() => {
    if (currentUser && socket) {
      socket.emit("newUser", currentUser.id);
      console.log("👤 Registered user:", currentUser.id);
    }
  }, [currentUser, socket]);

  // 3️⃣ Listen for new incoming messages globally
  useEffect(() => {
    if (!socket) return;

    socket.on("receive_message", (message) => {
      console.log("💬 New live message:", message);
      setMessages((prev) => [...prev, message]);
    });

    socket.on("messages_cleared", () => {
      console.log("🧹 Chat messages cleared");
      setMessages([]);
    });

    return () => {
      socket.off("receive_message");
      socket.off("messages_cleared");
    };
  }, [socket]);

  // 4️⃣ Function to join a chat room
  const joinChat = useCallback(
    (chatId) => {
      if (socket && chatId) {
        socket.emit("join_chat", chatId);
        console.log(`📥 Joined chat room: ${chatId}`);
      }
    },
    [socket]
  );

  return (
    <SocketContext.Provider value={{ socket, joinChat, messages }}>
      {children}
    </SocketContext.Provider>
  );
};
