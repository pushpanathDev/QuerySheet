import env from "../config/env.config.js";
import authService, { AuthServiceError } from "../services/auth.service.js";
import { sendError, sendSuccess } from "../utils/response.util.js";

const SESSION_COOKIE_NAME = "sessionId";
const SESSION_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

const buildDeviceInfo = (req) => ({
  userAgent: req.headers["user-agent"] ?? "unknown",
  ip: req.ip,
  platform: req.headers["sec-ch-ua-platform"] ?? "unknown",
});

const handleAuthError = (res, error, next) => {
  if (error instanceof AuthServiceError) {
    sendError(res, error.statusCode, error.message, { code: error.code });
    return;
  }
  next(error);
};

const register = async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;
    const { firebaseCustomToken, ...userData } = await authService.registerUser(
      email,
      password,
      displayName,
      { requestId: req.requestId },
    );
    // Include firebaseCustomToken so the frontend can call signInWithCustomToken
    // immediately, landing directly on /dashboard without a separate login step.
    sendSuccess(res, { ...userData, firebaseCustomToken }, 201);
  } catch (error) {
    handleAuthError(res, error, next);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const idToken = req.headers["x-firebase-id-token"];

    const { sessionId, user, firebaseCustomToken } = await authService.loginUser(email, password, {
      idToken,
      deviceInfo: buildDeviceInfo(req),
      requestId: req.requestId,
    });

    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      signed: true,
    });

    // firebaseCustomToken is included so the frontend can call
    // signInWithCustomToken(firebaseCustomToken) to fire onAuthStateChanged.
    // It is NOT stored anywhere — the frontend must use it immediately.
    sendSuccess(res, { ...user, firebaseCustomToken }, 200);
  } catch (error) {
    handleAuthError(res, error, next);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.invalidateSession(req.user.sessionId, "logout");
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      signed: true,
    });
    sendSuccess(res, { message: "Logged out" }, 200);
  } catch (error) {
    handleAuthError(res, error, next);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email, {
      requestId: req.requestId,
    });
    sendSuccess(res, { message: "If the account exists, a reset email has been sent." }, 200);
  } catch (error) {
    handleAuthError(res, error, next);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    sendSuccess(res, { message: "Password reset successful" }, 200);
  } catch (error) {
    handleAuthError(res, error, next);
  }
};

export default {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
};
