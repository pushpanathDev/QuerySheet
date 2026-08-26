import { Router } from "express";

import authController from "../../controllers/auth.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";
import { authLimiter } from "../../middleware/rateLimit.middleware.js";
import { validateBody } from "../../middleware/validate.middleware.js";
import {
  forgotPasswordSchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordSchema,
} from "../../schemas/auth.schema.js";

const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post(
  "/register",
  validateBody(registerBodySchema),
  authController.register,
);

authRouter.post(
  "/login",
  validateBody(loginBodySchema),
  authController.login,
);

authRouter.post("/logout", authMiddleware, authController.logout);

authRouter.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);

authRouter.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

export default authRouter;
