function errorHandler(err, req, res, next) {
  // If response has already started streaming, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // MySQL specific errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with this unique identifier already exists';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    statusCode = 400;
    message = 'Referenced related record does not exist';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    statusCode = 400;
    message = 'Cannot delete or update this record because related records depend on it';
  } else if (err.code === 'ER_BAD_FIELD_ERROR') {
    statusCode = 400;
    message = 'Invalid field in database query';
  }

  // Mongoose specific errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid format for field: ${err.path}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  }

  // Multer errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds allowed size limit (max 5MB)';
    } else {
      message = err.message;
    }
  }

  const response = {
    success: false,
    message,
    errors: errors || undefined,
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
