import { Router } from "express";

import analyzeController from "../../controllers/analyze.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { aiLimiter } from "../../middleware/rateLimit.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { analyzeBodySchema } from "../../schemas/analyze.schema.js";

const analyzeRouter = Router();

analyzeRouter.get("/", authMiddleware, analyzeController.listAnalyses);

analyzeRouter.post(
  "/",
  authMiddleware,
  aiLimiter,
  validateBody(analyzeBodySchema),
  analyzeController.analyze,
);

analyzeRouter.get("/:analysisId", authMiddleware, analyzeController.getAnalysis);
analyzeRouter.delete("/:analysisId", authMiddleware, analyzeController.deleteAnalysis);

export default analyzeRouter;
