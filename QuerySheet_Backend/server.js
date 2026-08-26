import app from "./src/app.js";
import env from "./src/config/env.config.js";
import { db } from "./src/config/firebase.config.js";
import logger from "./src/utils/logger.util.js";

let server = null;

try {
  server = app.listen(env.PORT, () => {
    logger.info("Server started", {
      port: env.PORT,
      env: env.NODE_ENV,
      pid: process.pid,
    });
  });
} catch (error) {
  logger.error("Server failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

const gracefulShutdown = (signal) => {
  logger.info("Shutdown signal received", {
    signal,
  });

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    try {
      await db.terminate();
      logger.info("Server shutting down gracefully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
