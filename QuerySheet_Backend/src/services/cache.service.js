import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "../config/firebase.config.js";

const usersCollection = () => db.collection("users");
const saveAnalysis = async (uid, analysisId, document) => {
  await usersCollection()
    .doc(uid)
    .collection("analyses")
    .doc(analysisId)
    .set(document);
};

const updateAnalysis = async (uid, analysisId, partial) => {
  await usersCollection()
    .doc(uid)
    .collection("analyses")
    .doc(analysisId)
    .update({
      ...partial,
      updatedAt: FieldValue.serverTimestamp(),
    });
};

const getAnalysis = async (uid, analysisId) => {
  const snapshot = await usersCollection()
    .doc(uid)
    .collection("analyses")
    .doc(analysisId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data();
};

const deleteAnalysis = async (uid, analysisId) => {
  const analysisRef = usersCollection()
    .doc(uid)
    .collection("analyses")
    .doc(analysisId);

  const messagesSnapshot = await analysisRef.collection("messages").get();

  if (!messagesSnapshot.empty) {
    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  await analysisRef.delete();
};

const getAllAnalyses = async (uid) => {
  const snapshot = await usersCollection()
    .doc(uid)
    .collection("analyses")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => doc.data());
};

const saveChatMessage = async (uid, analysisId, messageId, messageDocument) => {
  await usersCollection()
    .doc(uid)
    .collection("analyses")
    .doc(analysisId)
    .collection("messages")
    .doc(messageId)
    .set(messageDocument);
};

const getChatHistory = async (uid, analysisId) => {
  const snapshot = await usersCollection()
    .doc(uid)
    .collection("analyses")
    .doc(analysisId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  return snapshot.docs.map((doc) => doc.data());
};

const getCachedInsights = async (uid, dataHash) => {
  const cacheRef = usersCollection().doc(uid).collection("insightCache").doc(dataHash);
  const snapshot = await cacheRef.get();

  if (!snapshot.exists) {
    const missError = new Error("Insight cache miss");
    missError.code = "INSIGHT_CACHE_MISS";
    throw missError;
  }

  const cacheData = snapshot.data();
  const expiresAt = cacheData?.expiresAt?.toDate?.();

  if (!expiresAt || expiresAt <= new Date()) {
    await cacheRef.delete();
    return null;
  }

  await cacheRef.update({
    hitCount: FieldValue.increment(1),
    lastHitAt: FieldValue.serverTimestamp(),
  });

  return {
    insights: cacheData.insights,
    cached: true,
  };
};

const setCachedInsights = async (uid, dataHash, insights) => {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 86400000));
  await usersCollection().doc(uid).collection("insightCache").doc(dataHash).set({
    dataHash,
    insights,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    hitCount: 0,
    schemaVersion: 1,
  });
};

// Backward-compat alias used by chat.service.js
const appendChatMessage = saveChatMessage;

export default {
  saveAnalysis,
  updateAnalysis,
  getAnalysis,
  deleteAnalysis,
  getAllAnalyses,
  saveChatMessage,
  appendChatMessage,
  getChatHistory,
  getCachedInsights,
  setCachedInsights,
};
