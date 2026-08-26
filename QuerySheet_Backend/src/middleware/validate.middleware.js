const validateBody = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  req.body = parsed.data;
  next();
};

const validateQuery = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.query);

  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  req.query = parsed.data;
  next();
};

const validateParams = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.params);

  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  req.params = parsed.data;
  next();
};

export { validateBody, validateQuery, validateParams };
