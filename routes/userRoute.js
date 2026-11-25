
import express from "express";

import {
  createUser,
  loginUser,
  sendOTP,
  resetPassword,
  getUser,
  getAllUsers,
  changeUserBlockStatus,
  updateProfile,
  changePassword
} from "../controllers/userController.js";

import {
  authLimiter,
  otpLimiter
} from "../middleware/rateLimiter.js";

import {
  requireAuth
} from "../middleware/auth.js";

const userRouter = express.Router();

// Authentication
userRouter.post("/", authLimiter, createUser);
userRouter.post("/login", authLimiter, loginUser);

// Password recovery
userRouter.post("/send-otp", otpLimiter, sendOTP);
userRouter.post("/reset-password", authLimiter, resetPassword);

// Profile management
userRouter.get("/", requireAuth, getUser);

userRouter.patch(
  "/profile",
  requireAuth,
  updateProfile
);

userRouter.patch(
  "/change-password",
  requireAuth,
  authLimiter,
  changePassword
);

// Admin user management
userRouter.get(
  "/all",
  requireAuth,
  getAllUsers
);

userRouter.put(
  "/block/:email",
  requireAuth,
  changeUserBlockStatus
);

export default userRouter;
