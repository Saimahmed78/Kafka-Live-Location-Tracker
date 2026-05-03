import mongoose from "mongoose";

const securitySchema = new mongoose.Schema(
  {
    emailVerified: { type: Boolean, default: false },
    totalLogins: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    name: { type: String },
    username: { type: String, unique: true },
    avatarUrl: { type: String },
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BANNED"],
      default: "ACTIVE",
    },
    security: { type: securitySchema, default: () => ({}) },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
