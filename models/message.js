const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true, // Ensure username is required
      trim: true, // Remove extra spaces
    },
    text: {
      type: String,
      required: true, // Ensure message text is required
      trim: true, // Remove extra spaces
      maxlength: 1000, // Limit message length to 1000 characters
    },
    channel: {
      type: String,
      required: true, // Ensure the message is associated with a channel
      trim: true, // Remove extra spaces
    },
    timestamp: {
      type: Date,
      default: Date.now, // Automatically set the current date and time
    },
  },
  {
    timestamps: true, // Automatically add `createdAt` and `updatedAt` fields
  }
);

module.exports = mongoose.model("Message", messageSchema);
