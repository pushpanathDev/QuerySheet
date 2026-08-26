import analyzeService from "../services/analyze.service.js";
import { sendError, sendSuccess } from "../utils/response.util.js";

const analyze = async (req, res, next) => {
  try {
    if (req.user.isAnonymous) {
      // Anonymous users have no persisted document to poll, so we keep the
      // synchronous path and return the full result in one shot.
      const result = await analyzeService.runAnalysis(req.user.uid, req.body, {
        isAnonymous: true,
        requestId: req.requestId,
      });
      sendSuccess(res, result, 201);
      return;
    }

    // Authenticated users: enqueue the job and return immediately so the
    // frontend can poll GET /analyze/:id without hitting HTTP timeouts on
    // long-running Gemini calls.
    const pending = await analyzeService.enqueueAnalysis(
      req.user.uid,
      req.body,
      { requestId: req.requestId },
    );
    sendSuccess(res, pending, 202);
  } catch (error) {
    if (error?.statusCode) {
      sendError(res, error.statusCode, error.message);
      return;
    }
    next(error);
  }
};

const getAnalysis = async (req, res, next) => {
  try {
    const result = await analyzeService.getAnalysis(req.user.uid, req.params.analysisId);

    if (!result) {
      sendError(res, 404, "Analysis not found");
      return;
    }

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
};

const deleteAnalysis = async (req, res, next) => {
  try {
    await analyzeService.deleteAnalysis(req.user.uid, req.params.analysisId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const listAnalyses = async (req, res, next) => {
  try {
    const results = await analyzeService.listAnalyses(req.user.uid);
    sendSuccess(res, results, 200);
  } catch (error) {
    next(error);
  }
};

export default {
  analyze,
  getAnalysis,
  deleteAnalysis,
  listAnalyses,
};
