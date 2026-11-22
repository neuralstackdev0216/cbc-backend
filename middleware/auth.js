
import jwt from "jsonwebtoken";
import User from "../models/user.js";

export async function authenticate(req, res, next) {
  const authorization = req.get("Authorization");

  if (!authorization) {
    return next();
  }

  const match = /^Bearer (.+)$/i.exec(authorization);

  if (!match) {
    return res.status(401).json({
      message: "Invalid authorization header"
    });
  }

  try {
    const decoded = jwt.verify(
      match[1],
      process.env.SECRET_KEY,
      { algorithms: ["HS256"] }
    );

    if (!decoded.email) {
      return res.status(401).json({
        message: "Invalid token payload"
      });
    }

    const user = await User.findOne({
      email: decoded.email
    });

    if (!user || user.isBlocked) {
      return res.status(403).json({
        message: "Account unavailable or blocked"
      });
    }

    req.user = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      img: user.img
    };

    next();
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return res.status(401).json({
        message: "Session expired or invalid. Please log in."
      });
    }

    next(error);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Please log in"
    });
  }

  next();
}
