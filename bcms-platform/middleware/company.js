/**
 * Ensures the authenticated user belongs to a company (i.e. is NOT a platform_admin),
 * and exposes req.companyId as a convenience for controllers.
 *
 * Mount this on every business-data route group (employees, customers, projects, etc.)
 * AFTER `authenticate`. Platform admins manage companies themselves via /api/companies
 * and have no company_id of their own, so they're blocked from these routes by design —
 * if a platform admin needs to inspect a specific company's data for support purposes,
 * that should go through a dedicated impersonation/audit flow, not this middleware.
 */
function requireCompany(req, res, next) {
  if (!req.user || !req.user.company_id) {
    return res.status(403).json({
      success: false,
      message: 'This action requires a company account. Platform admins should use /api/companies.'
    });
  }
  req.companyId = req.user.company_id;
  next();
}

module.exports = requireCompany;
