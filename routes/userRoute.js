import express from 'express'
import { createUser, loginUser, loginWithGoogle,sendOTP,resetPassword,getUser, getAllUsers, changeUserBlockStatus } from '../controllers/userController.js'
import { authLimiter, otpLimiter } from "../middleware/rateLimiter.js";
const userRouter=express.Router()

//userRouter.post("/",createUser)
//userRouter.post("/login",loginUser)
//userRouter.post("/login/google",loginWithGoogle)
//userRouter.post("/send-otp",sendOTP)
//userRouter.post("/reset-password",resetPassword)
userRouter.post("/", authLimiter, createUser);
userRouter.post("/login", authLimiter, loginUser);
userRouter.post("/send-otp", otpLimiter, sendOTP);
userRouter.post("/reset-password", authLimiter, resetPassword);
userRouter.get("/",getUser)
userRouter.get("/all",getAllUsers)
userRouter.put("/block/:email",changeUserBlockStatus)

export default userRouter