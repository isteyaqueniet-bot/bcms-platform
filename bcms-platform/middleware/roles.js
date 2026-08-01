/**
 * Restricts a route to a given set of roles.
 * Usage: router.get('/x', authenticate, allowRoles('super_admin', 'admin'), handler)
 */
function allowRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = allowRoles;
