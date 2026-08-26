export const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: res.req?.requestId,
      timestamp: new Date().toISOString(),
      version: "1.0",
    },
  });
};

export const sendError = (res, code, message, details = undefined) => {
  res.status(code).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      requestId: res.req?.requestId,
      timestamp: new Date().toISOString(),
    },
  });
};
