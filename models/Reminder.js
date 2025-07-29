
const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  datetime: { type: Date, required: true },
  notes: { type: String }
});

module.exports = mongoose.model('Reminder', reminderSchema);
