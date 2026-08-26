import { Router } from "express";

import userController from "../../controllers/user.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import { preferencesSchema } from "../../schemas/user.schema.js";

const userRouter = Router();

userRouter.get("/me", authMiddleware, userController.getProfile);
userRouter.post(
  "/preferences",
  authMiddleware,
  validateBody(preferencesSchema),
  userController.updatePreferences,
);
userRouter.delete("/me", authMiddleware, userController.deleteAccount);

export default userRouter;
