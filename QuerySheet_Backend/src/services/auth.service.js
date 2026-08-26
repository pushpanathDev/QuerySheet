import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminAuth, db } from "../config/firebase.config.js";
import { createCredentialDocument } from "../models/credential.model.js";
import { createSessionDocument } from "../models/session.model.js";
import { createUserDocument } from "../models/user.model.js";
import logger from "../utils/logger.util.js";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

class AuthServiceError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = "AuthServiceError";
  }
}

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

const sendVerificationEmail = async (email, tokenOrLink, requestId) => {
  // Placeholder: integrate real email provider (SendGrid, Resend, etc.) in later phase.
  // During development, the plain reset token is logged here so it can be submitted
  // directly to POST /api/v1/auth/reset-password as the `token` field.
  logger.info("Verification email queued (stub — no real email sent)", {
    requestId,
    email,
    token: tokenOrLink,
  });
};

const findUserByEmail = async (email) => {
  const snapshot = await db
    .collection("users")
    .where("email", "==", email.toLowerCase().trim())
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, data: snapshot.docs[0].data() };
};

const invalidateUserSessions = async (uid, reason) => {
  const snapshot = await db
    .collection("authSessions")
    .where("userId", "==", uid)
    .where("isActive", "==", true)
    .get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      isActive: false,
      invalidatedAt: FieldValue.serverTimestamp(),
      invalidationReason: reason,
    });
  });

  await batch.commit();
};

const createSession = async (uid, idToken, deviceInfo) => {
  // Single-session enforcement: invalidate any previous active sessions.
  await invalidateUserSessions(uid, "new_login");

  const sessionId = randomUUID();
  const sessionDoc = createSessionDocument({
    sessionId,
    userId: uid,
    idTokenHash: hashToken(idToken),
    deviceInfo,
  });

  await db.collection("authSessions").doc(sessionId).set(sessionDoc);
  return { sessionId, expiresInMs: SESSION_TTL_MS };
};

const invalidateSession = async (sessionId, reason = "logout") => {
  if (!sessionId) {
    return;
  }

  const sessionRef = db.collection("authSessions").doc(sessionId);
  const snapshot = await sessionRef.get();

  if (!snapshot.exists) {
    return;
  }

  await sessionRef.update({
    isActive: false,
    invalidatedAt: FieldValue.serverTimestamp(),
    invalidationReason: reason,
  });
};

const registerUser = async (email, password, displayName, { requestId } = {}) => {
  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw new AuthServiceError("EMAIL_ALREADY_EXISTS", 409, "Email already registered");
  }

  const firebaseUser = await adminAuth.createUser({
    email: normalizedEmail,
    password,
    displayName,
    emailVerified: false,
  });

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  const userRef = db.collection("users").doc(firebaseUser.uid);
  const credentialRef = db.collection("userCredentials").doc(firebaseUser.uid);
  const profileRef = userRef.collection("profile").doc("data");

  const userDoc = createUserDocument({
    uid: firebaseUser.uid,
    email: normalizedEmail,
    displayName,
    photoURL: firebaseUser.photoURL ?? null,
    provider: "password",
  });

  const credentialDoc = createCredentialDocument({
    userId: firebaseUser.uid,
    passwordHash,
  });

  const batch = db.batch();
  batch.set(userRef, userDoc);
  batch.set(credentialRef, credentialDoc);
  batch.set(profileRef, {
    uid: firebaseUser.uid,
    displayName,
    bio: "",
    timezone: "UTC",
    preferredChartType: "bar",
    analysisCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });

  try {
    await batch.commit();
  } catch (error) {
    // Roll back Firebase Auth user so the account doesn't exist in a partial state.
    await adminAuth.deleteUser(firebaseUser.uid).catch((rollbackError) => {
      logger.error("Failed to roll back Firebase Auth user after batch failure", {
        requestId,
        uid: firebaseUser.uid,
        error: rollbackError?.message,
      });
    });
    throw error;
  }

  try {
    const verificationLink = await adminAuth.generateEmailVerificationLink(normalizedEmail);
    await sendVerificationEmail(normalizedEmail, verificationLink, requestId);
  } catch (error) {
    logger.warn("Failed to generate or send verification email", {
      requestId,
      uid: firebaseUser.uid,
      error: error?.message,
    });
  }

  // Generate a custom token so the frontend can call signInWithCustomToken
  // immediately after registration, firing onAuthStateChanged without a
  // separate login step. Same pattern as loginUser.
  const firebaseCustomToken = await adminAuth.createCustomToken(firebaseUser.uid);

  return {
    uid: firebaseUser.uid,
    email: normalizedEmail,
    displayName,
    firebaseCustomToken,
  };
};

const loginUser = async (
  email,
  rawPassword,
  { idToken, deviceInfo, requestId } = {},
) => {
  void requestId;
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normalizedEmail);

  if (!existingUser) {
    throw new AuthServiceError("INVALID_CREDENTIALS", 401, "Invalid email or password");
  }

  const userData = existingUser.data;

  if (userData.accountStatus !== "active" || userData.isDeleted) {
    throw new AuthServiceError(
      "ACCOUNT_INACTIVE",
      403,
      "Account is not active. Contact support.",
    );
  }

  const credentialRef = db.collection("userCredentials").doc(userData.uid);
  const credentialSnapshot = await credentialRef.get();

  if (!credentialSnapshot.exists) {
    throw new AuthServiceError("INVALID_CREDENTIALS", 401, "Invalid email or password");
  }

  const credential = credentialSnapshot.data();
  const now = new Date();
  const lockedUntil = credential.lockedUntil?.toDate?.() ?? credential.lockedUntil;

  if (lockedUntil && new Date(lockedUntil) > now) {
    throw new AuthServiceError(
      "ACCOUNT_LOCKED",
      423,
      "Account temporarily locked due to repeated failed login attempts.",
    );
  }

  const isMatch = await bcrypt.compare(rawPassword, credential.passwordHash);

  if (!isMatch) {
    const nextFailedCount = (credential.failedLoginCount ?? 0) + 1;
    const update = {
      failedLoginCount: nextFailedCount,
      lastFailedLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (nextFailedCount >= LOCKOUT_THRESHOLD) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_WINDOW_MS);
    }

    await credentialRef.update(update);
    throw new AuthServiceError("INVALID_CREDENTIALS", 401, "Invalid email or password");
  }

  await credentialRef.update({
    failedLoginCount: 0,
    lockedUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection("users").doc(userData.uid).update({
    lastLoginAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const sessionSourceToken = idToken ?? randomUUID();
  const { sessionId, expiresInMs } = await createSession(
    userData.uid,
    sessionSourceToken,
    deviceInfo,
  );

  // Generate a Firebase Custom Token so the frontend can call
  // signInWithCustomToken(firebaseCustomToken) immediately after this
  // response arrives. That call triggers onAuthStateChanged on the client,
  // bridging the backend-owned session to the Firebase client auth state.
  // Custom tokens are single-use, short-lived (1 hr) signed JWTs — safe to
  // send in the response body because the frontend consumes them instantly.
  const firebaseCustomToken = await adminAuth.createCustomToken(userData.uid);

  return {
    sessionId,
    expiresInMs,
    firebaseCustomToken,
    user: {
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName,
    },
  };
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const forgotPassword = async (email, { requestId } = {}) => {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normalizedEmail);

  if (!existingUser) {
    // Intentionally do not reveal whether the account exists.
    return { success: true };
  }

  const uid = existingUser.data.uid;

  // Generate a cryptographically secure 64-char hex token.
  // resetPasswordSchema validates min(64).max(64), so 32 random bytes → 64 hex chars is exact.
  const plainToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(plainToken);
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + RESET_TOKEN_TTL_MS));

  try {
    await db.collection("passwordResetTokens").doc(tokenHash).set({
      userId: uid,
      email: normalizedEmail,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    // sendVerificationEmail is currently a stub — logs the token so it can be
    // used manually during development. Replace with a real email provider.
    await sendVerificationEmail(normalizedEmail, plainToken, requestId);
  } catch (error) {
    logger.warn("Failed to create password reset token", {
      requestId,
      email: normalizedEmail,
      error: error?.message,
    });
  }

  return { success: true };
};

const resetPassword = async (token, newPassword) => {
  // Token issuance/verification flows through Firebase email handlers in frontend.
  // Here we only update the hashed password in userCredentials once the Firebase
  // password has been reset by the client-side flow.
  const tokenHash = hashToken(token);

  const tokenDoc = await db.collection("passwordResetTokens").doc(tokenHash).get();

  if (!tokenDoc.exists) {
    throw new AuthServiceError("INVALID_TOKEN", 400, "Invalid or expired reset token");
  }

  const tokenData = tokenDoc.data();
  const expiresAt = tokenData.expiresAt?.toDate?.() ?? tokenData.expiresAt;

  if (!expiresAt || new Date(expiresAt) < new Date()) {
    throw new AuthServiceError("EXPIRED_TOKEN", 400, "Reset token has expired");
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

  const batch = db.batch();
  batch.update(db.collection("userCredentials").doc(tokenData.userId), {
    passwordHash,
    failedLoginCount: 0,
    lockedUntil: null,
    lastPasswordChangeAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.delete(tokenDoc.ref);
  await batch.commit();

  await invalidateUserSessions(tokenData.userId, "password_reset");

  return { success: true };
};

export default {
  registerUser,
  loginUser,
  invalidateSession,
  invalidateUserSessions,
  forgotPassword,
  resetPassword,
};

export { AuthServiceError };
