import { sendSuccess } from "../utils/response.util.js";

const healthHandler = (_req, res) => {
  sendSuccess(res, { status: "ok" }, 200);
};

export { healthHandler };
