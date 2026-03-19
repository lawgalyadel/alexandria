// ═══════════════════════════════════════
// Auth & Role-Based Access Middleware
// ═══════════════════════════════════════
// Roles hierarchy:
//   admin > managing_editor > head_of_subject > regional_editor

function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/admin/login');
    }
    res.locals.user = req.session.user;
    next();
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/admin/login');
        }
        if (!allowedRoles.includes(req.session.user.role)) {
            return res.status(403).render('admin/error', {
                title: 'Access Denied',
                message: 'You do not have permission to access this resource.',
                user: req.session.user
            });
        }
        next();
    };
}

// Check if user can publish (not regional_editor)
function canPublish(user) {
    return ['admin', 'managing_editor', 'head_of_subject'].includes(user.role);
}

// Check if user can publish for a specific subject
function canPublishSubject(user, subjectId) {
    if (user.role === 'admin' || user.role === 'managing_editor') return true;
    if (user.role === 'head_of_subject' && user.subject_id === subjectId) return true;
    return false;
}

// Check if user has full admin access
function isAdmin(user) {
    return user.role === 'admin';
}

module.exports = { requireAuth, requireRole, canPublish, canPublishSubject, isAdmin };
