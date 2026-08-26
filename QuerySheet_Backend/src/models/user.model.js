import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const createUserDocument = ({
  uid,
  email,
  displayName,
  photoURL = null,
  provider,
}) => ({
  uid,
  email: email.toLowerCase().trim(),
  displayName,
  photoURL,
  provider,
  accountStatus: "active",
  isDeleted: false,
  preferences: {},
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
  lastLoginAt: null,
  schemaVersion: 1,
  // Ensures Timestamp usage for model-level date compatibility.
  profileVersionAt: Timestamp.fromDate(new Date()),
});
