
import jwt from "jsonwebtoken";

export function generateToken(user) {
  if (!process.env.SECRET_KEY) {
    throw new Error("SECRET_KEY is not configured");
  }

  return jwt.sign(
    {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      img: user.img
    },
    process.env.SECRET_KEY,
    {
      expiresIn: "2h"
    }
  );
}
