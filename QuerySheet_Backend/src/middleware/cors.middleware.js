import cors from "cors";

import env from "../config/env.config.js";

const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (env.NODE_ENV === "development") {
  allowedOrigins.push("http://localhost:5173", "http://localhost:4173");
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("CORS_POLICY_VIOLATION"));
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};

export default cors(corsOptions);
