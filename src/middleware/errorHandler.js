const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.path}:`, err);

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: 'ValidationError',
      message: err.message,
      details: err.details || [],
    });
  }

  // SQLite unique constraint
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const field = err.message.includes('email') ? 'email' : 'username';
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: `A user with this ${field} already exists`,
    });
  }

  // Default internal server error
  res.status(err.status || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
  });
};

module.exports = { errorHandler, notFound };
