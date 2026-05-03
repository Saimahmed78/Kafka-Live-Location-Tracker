import crypto from "crypto";
import jwt from "jsonwebtoken";

const isProd = process.env.NODE_ENV === "production";

export function generateToken(type, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  if (type === "refresh") {
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "1d",
      },
    );
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    return { refreshToken, hashedRefreshToken };
  }
  if (type === "access") {
    const accessToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );
    return accessToken;
  }
  if (type === "verification") {
    const verificationToken = token;
    const hashedVerificationToken = hashed;
    const hashedVerificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    return {
      verificationToken,
      hashedVerificationToken,
      hashedVerificationTokenExpiry,
    };
  }

  if (type === "forgot") {
    const forgotPasswordTokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min

    return {
      forgotPasswordToken: token,
      hashedForgotPasswordToken: hashed,
      forgotPasswordTokenExpiry,
    };
  }
}
