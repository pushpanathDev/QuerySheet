import chatService from "../services/chat.service.js";
import { sendError, sendSuccess } from "../utils/response.util.js";

const chat = async (req, res, next) => {
  try {
    const result = await chatService.sendMessage(
      req.user.uid,
      req.body.analysisId,
      req.body.message,
    );
    sendSuccess(res, result, 200);
  } catch (error) {
    if (error?.statusCode) {
      sendError(res, error.statusCode, error.message);
      return;
    }
    next(error);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const history = await chatService.getHistory(req.user.uid, req.params.analysisId);
    sendSuccess(res, { analysisId: req.params.analysisId, history }, 200);
  } catch (error) {
    next(error);
  }
};

const stream = async (req, res, next) => {
  try {
    const { analysisId, message } = req.query;

    if (!analysisId || !message) {
      sendError(res, 400, "analysisId and message query params are required");
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    for await (const text of chatService.streamMessage(
      req.user.uid,
      analysisId,
      message,
    )) {
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    next(error);
  }
};

export default {
  chat,
  getHistory,
  stream,
};
