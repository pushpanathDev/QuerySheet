import userService from "../services/user.service.js";
import { sendSuccess } from "../utils/response.util.js";

const getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.uid);
    sendSuccess(res, profile, 200);
  } catch (error) {
    next(error);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const profile = await userService.updatePreferences(req.user.uid, req.body);
    sendSuccess(res, profile, 200);
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    await userService.deleteAccount(req.user.uid, {
      requestId: req.requestId,
    });
    sendSuccess(res, { message: "Account deleted permanently" }, 200);
  } catch (error) {
    next(error);
  }
};

export default {
  getProfile,
  updatePreferences,
  deleteAccount,
};
