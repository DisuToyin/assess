import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { db } from "./db.js";
import { config } from "./config.js";
import { HttpError, errorHandler } from "./errors.js";
import { requireAuth } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { testsRouter } from "./routes/tests.js";
import { attemptsRouter } from "./routes/attempts.js";
import { adminRouter } from "./routes/admin.js";
export const app = express();
app.disable("x-powered-by");
if (config.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", (req, _res, next) => {
  // Origin validation protects cookie-authenticated mutations, including login, from CSRF.
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin !== config.CLIENT_ORIGIN
  )
    throw new HttpError(403, "Request origin is not allowed.");
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment." },
  }),
);
app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.use("/api/tests", requireAuth, testsRouter);
app.use("/api/attempts", requireAuth, attemptsRouter);
app.use("/api/admin", requireAuth, adminRouter);
app.use((_req, _res) => {
  throw new HttpError(404, "Endpoint not found.");
});
app.use(errorHandler);
