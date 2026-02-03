require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");

// Models & routes
const User = require("./models/User");
const moderationRoutes = require("./routes/moderation");
const reminderRoutes = require("./routes/reminders");
const studyGroups = require("./routes/study-groups");

// =====================
// MIDDLEWARE
// =====================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// =====================
// ROUTES
// =====================
app.use("/api", moderationRoutes);
app.use("/api/reminders", reminderRoutes);

// Study groups
app.get("/api/groups", (req, res) => {
  res.json(studyGroups.getAllGroups());
});

// =====================
// DATABASE
// =====================
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// =====================
// STATIC FILES
// =====================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/study_website.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "study_website.html"));
});

// =====================
// AUTH
// =====================
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      displayName: displayName || username,
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });

    res.cookie("username", newUser.username, { httpOnly: true });
    res.cookie("displayName", newUser.displayName, { httpOnly: true });

    res.status(201).json({
      message: "Signup successful",
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });

    res.cookie("username", user.username, { httpOnly: true });
    res.cookie("displayName", user.displayName || user.username, {
      httpOnly: true,
    });

    res.json({
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// =====================
// SOCKET.IO (DISCORD-LIKE)
// =====================
const rooms = {}; // roomId -> Set(socketId)
const groupMembers = {}; // group -> Map(socketId, { name })



io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("create-channel", ({ group, channel }) => {
    // broadcast to everyone in this group
    io.emit("channel-created", { group, channel });
  });

  socket.on("join-room", ({ roomId, user, roomType }) => {
    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = new Map();

    rooms[roomId].set(socket.id, {
      name: user.name,
      type: roomType, // "group" | "text" | "voice" | "video"
    });

    io.to(roomId).emit("room-members", {
      roomId,
      members: Array.from(rooms[roomId].values()),
    });
  });

  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);

    if (rooms[roomId]) {
      rooms[roomId].delete(socket.id);

      io.to(roomId).emit("room-members", {
        roomId,
        members: Array.from(rooms[roomId].values()),
      });
    }
  });

  // Chat
  socket.on("chat-message", (data) => {
    io.to(data.roomId).emit("chat-message", data);
  });

  // WebRTC signaling
  socket.on("webrtc-offer", ({ targetId, offer }) => {
    io.to(targetId).emit("webrtc-offer", {
      senderId: socket.id,
      offer,
    });
  });

  socket.on("webrtc-answer", ({ targetId, answer }) => {
    io.to(targetId).emit("webrtc-answer", {
      senderId: socket.id,
      answer,
    });
  });

  socket.on("webrtc-ice", ({ candidate }) => {
    socket.broadcast.emit("webrtc-ice", {
      senderId: socket.id,
      candidate,
    });
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].has(socket.id)) {
        rooms[roomId].delete(socket.id);

        io.to(roomId).emit("room-members", {
          roomId,
          members: Array.from(rooms[roomId].values()),
        });
      }
    }
  });
});


// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`💻 Environment: ${process.env.NODE_ENV || "development"}`);
});
