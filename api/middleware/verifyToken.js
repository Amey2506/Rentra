import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Not Authenticated!" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, payload) => {
    if (err) {
      console.error("JWT Verification Error:", err);
      return res.status(403).json({ message: "Token is not valid!" });
    }

    // 🧾 TEMP LOG: Print full token payload to find actual structure
    console.log("🔍 JWT Payload:", payload);

    // Try to extract possible user ID fields
    const userId =
      payload?.id || payload?.userId || payload?.user?.id || payload?.user?.userId;

    if (!userId) {
      console.error("❌ Token payload missing user ID:", payload);
      return res.status(400).json({ message: "Invalid token payload!" });
    }

    req.userId = userId;
    next();
  });
};
