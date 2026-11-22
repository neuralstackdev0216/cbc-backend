
import User from "../models/user.js";
import OTP from "../models/otp.js";
import bcrypt from "bcrypt";
import axios from "axios";
import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

import { generateToken } from "../utils/generateToken.js";
import { sendMail } from "../utils/mailer.js";

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128;

function otpHash(email, otp) {
  return createHmac("sha256", process.env.SECRET_KEY)
    .update(`${email}:${otp}`)
    .digest("hex");
}

function publicUser(user) {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    img: user.img
  };
}

export async function createUser(req, res) {
  try {
    const {
      firstName,
      lastName,
      password
    } = req.body;

    const email = normalizeEmail(req.body.email);
    const role = req.body.role || "customer";

    if (
      !validEmail(email) ||
      !String(firstName || "").trim() ||
      !String(lastName || "").trim() ||
      !validPassword(password)
    ) {
      return res.status(400).json({
        message: "Invalid registration details. Password must contain 8-128 characters."
      });
    }

    if (!["customer", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid user role"
      });
    }

    if (role === "admin" && req.user?.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can create admin accounts"
      });
    }

    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      email,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      password: hashedPassword,
      role
    });

    return res.status(201).json({
      message: "User created successfully"
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    console.error("Registration error:", error.message);
    return res.status(500).json({
      message: "Registration failed"
    });
  }
}

export async function loginUser(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!validEmail(email) || typeof password !== "string") {
      return res.status(400).json({
        message: "Valid email and password are required"
      });
    }

    const user = await User.findOne({ email });

    if (!user || user.isBlocked) {
      return res.status(401).json({
        message: "Invalid credentials or account unavailable"
      });
    }

    const matches = await bcrypt.compare(password, user.password);

    if (!matches) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    return res.json({
      message: "Login successful",
      token: generateToken(user),
      role: user.role
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Login failed"
    });
  }
}

export async function loginWithGoogle(req, res) {
  try {
    const accessToken = req.body.accessToken;

    if (typeof accessToken !== "string" || !accessToken) {
      return res.status(400).json({
        message: "Google access token is required"
      });
    }

    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        timeout: 10000
      }
    );

    const profile = response.data;

    if (!profile.email || profile.email_verified !== true) {
      return res.status(401).json({
        message: "Google email is not verified"
      });
    }

    const email = normalizeEmail(profile.email);
    let user = await User.findOne({ email });

    if (!user) {
      // A random unusable password prevents ordinary password login.
      const randomPassword =
        cryptoRandomPassword();

      try {
        user = await User.create({
          email,
          firstName: profile.given_name || "Google",
          lastName: profile.family_name || "User",
          password: await bcrypt.hash(randomPassword, 12),
          role: "customer",
          img: profile.picture || undefined
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ email });
      }
    }

    if (!user || user.isBlocked) {
      return res.status(403).json({
        message: "Account unavailable or blocked"
      });
    }

    return res.json({
      message: "Login successful",
      token: generateToken(user),
      role: user.role
    });
  } catch (error) {
    console.error("Google authentication error:", error.message);
    return res.status(401).json({
      message: "Google authentication failed"
    });
  }
}

function cryptoRandomPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < 40; i++) {
    result += chars[randomInt(chars.length)];
  }

  return result;
}

export async function sendOTP(req, res) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!validEmail(email)) {
      return res.status(400).json({
        message: "Valid email is required"
      });
    }

    const genericMessage =
      "If the account exists, a reset code will be sent.";

    const user = await User.findOne({ email });

    if (!user || user.isBlocked) {
      return res.json({ message: genericMessage });
    }

    const existing = await OTP.findOne({ email });

    if (
      existing &&
      Date.now() - existing.createdAt.getTime() < 60000
    ) {
      return res.status(429).json({
        message: "Please wait before requesting another code"
      });
    }

    const code = String(randomInt(100000, 1000000));

    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          otpHash: otpHash(email, code),
          attempts: 0,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          createdAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    const sent = await sendMail({
      to: email,
      subject: "SkyRek password reset",
      text: `Your password reset code is ${code}. It expires in 10 minutes.`
    });

    if (!sent) {
      await OTP.deleteOne({
        email,
        otpHash: otpHash(email, code)
      });

      return res.status(503).json({
        message: "Unable to send reset email"
      });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error("OTP request error:", error.message);
    return res.status(500).json({
      message: "Unable to process password reset request"
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.otp || "");
    const password = req.body.password;

    if (
      !validEmail(email) ||
      !/^\d{6}$/.test(code) ||
      !validPassword(password)
    ) {
      return res.status(400).json({
        message: "Invalid reset details"
      });
    }

    const record = await OTP.findOneAndUpdate(
      {
        email,
        attempts: { $lt: 5 },
        expiresAt: { $gt: new Date() }
      },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    if (!record) {
      return res.status(400).json({
        message: "Code expired, invalid, or attempts exceeded"
      });
    }

    const supplied = Buffer.from(otpHash(email, code), "hex");
    const expected = Buffer.from(record.otpHash, "hex");

    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return res.status(400).json({
        message: "Invalid reset code"
      });
    }

    // Consume the OTP before changing the password.
    const consumed = await OTP.findOneAndDelete({
      _id: record._id,
      otpHash: record.otpHash,
      expiresAt: { $gt: new Date() }
    });

    if (!consumed) {
      return res.status(400).json({
        message: "Reset code is no longer valid"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const updated = await User.updateOne(
      { email, isBlocked: false },
      { $set: { password: hashedPassword } }
    );

    if (updated.matchedCount !== 1) {
      return res.status(400).json({
        message: "Account unavailable"
      });
    }

    return res.json({
      message: "Password reset successfully"
    });
  } catch (error) {
    console.error("Password reset error:", error.message);
    return res.status(500).json({
      message: "Password reset failed"
    });
  }
}

export function getUser(req, res) {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  return res.json(publicUser(req.user));
}

export function isAdmin(req) {
  return req.user?.role === "admin";
}

export async function getAllUsers(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: "Not authorized"
    });
  }

  try {
    const users = await User.find().select("-password");

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch users"
    });
  }
}

export async function changeUserBlockStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: "Not authorized"
    });
  }

  if (typeof req.body.isBlocked !== "boolean") {
    return res.status(400).json({
      message: "isBlocked must be true or false"
    });
  }

  try {
    const email = normalizeEmail(req.params.email);
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Admin accounts cannot be blocked"
      });
    }

    user.isBlocked = req.body.isBlocked;
    await user.save();

    return res.json({
      message: user.isBlocked ? "User blocked" : "User unblocked"
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update user"
    });
  }
}
