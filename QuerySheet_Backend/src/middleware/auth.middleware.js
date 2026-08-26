import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminAuth, db } from "../config/firebase.config.js";
import env from "../config/env.config.js";
import logger from "../utils/logger.util.js";
import { sendError } from "../utils/response.util.js";

const SESSION_COOKIE_NAME = "sessionId";
const SESSION_TTL_MS = 60 * 60 * 1000;          // 1 hour — matches auth.service.js
const SESSION_REFRESH_AFTER_MS = 30 * 60 * 1000; // slide forward after 30 min of activity

const COOKIE_CLEAR_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  signed: true,
};

const authMiddleware = async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  const queryToken =
    typeof req.query?.authToken === "string" ? req.query.authToken : null;

  if (!authorizationHeader && !queryToken) {
    sendError(res, 401, "Authorization header missing or malformed");
    return;
  }

  const token =
    authorizationHeader && authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length).trim()
      : queryToken?.trim();

  if (!token) {
    sendError(res, 401, "Authorization header missing or malformed");
    return;
  }

  let firebaseUser;
  try {
    firebaseUser = await adminAuth.verifyIdToken(token, true);
  } catch (error) {
    if (error?.code === "auth/id-token-expired") {
      sendError(res, 401, "Token expired");
      return;
    }
    sendError(res, 401, "Invalid or expired token");
    return;
  }

  if (firebaseUser.email_verified !== true) {
    sendError(res, 403, "Email not verified");
    return;
  }

  req.firebaseUser = firebaseUser;

  const sessionId = req.signedCookies?.sessionId;

  if (!sessionId) {
    // If this is a OAuth / Social login (like google.com), they authenticate purely by Firebase Token since the frontend bypasses our backend login route. 
    // We allow them through.
    if (firebaseUser.firebase?.sign_in_provider === "google.com") {
      req.user = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        sessionId: "google-oauth-session",
        isAnonymous: false,
      };
      return next();
    }
    
    sendError(res, 401, "Session cookie missing");
    return;
  }

  const sessionRef = db.collection("authSessions").doc(sessionId);
  const sessionSnapshot = await sessionRef.get();

  if (!sessionSnapshot.exists) {
    sendError(res, 401, "Invalid session");
    return;
  }

  const sessionData = sessionSnapshot.data();

  // Evaluate each condition separately so the warn log tells us exactly
  // which guard triggered — critical for debugging auth issues quickly.
  const userIdMismatch   = sessionData.userId !== firebaseUser.uid;
  const notActive        = sessionData.isActive !== true;
  const missingExpiry    = !sessionData.expiresAt;
  const expired          = !missingExpiry && sessionData.expiresAt.toDate() <= new Date();

  if (userIdMismatch || notActive || missingExpiry || expired) {
    const reason = userIdMismatch ? "userId_mismatch"
                 : notActive      ? "session_inactive"
                 : missingExpiry  ? "missing_expiresAt"
                 :                  "session_expired";

    logger.warn("Session validation failed", {
      requestId: req.requestId,
      sessionId,
      uid: firebaseUser.uid,
      reason,
      // Extra detail only in development — never expose in production logs.
      ...(env.NODE_ENV === "development" && {
        sessionUserId: sessionData.userId,
        isActive:      sessionData.isActive,
        expiresAt:     sessionData.expiresAt?.toDate?.()?.toISOString?.() ?? null,
      }),
    });

    // On a userId_mismatch the browser is holding a stale cookie from a
    // different account. Clear it now so the next request gets
    // "Session cookie missing" (which the frontend can handle by redirecting
    // to login) instead of being permanently stuck in a 401 loop.
    if (userIdMismatch) {
      res.clearCookie(SESSION_COOKIE_NAME, COOKIE_CLEAR_OPTIONS);
    }

    sendError(res, 401, "Session invalid or expired");
    return;
  }

  req.user = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    sessionId,
    isAnonymous: false,
  };

  if (firebaseUser.firebase?.sign_in_provider === "anonymous") {
    req.user.isAnonymous = true;
  }

  // Sliding window session refresh.
  //
  // Once the session is older than SESSION_REFRESH_AFTER_MS (30 min), every
  // subsequent request pushes the expiry 1 hour forward — so an actively
  // working user is never kicked out mid-session. A user who closes the tab
  // and stops making requests will let the cookie expire naturally after 1hr.
  //
  // The Firestore write and Set-Cookie header are both fire-and-forget so they
  // never add latency to the request. The browser silently picks up the
  // refreshed cookie from the response headers.
  const sessionCreatedAt = sessionData.createdAt?.toDate?.() ?? new Date(0);
  const sessionAgeMs = Date.now() - sessionCreatedAt.getTime();
  const shouldRefresh = sessionAgeMs > SESSION_REFRESH_AFTER_MS;

  if (shouldRefresh) {
    const newExpiresAt = Timestamp.fromDate(new Date(Date.now() + SESSION_TTL_MS));

    sessionRef
      .update({
        expiresAt: newExpiresAt,
        lastActivityAt: FieldValue.serverTimestamp(),
      })
      .catch((error) => {
        logger.warn("Failed to slide session expiry", {
          requestId: req.requestId,
          sessionId,
          error: error?.message,
        });
      });

    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_TTL_MS,
      signed: true,
    });
  } else {
    // Session is fresh — just touch lastActivityAt, no cookie re-issue needed.
    sessionRef
      .update({
        lastActivityAt: FieldValue.serverTimestamp(),
      })
      .catch((error) => {
        logger.warn("Failed to update session lastActivityAt", {
          requestId: req.requestId,
          sessionId,
          error: error?.message,
        });
      });
  }

  next();
};

export default authMiddleware;
