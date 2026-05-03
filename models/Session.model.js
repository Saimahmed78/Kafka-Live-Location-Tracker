import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceId: { type: String },
    refreshToken: { type: String, required: true }, // stores hashed token
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Auto-delete expired sessions via MongoDB TTL index
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Session", sessionSchema);
