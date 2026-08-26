import { FieldValue } from "firebase-admin/firestore";

export const createChatMessageDocument = ({
  messageId,
  userId,
  analysisId,
  role,
  content,
  // turnId groups the user message and its assistant reply into one logical
  // exchange. Both documents in a pair share the same turnId so the frontend
  // can pair them explicitly without relying on sort-order adjacency.
  // turnIndex: 0 = user question, 1 = assistant answer.
  turnId,
  turnIndex,
}) => ({
  messageId,
  userId,
  analysisId,
  role,
  turnId,
  turnIndex,
  content,
  createdAt: FieldValue.serverTimestamp(),
  schemaVersion: 2,
});

export const createChatDocument = createChatMessageDocument;
export default createChatMessageDocument;
