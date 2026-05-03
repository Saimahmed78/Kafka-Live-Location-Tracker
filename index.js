import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import path from "node:path";
import dotenv from "dotenv"
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
// import { kafkaCient } from "./kafka-client.js";
import { googleCallback, googleLogin } from "./OAuth.controller.js";

dotenv.config()
// ── JWT auth middleware ──────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function main() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*", credentials: true } });
  const PORT = process.env.PORT || 8000;

  // ── Middleware ─────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(cookieParser());                          // reads req.cookies
  app.use(express.static(path.resolve("./public")));

  // ── Kafka setup ───────────────────────────────────────────────────────────
  // const kafkaProducer = kafkaCient.producer();
  // const kafkaConsumer = kafkaCient.consumer({ groupId: `socket-server-${PORT}` });

  // await kafkaProducer.connect();
  // await kafkaConsumer.connect();

  // await kafkaConsumer.subscribe({ topic: "location_updates", fromBeginning: false });

  // kafkaConsumer.run({
  //   eachMessage: async ({ message, heartbeat }) => {
  //     try {
  //       const data = JSON.parse(message.value.toString());
  //       console.log("Kafka → broadcasting location:", data.userId);
  //       io.emit("server:location_update", data);
  //       await heartbeat();
  //     } catch (err) {
  //       console.error("Kafka message parse error:", err.message);
  //     }
  //   },
  // });

  // ── Auth routes ───────────────────────────────────────────────────────────
  app.get("/api/v1/auth/google", googleLogin);
  app.get("/api/v1/auth/google/callback", googleCallback);

  // ── API routes ────────────────────────────────────────────────────────────

  // Frontend calls this to check if user is logged in
  app.get("/api/v1/auth/me", requireAuth, (req, res) => {
    res.json({
      id:        req.user.id,
      name:      req.user.name,
      email:     req.user.email,
      avatarUrl: req.user.avatarUrl,
    });
  });

  // Logout — clear both cookies
  app.post("/api/v1/auth/logout", (req, res) => {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ ok: true });
  });

  // ── Page routes ───────────────────────────────────────────────────────────
  app.get("/api/v1/auth/login", (req, res) =>
    res.sendFile("login.html", { root: "./public" })
  );
  app.get("/", (req, res) =>
    res.sendFile("index.html", { root: "./public" })
  );

  // ── Socket.IO ─────────────────────────────────────────────────────────────

  // Track userId → socketId so we can broadcast disconnects
  const connectedUsers = new Map(); // userId → socketId

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    let thisUserId = null;

    socket.on("client:location_update", async (locationData) => {
      const { latitude, longitude, userId, name } = locationData;

      // Basic validation
      if (
        typeof latitude  !== "number" ||
        typeof longitude !== "number" ||
        !userId
      ) {
        console.warn("Invalid location data received, skipping.");
        return;
      }

      // Track this socket → user mapping
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, socket.id);
        thisUserId = userId;
      }

      console.log(`Location from ${name || userId}: ${latitude}, ${longitude}`);

      // try {
      //   await kafkaProducer.send({
      //     topic: "location_updates",
      //     messages: [
      //       {
      //         key: userId,                      // use userId, not socket.id
      //         value: JSON.stringify({ userId, name, latitude, longitude }),
      //       },
      //     ],
      //   });
      // } catch (err) {
      //   console.error("Kafka produce error:", err.message);
      // }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (thisUserId) {
        connectedUsers.delete(thisUserId);
        // Tell all clients to remove this user's marker
        io.emit("server:user_disconnected", { userId: thisUserId });
      }
    });
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

main();