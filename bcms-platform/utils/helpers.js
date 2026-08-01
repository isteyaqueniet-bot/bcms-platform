/**
 * Generates a sequential employee code, e.g. EMP-0001
 * In production, query the last used number from the DB to avoid gaps.
 */
function generateEmployeeCode(lastNumber = 0) {
  const next = lastNumber + 1;
  return `EMP-${String(next).padStart(4, '0')}`;
}

/**
 * Standard success response shape used across controllers.
 */
function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

/**
 * Standard error response shape used across controllers.
 */
function errorResponse(res, message = 'Something went wrong', statusCode = 500) {
  return res.status(statusCode).json({ success: false, message });
}

module.exports = { generateEmployeeCode, successResponse, errorResponse };
