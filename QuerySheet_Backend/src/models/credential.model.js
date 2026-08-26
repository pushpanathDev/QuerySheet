import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const createCredentialDocument = ({ userId, passwordHash }) => ({
  userId,
  passwordHash,
  failedLoginCount: 0,
  lastFailedLoginAt: null,
  lastPasswordChangeAt: FieldValue.serverTimestamp(),
  lockedUntil: null,
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  schemaVersion: 1,
  // Keep a concrete Timestamp field for deterministic TTL/index compatibility.
  passwordExpiresAt: Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
});
