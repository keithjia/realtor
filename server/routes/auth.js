const express = require('express');

var app = express();

var authC = require('../controllers/auth.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { auditAdminAction } = require('../middleware/audit');
const { createRateLimiter } = require('../middleware/rateLimit');

var router = express.Router();

const authRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many authentication requests'
});

router.post('/user/login', authRateLimit, authC.userLogin);
router.post('/user/register', authRateLimit, authC.userRegistration);
router.get('/admin/userList', requireAdmin, auditAdminAction('admin.user_list.view'), authC.userList)
router.put('/admin/changePass', requireAuth, authRateLimit, authC.changePass)

module.exports = router;
