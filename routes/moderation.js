require("dotenv").config();
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "Loaded" : "Not Loaded"); 
const express = require("express"); 
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const User = require("../models/User"); 



const router = express.Router();

// Rate limiter to prevent abuse
const moderationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: "Too many requests. Please try again later.",
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service provider
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password
  },
});

// Moderation route
router.post("/moderate", moderationLimiter, async (req, res) => {
  console.log("Request body:", req.body);
  const { content, userId } = req.body;

  try {
    if (!content) {
      return res.status(400).json({ error: "Content is required for moderation" });
    }
    if (!userId) {
      console.log("No userId provided in the request body.");
      return res.status(400).json({ error: "User ID is required for moderation." });
    }
  

    // **1. Detect suicidal or depressive content**
    const suicideKeywords = [
      "suicide", "kill myself", "end my life", "depressed", "hopeless", "worthless",
      "no way out", "give up", "can't go on", "life is meaningless",
    ];
    const isSuicidal = suicideKeywords.some((keyword) =>
      content.toLowerCase().includes(keyword)
    );

    
    if (isSuicidal && userId) {
      const user = await User.findById(userId);
      if (user && user.email) {
        console.log(`Preparing to send email to ${user.email}`);
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "We're Here to Help",
            text: `Hi ${user.username},\n\nWe noticed that you might be feeling distressed or overwhelmed. Please know that you're not alone, and there are people who care about you and want to help.\n\nHere are some resources you can reach out to:\n\n- National Suicide Prevention Lifeline: -TALK (1-800-273-8255)\n- Crisis Text Line: Text HOME to 741741\n- Visit https://findahelpline.com/ for international helplines.\n- Government Mental Health Support: https://www.nimh.nih.gov/ (National Institute of Mental Health)\n\nPlease take care of yourself, and don't hesitate to reach out for support.\n\nBest regards,\nThe StudyHub Team`,
          });
          console.log(`Email sent successfully to ${user.email}`);
        } catch (error) {
          console.error("Error sending email:", error);
        }
      } else {
        console.log("User not found or email not available");
      }
    }
    // **2. Whitelist of normal conversational phrases**
    const allowedPhrases = [
      "hi", "hello", "how are you", "what's your name", "good morning", "good evening",
      "good night", "thank you", "please", "welcome",
    ];
    const isAllowedPhrase = allowedPhrases.some((phrase) =>
      content.toLowerCase().includes(phrase)
    );

    if (isAllowedPhrase) {
      console.log("Message allowed as a normal conversational phrase:", content);
      return res.json({ allowed: true, reason: "Allowed as a normal conversational phrase" });
    }

    // **3. Custom logic to allow only study-related conversations**
    const studyKeywords = [
      "study", "homework", "assignment", "exam", "test", "project", "subject",
      "math", "science", "history", "geography", "physics", "chemistry", "biology",
      "literature", "notes", "revision", "syllabus", "class", "lecture", "teacher",
    ];
    const isStudyRelated = studyKeywords.some((keyword) =>
      content.toLowerCase().includes(keyword)
    );

    if (!isStudyRelated) {
      console.log("Message blocked for being off-topic:", content);
      return res.json({ allowed: false, reason: "Message is not study-related" });
    }

    // **4. Call Perspective API for further moderation**
    const response = await axios.post(
      "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze",
      {
        comment: { text: content },
        languages: ["en"], // Support English
        requestedAttributes: {
          TOXICITY: {},
          SEVERE_TOXICITY: {},
          PROFANITY: {},
          INSULT: {},
          THREAT: {},
        },
      },
      {
        params: { key: process.env.PERSPECTIVE_API_KEY }, // Use your Perspective API key
        headers: { "Content-Type": "application/json" },
      }
    );

    const scores = response.data.attributeScores;
    const toxicityScore = scores.TOXICITY.summaryScore.value;

    console.log("Toxicity score for:", content, "→", toxicityScore);

    // Decide whether to allow or block the message
    const allowed = toxicityScore < 0.6; // Adjust threshold as needed

    res.json({
      allowed,
      scores,
    });
  } catch (err) {
    console.error("Perspective API Error:", err.response?.data || err.message);
    if (err.response?.status === 429) {
      return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
    }
    res.status(500).json({ error: "Internal Server Error during moderation" });
  }
});

module.exports = router;