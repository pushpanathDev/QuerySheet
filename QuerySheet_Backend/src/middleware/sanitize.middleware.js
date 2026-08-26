import { sendError } from "../utils/response.util.js";

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
// 25 M chars covers a ~25 mb multi-sheet CSV dataset once parsed into JSON
// (12 000 rows × 16 columns × ~15 chars avg × 6 sheets ≈ 17 M chars).
const MAX_TOTAL_STRING_LENGTH = 25_000_000;
const SQL_INJECTION_PATTERN = /['"\\;].*--/;
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

class SanitizationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "SanitizationError";
  }
}

const sanitizeString = (value, accumulator) => {
  const trimmed = value.trim().replace(/\x00/g, "");

  if (SQL_INJECTION_PATTERN.test(trimmed)) {
    throw new SanitizationError(400, "Potential SQL injection detected");
  }

  accumulator.total += trimmed.length;

  if (accumulator.total > MAX_TOTAL_STRING_LENGTH) {
    throw new SanitizationError(413, "Payload Too Large");
  }

  return trimmed;
};

const sanitizeValue = (value, accumulator) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, accumulator));
  }

  if (value && typeof value === "object") {
    const sanitized = {};

    Object.entries(value).forEach(([key, nested]) => {
      if (BLOCKED_KEYS.has(key)) {
        return;
      }

      sanitized[key] = sanitizeValue(nested, accumulator);
    });

    return sanitized;
  }

  if (typeof value === "string") {
    return sanitizeString(value, accumulator);
  }

  return value;
};

const sanitizeMiddleware = (req, res, next) => {
  try {
    const accumulator = { total: 0 };

    if (METHODS_WITH_BODY.has(req.method) && req.body) {
      req.body = sanitizeValue(req.body, accumulator);
    }

    if (req.query) {
      const sanitizedQuery = sanitizeValue(req.query, accumulator);
      Object.keys(req.query).forEach((key) => delete req.query[key]);
      Object.assign(req.query, sanitizedQuery);
    }

    if (req.params) {
      const sanitizedParams = sanitizeValue(req.params, accumulator);
      Object.keys(req.params).forEach((key) => delete req.params[key]);
      Object.assign(req.params, sanitizedParams);
    }

    next();
  } catch (error) {
    if (error instanceof SanitizationError) {
      sendError(res, error.statusCode, error.message);
      return;
    }

    next(error);
  }
};

export default sanitizeMiddleware;
