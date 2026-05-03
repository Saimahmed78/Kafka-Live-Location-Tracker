import mongoose from "mongoose";

const oauthProviderSchema = new mongoose.Schema(
  {
    providerName: { type: String, required: true, enum: ["GOOGLE", "GITHUB"] },
    providerUserId: { type: String, required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Compound unique index (replaces Prisma's @@unique)
oauthProviderSchema.index(
  { providerName: 1, providerUserId: 1 },
  { unique: true },
);

export default mongoose.model("OAuthProvider", oauthProviderSchema);
