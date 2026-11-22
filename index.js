import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import productRouter from "./routes/productRouter.js";
import userRouter from "./routes/userRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { authenticate } from "./middleware/auth.js";

const app = express();

if (!process.env.SECRET_KEY || !process.env.MONGODB_URL) {
  throw new Error("Required environment variables are missing");
}

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Origin not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "1mb" }));
app.use(authenticate);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/products", productRouter);
app.use("/api/users", userRouter);
app.use("/api/orders", orderRouter);

app.use((error, req, res, next) => {
  console.error("API error:", error.message);

  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      message: "Origin not allowed"
    });
  }

  res.status(500).json({
    message: "Internal server error"
  });
});

const port = Number(process.env.PORT) || 5000;

mongoose.connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("Connected to MongoDB");

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exitCode = 1;
  });
