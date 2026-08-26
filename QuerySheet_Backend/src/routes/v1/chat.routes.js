import { Router } from "express";

import chatController from "../../controllers/chat.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { chatLimiter } from "../../middleware/rateLimit.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { chatBodySchema } from "../../schemas/chat.schema.js";

const chatRouter = Router();

chatRouter.post(
  "/",
  authMiddleware,
  chatLimiter,
  validateBody(chatBodySchema),
  chatController.chat,
);

chatRouter.get("/history/:analysisId", authMiddleware, chatController.getHistory);

chatRouter.get("/stream", authMiddleware, chatLimiter, chatController.stream);

export default chatRouter;
