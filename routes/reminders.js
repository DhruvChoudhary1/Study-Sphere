const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware"); // Import the middleware

// Reminder Schema
const ReminderSchema = new mongoose.Schema({
  time: { type: Date, required: true },
  note: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Associate with a user
});

const Reminder = mongoose.model("Reminder", ReminderSchema);

// Create a new reminder
router.post("/", authMiddleware, async (req, res) => {
  const { time, note, notes } = req.body;
  const userId = req.userId; // Extracted from the middleware

  if (!time || !note) {
    return res.status(400).json({ error: "Time and note are required." });
  }

  try {
    const reminder = new Reminder({ time, note, notes: notes || "", userId });
    await reminder.save();
    res.status(201).json({ message: "Reminder created successfully.", reminder });
  } catch (err) {
    console.error("Error creating reminder:", err);
    res.status(500).json({ error: "Failed to create reminder." });
  }
});

// Get all reminders
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.userId; // Extracted from the middleware

  try {
    const reminders = await Reminder.find({ userId }).sort({ time: 1 });
    res.status(200).json(reminders);
  } catch (err) {
    console.error("Error fetching reminders:", err);
    res.status(500).json({ error: "Failed to fetch reminders." });
  }
});

// Delete a reminder
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const reminder = await Reminder.findOneAndDelete({ _id: id, userId });
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found." });
    }
    res.status(200).json({ message: "Reminder deleted successfully." });
  } catch (err) {
    console.error("Error deleting reminder:", err);
    res.status(500).json({ error: "Failed to delete reminder." });
  }
});

module.exports = router; 