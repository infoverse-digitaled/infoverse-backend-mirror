import express, { Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import logger from "./middleware/logger";
import setRoutes from "./routes";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3000;

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/infoverseDB";
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err: Error) => {
    console.error("MongoDB connection error:", err);
  });

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(logger);

setRoutes(app);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
