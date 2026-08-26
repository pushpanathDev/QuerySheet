import env from "../config/env.config.js";
import logger from "../utils/logger.util.js";

const buildErrorResponse = (req, code, message, extra = {}) => ({
  success: false,
  error: {
    code,
    message,
    ...extra,
  },
  meta: {
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  },
});

const errorMiddleware = (err, req, res, next) => {
  void next;

  logger.error("Unhandled error", {
    requestId: req.requestId,
    message: err?.message,
    stack: env.NODE_ENV === "development" ? err?.stack : undefined,
  });

  if (err?.type === "entity.parse.failed") {
    res
      .status(400)
      .json(buildErrorResponse(req, 400, "Invalid JSON body"));
    return;
  }

  if (err?.message === "CORS_POLICY_VIOLATION") {
    res
      .status(403)
      .json(buildErrorResponse(req, 403, "Forbidden: CORS policy"));
    return;
  }

  if (err?.name === "ZodError") {
    const issues = Array.isArray(err.issues)
      ? err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }))
      : [];

    res
      .status(422)
      .json(buildErrorResponse(req, 422, "Validation failed", { issues }));
    return;
  }

  if (err?.code === "auth/id-token-expired") {
    res
      .status(401)
      .json(buildErrorResponse(req, 401, "Invalid or expired token"));
    return;
  }

  res
    .status(500)
    .json(buildErrorResponse(req, 500, "Internal server error"));
};

export default errorMiddleware;
