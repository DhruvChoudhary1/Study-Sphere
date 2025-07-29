const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true, // Ensure username is required
      unique: true, // Ensure usernames are unique
      trim: true, // Remove extra spaces
    },
    email: {
      type: String,
      required: true, // Ensure email is required
      unique: true, // Ensure emails are unique
      trim: true, // Remove extra spaces
      match: [/.+@.+\..+/, "Please enter a valid email address"], // Validate email format
    },
    password: {
      type: String,
      required: true, // Ensure password is required
      minlength: 6, // Enforce a minimum password length
    },
  },
  {
    timestamps: true, // Automatically add `createdAt` and `updatedAt` fields
  }
);

// Pre-save middleware to hash passwords before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    console.log("Password not modified for user:", this.email); // Debugging log for unchanged password
    return next(); // Only hash if the password is new or modified
  }

  console.log("Saving user with email:", this.email); // Debugging log for email

  try {
    const salt = await bcrypt.genSalt(10); // Generate a salt
    console.log("Generated salt for password hashing:", salt); // Debugging log for salt
    this.password = await bcrypt.hash(this.password, salt); // Hash the password
    console.log("Password hashed successfully for user:", this.email); // Debugging log for hashed password
    next();
  } catch (err) {
    console.error("Error hashing password for user:", this.email, err); // Debugging log for errors
    next(err);
  }
});

// Method to compare passwords during login
userSchema.methods.comparePassword = async function (candidatePassword) {
  console.log("Comparing password for user with email:", this.email); // Debugging log for email
  const isMatch = await bcrypt.compare(candidatePassword, this.password); // Compare hashed passwords
  console.log("Password comparison result for user:", this.email, isMatch); // Debugging log for comparison result
  return isMatch;
};

// Debugging log when a user is being queried
userSchema.post("findOne", function (doc) {
  if (doc) {
    console.log("User found during query:", doc.email); // Debugging log for found user
  } else {
    console.log("No user found during query."); // Debugging log for no user found
  }
});

module.exports = mongoose.model("User", userSchema);
