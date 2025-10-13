require("dotenv").config();
const express = require('express'); 
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const User = require("./models/User");
const Message = require("./models/message");
const moderationRoutes = require("./routes/moderation");
const reminderRoutes = require('./routes/reminders'); 
const studyGroups = require('./routes/study-groups');

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: true,
  credentials: true
}));  
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api", moderationRoutes);
app.use('/api/reminders', reminderRoutes);

// Add GET /api/groups route to serve study groups
app.get("/api/groups", (req, res) => {
  res.json(studyGroups.getAllGroups());
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Static files (ensure both index.html and study_website.html are here)
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Serve protected study_website.html
app.get("/study_website.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "study_website.html"));
});

app.post("/signup", async (req, res) => {
  const { username, email, password, displayName } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ error: "Missing username, email, or password" });
  }
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists with this email or username" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ 
    username, 
    email, 
    password: hashedPassword,
    displayName: displayName || username
  });
  await newUser.save();
  const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  });
  res.cookie("username", newUser.username, { httpOnly: true });
  res.cookie("displayName", newUser.displayName, { httpOnly: true });
  res.status(201).json({ 
    message: "User created successfully", 
    redirectTo: "/study_website.html",
    user: {
      username: newUser.username,
      displayName: newUser.displayName
    }
  });
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
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  });
  res.cookie("username", user.username, { httpOnly: true });
  res.cookie("displayName", user.displayName || user.username, { httpOnly: true });


  res.status(200).json({ 
    message: "Login successful", 
    token,
    user: {
      username: user.username,
      displayName: user.displayName || user.username
    }
  });
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ... rest of your code (unchanged, including socket.io, message APIs, etc.) ...

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
  console.log(`💻 Environment: ${process.env.NODE_ENV || "development"}`);
});
