import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { refreshSessionService } from "../services/auth.service.js";
import crypto from "crypto";
import prisma from "../prismaClient.js";
const isProd = process.env.NODE_ENV === "production";

const cookieOptionsBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
};
const isLoggedIn = async (req, res, next) => {
  try {
    const accessToken = req.cookies?.accessToken;
    const refreshToken = req.cookies?.refreshToken;
    const deviceId = req.cookies?.deviceId;

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken || "")
      .digest("hex");
    if (accessToken) {
      try {
        const decoded = jwt.verify(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET,
        );
        const session = await prisma.Session.findFirst({
          where: { refreshToken: hashedRefreshToken },
        });
        if (!session) {
          res.clearCookie("accessToken", cookieOptionsBase);
          res.clearCookie("refreshToken", cookieOptionsBase);
          throw new ApiError(401, "Session expired or revoked");
        }

        // Token is valid & Session exists
        req.user = decoded;
        return next();
      } catch (err) {
        // If the error is our specific "Session revoked" error, stop here.
        if (err instanceof ApiError) throw err;

        // Otherwise (e.g. token expired), ignore error and fall through to Step 2 (Refresh Token)
      }
    }

    // ----------------------------------------------------------------
    // 2️⃣ Access token missing or expired → try REFRESH TOKEN
    // ----------------------------------------------------------------
    if (!refreshToken) {
      throw new ApiError(401, "User is logged out. Please login again.");
    }

    const { user, newAccessToken, newRefreshToken } =
      await refreshSessionService(refreshToken, deviceId);

    // Set cookies
    const accessCookieOptions = {
      ...cookieOptionsBase,
      maxAge: 15 * 60 * 1000, // 15 Minutes (Standard)
    };
    const refreshCookieOptions = {
      ...cookieOptionsBase,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
    };

    res.cookie("accessToken", newAccessToken, accessCookieOptions);
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);

    // 4️⃣ Attach decoded user
    req.user = jwt.decode(newAccessToken);

    next();
  } catch (err) {
    console.log("isLoggedIn Middleware Error:", err);
    // If anything fails (including Refresh Token), clear everything to reset state
    res.clearCookie("accessToken", cookieOptionsBase);
    res.clearCookie("refreshToken", cookieOptionsBase);

    // Pass the error to your global error handler
    next(new ApiError(401, err?.message || "Unauthorized Access"));
  }
};

export default isLoggedIn;
