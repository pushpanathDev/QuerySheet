import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const createSessionDocument = ({
  sessionId,
  userId,
  idTokenHash,
  deviceInfo,
}) => ({
  sessionId,
  userId,
  idTokenHash,
  deviceInfo: {
    userAgent: deviceInfo?.userAgent ?? "unknown",
    ip: deviceInfo?.ip ?? "unknown",
    platform: deviceInfo?.platform ?? "unknown",
  },
  isActive: true,
  createdAt: FieldValue.serverTimestamp(),
  expiresAt: Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)),
  lastActivityAt: FieldValue.serverTimestamp(),
  schemaVersion: 1,
});
