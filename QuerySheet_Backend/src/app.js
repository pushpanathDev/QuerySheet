import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";

import env from "./config/env.config.js";
import { db } from "./config/firebase.config.js";
import authMiddleware from "./middleware/auth.middleware.js";
import corsMiddleware from "./middleware/cors.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { globalRateLimiter } from "./middleware/rateLimit.middleware.js";
import requestIdMiddleware from "./middleware/requestId.middleware.js";
import sanitizeMiddleware from "./middleware/sanitize.middleware.js";
import v1Router from "./routes/v1/index.js";
import { sendSuccess } from "./utils/response.util.js";

const app = express();

app.use(requestIdMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://firebaseapp.com",
          "https://identitytoolkit.googleapis.com",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: {
      policy: "same-origin",
    },
    referrerPolicy: {
      policy: "no-referrer",
    },
    hsts:
      env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
          }
        : false,
    xFrameOptions: "DENY",
    xContentTypeOptions: true,
  }),
);
app.use(corsMiddleware);
app.use(cookieParser(env.SESSION_SECRET));
// 50 mb covers multi-sheet CSV payloads up to ~25 mb raw file size.
// JSON serialization of row arrays is typically 1.5–2× the raw CSV size,
// so a 25 mb file can produce a ~40–50 mb body.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(sanitizeMiddleware);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(globalRateLimiter);

app.get("/health", (req, res) => {
  void req;
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    nodeVersion: process.version,
  });
});

app.get("/api/v1/status", authMiddleware, async (req, res) => {
  let firestoreStatus = "connected";

  try {
    await db.collection("_healthcheck").limit(1).get();
  } catch {
    firestoreStatus = "error";
  }

  sendSuccess(res, {
    firestore: firestoreStatus,
    gemini: "available",
    session: "active",
  });
});

app.use("/api/v1", v1Router);

app.use(errorMiddleware);

export default app;
