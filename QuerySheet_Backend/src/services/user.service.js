import { getAuth } from "firebase-admin/auth";

import { adminApp, db } from "../config/firebase.config.js";
import logger from "../utils/logger.util.js";

const getProfile = async (uid) => {
  const profileRef = db.collection("users").doc(uid);
  const profileSnapshot = await profileRef.get();

  if (!profileSnapshot.exists) {
    return {
      uid,
      preferences: {},
    };
  }

  return profileSnapshot.data();
};

const updatePreferences = async (uid, preferences) => {
  const profileRef = db.collection("users").doc(uid);

  await profileRef.set(
    {
      uid,
      preferences,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  const updatedProfile = await profileRef.get();
  return updatedProfile.data();
};

const deleteAccount = async (uid, { requestId } = {}) => {
  try {
    const userRef = db.collection("users").doc(uid);
    const analysesRef = userRef.collection("analyses");
    const analysesSnapshot = await analysesRef.get();

    // GDPR order: delete chat history before analysis docs.
    for (const analysisDoc of analysesSnapshot.docs) {
      const messagesRef = analysisDoc.ref.collection("messages");
      const messagesSnapshot = await messagesRef.get();

      for (const chatDoc of messagesSnapshot.docs) {
        await chatDoc.ref.delete();
      }

      await analysisDoc.ref.delete();
    }

    await userRef.delete();
    await getAuth(adminApp).deleteUser(uid);
  } catch (error) {
    logger.error("Failed to delete user account fully", {
      requestId,
      uid,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error("Failed to permanently delete account");
  }
};

export default {
  getProfile,
  updatePreferences,
  deleteAccount,
};
