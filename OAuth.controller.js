import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { v4 as uuidv4 } from "uuid";
import axios from "axios"; // Added axios
import { hashPassword } from "./password.service.js";
import { generateToken } from "./token.service.js";
import { getOrCreateDeviceId } from "./utils/getDeviceId.js";

import dotenv from "dotenv";
dotenv.config();

// Mongoose Models
import User from "./models/User.model.js";
import OAuthProvider from "./models/OAuthProvider.model.js";
import Session from "./models/Session.model.js";

const generateRandomPassword = () => uuidv4() + "-" + uuidv4();

console.log(
  "Using Client ID:",
  process.env.GOOGLE_CLIENT_ID ? "Found" : "Missing",
);

// ─────────────────────────────────────────────
// GET /auth/google  →  redirect to Google
// ─────────────────────────────────────────────
const googleLogin = (req, res) => {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  res.redirect(`${rootUrl}?${new URLSearchParams(options).toString()}`);
};

// ─────────────────────────────────────────────
// GET /auth/google/callback
// ─────────────────────────────────────────────
const googleCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/api/v1/auth/login?error=no_code");

  try {
    /* ── STEP 1: Exchange code for tokens (using Axios) ── */
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000, // 15 second timeout
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    /* ── STEP 2: Fetch Google profile (using Axios) ── */
    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 10000, // 10 second timeout
      }
    );

    const profile = userResponse.data;
    console.log("Fetched Google user profile:", profile);

    /* ── STEP 3: Upsert User in MongoDB ── */
    let isNewUser = false;
    let user = await User.findOne({ email: profile.email });

    if (!user) {
      isNewUser = true;
      user = await User.create({
        email: profile.email,
        password: await hashPassword(generateRandomPassword()),
        name: profile.name,
        avatarUrl: profile.picture,
        username: `user_${uuidv4().slice(0, 8)}`,
        security: {
          emailVerified: true,
          totalLogins: 1,
          lastLoginAt: new Date(),
        },
      });
      console.log("Created new user:", user.email);
    } else {
      user = await User.findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            name: profile.name,
            avatarUrl: profile.picture,
            accountStatus: "ACTIVE",
            "security.lastLoginAt": new Date(),
          },
          $inc: { "security.totalLogins": 1 },
        },
        { new: true },
      );
      console.log("Updated existing user:", user.email);
    }

    /* ── STEP 4: Upsert OAuthProvider ── */
    await OAuthProvider.findOneAndUpdate(
      {
        providerName: "GOOGLE",
        providerUserId: profile.id,
      },
      {
        $set: {
          accessToken: access_token,
          refreshToken: refresh_token,
          userId: user._id,
        },
        $setOnInsert: {
          providerName: "GOOGLE",
          providerUserId: profile.id,
        },
      },
      { upsert: true, new: true },
    );

    /* ── STEP 5: Tokens & Session ── */
    const deviceId = getOrCreateDeviceId(req);

    const accessToken = generateToken("access", user);
    const { refreshToken: refreshTokenJWT, hashedRefreshToken } = generateToken(
      "refresh",
      user,
    );

    await Session.create({
      userId: user._id,
      deviceId,
      refreshToken: hashedRefreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    console.log("Session created for:", user.email);

    /* ── STEP 6: Set Cookies & Redirect ── */
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie("refreshToken", refreshTokenJWT, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.redirect("/api/v1/auth/me");
  } catch (err) {
      console.error("Google Auth Error:", err);

    // Improved error logging for Axios
    if (err.response) {
      console.error("Google Auth Error Data:", err.response.data);
    } else {
      console.error("Google Auth Error:", err.message);
    }
    res.redirect("/api/v1/auth/login?error=google_failed");
  }
};

export { googleLogin, googleCallback };