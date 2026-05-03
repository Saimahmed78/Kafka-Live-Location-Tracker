import bcrypt from "bcryptjs";

export async function hashPassword(password, user) {
  const hashed_password = await bcrypt.hash(password, 10);
  return hashed_password;
}
