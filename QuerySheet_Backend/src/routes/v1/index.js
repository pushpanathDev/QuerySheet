import { Router } from "express";

import analyzeRouter from "./analyze.routes.js";
import authRouter from "./auth.routes.js";
import chatRouter from "./chat.routes.js";
import userRouter from "./user.routes.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/analyze", analyzeRouter);
v1Router.use("/chat", chatRouter);
v1Router.use("/user", userRouter);

export default v1Router;
