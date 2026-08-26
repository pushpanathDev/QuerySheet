const isDevelopment = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

const writeLog = (level, message, meta = {}) => {
  if (level === "debug" && isProduction) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const serialized = isDevelopment
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);

  process.stdout.write(`${serialized}\n`);
};

const logger = {
  info(message, meta = {}) {
    writeLog("info", message, meta);
  },
  warn(message, meta = {}) {
    writeLog("warn", message, meta);
  },
  error(message, meta = {}) {
    writeLog("error", message, meta);
  },
  debug(message, meta = {}) {
    writeLog("debug", message, meta);
  },
};

export default logger;
