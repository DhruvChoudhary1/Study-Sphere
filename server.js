require("dotenv").config();
const express = require('express'); 
const app = express();
app.use(express.json()); 
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const router = express.Router();
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const User = require("./models/User");
const Message = require("./models/message");
const moderationRoutes = require("./routes/moderation");
const reminderRoutes = require('./routes/reminders'); 



app.use(cookieParser());

const { OpenAI } = require("openai");

app.use(cors());  

app.use(bodyParser.json());
app.use("/api", moderationRoutes);
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/reminders', require('./routes/reminders'));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });


app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: "Missing username, email, or password" });
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists with this email or username" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({ username, email, password: hashedPassword });
  await newUser.save();

  res.cookie("username", newUser.username, { httpOnly: true });
  res.cookie("displayName", newUser.username, { httpOnly: true });
  
  // ✅ Send success JSON instead of redirect to handle in frontend
  res.status(201).json({ message: "User created successfully", redirectTo: "/study_website.html" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials (username)" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid credentials (password)" });
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  // ✅ Also set a cookie with token for future requests
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true in production
    sameSite: "Lax",
  });

  res.status(200).json({ message: "Login successful", token });
});

// ✅ ADDED: Middleware to verify JWT
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ✅ ADDED: Logout route
app.get("/logout", (req, res) => {
  res.clearCookie("username");
  res.clearCookie("displayName");
  res.status(200).send("Logged out");
});

// ✅ ADDED: Protected profile route
app.get("/api/profile", authenticateToken, async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// Study group logic
const groups = ["math", "science", "history", "programming"];

function getAllGroups() {
  return groups;
}

function isValidGroup(groupName) {
  return groups.includes(groupName);
}

app.get("/api/groups", (req, res) => {
  res.json(getAllGroups());
});

app.post("/join-group", async (req, res) => {
  const { username, group } = req.body;
  if (!username || !isValidGroup(group)) {
    return res.status(400).json({ error: "Invalid data" });
  }

  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.groups.includes(group)) {
    user.groups.push(group);
    await user.save();
  }

  res.json({ message: `Joined ${group}`, groups: user.groups });
}); 

// ✅ ADDED: Get user's joined groups
app.get("/user-groups/:username", async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ groups: user.groups });
});

app.post("/message", async (req, res) => {
  const { username, displayName, text, channel } = req.body;

  if (!username || !text || !channel) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const message = new Message({
      username,
      displayName: displayName || username,
      text,
      channel,
      timestamp: new Date(),
    });
    await message.save();
    res.status(200).json({ message: "Message saved" });
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).send("Error");
  }
}); 

app.get("/messages/:channel", async (req, res) => {
  const { channel } = req.params;
  try {
    const messages = await Message.find({ channel }).sort({ timestamp: 1 });
    res.status(200).json({ messages });
  } catch (err) {
    res.status(500).send("Error fetching messages");
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getAIResponse(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error("AI error:", err);
    return "Oops! Something went wrong.";
  }
}

app.post("/api/ai", async (req, res) => {
  const { prompt } = req.body;

  try {
    const aiReply = await getAIResponse(prompt);
    res.json({ reply: aiReply });
  } catch (err) {
    console.error("AI route error:", err);
    res.status(500).json({ reply: "Error reaching AI." });
  }
});

const users = {}; // Store user information (socketId -> { username, displayName, channel })


io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle user joining a channel
  socket.on("join channel", ({ username, displayName, channel }) => {
    console.log(`${displayName} (${username}) is joining channel: ${channel}`);
    socket.join(channel);

    // Store user information
    users[socket.id] = { username, displayName, channel };

    // Notify all users in the channel about the updated member list
    const members = Array.from(io.sockets.adapter.rooms.get(channel) || []).map(
      (socketId) => ({
        username: users[socketId]?.username || "Unknown User",
        displayName: users[socketId]?.displayName || "Anonymous",
      })
    );
    io.to(channel).emit("updateMembers", { members });
  });

  // Handle user updating their display name
  socket.on("updateDisplayName", ({ displayName, channel }) => {
    if (users[socket.id]) {
      users[socket.id].displayName = displayName;

      // Notify all users in the channel about the updated member list
      const members = Array.from(io.sockets.adapter.rooms.get(channel) || []).map(
        (socketId) => ({
          username: users[socketId]?.username || "Unknown User",
          displayName: users[socketId]?.displayName || "Anonymous",
        })
      );
      io.to(channel).emit("updateMembers", { members });

      console.log(`User updated display name to: ${displayName}`);
    }
  });

  // Handle user disconnecting
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      const { displayName, channel } = user;
      console.log(`${displayName} disconnected from channel: ${channel}`);

      // Remove the user from the users object
      delete users[socket.id];

      // Notify all users in the channel about the updated member list
      const members = Array.from(io.sockets.adapter.rooms.get(channel) || []).map(
        (socketId) => ({
          username: users[socketId]?.username || "Unknown User",
          displayName: users[socketId]?.displayName || "Anonymous",
        })
      );
      io.to(channel).emit("updateMembers", { members });
    }
  });
});
app.use(helmet()); 

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
  console.log(`💻 Environment: ${process.env.NODE_ENV || "development"}`);
});
