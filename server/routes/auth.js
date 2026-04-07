const express = require('express');

var app = express();

var authC = require('../controllers/auth.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

var router = express.Router();

router.post('/user/login', authC.userLogin);
router.post('/user/register', authC.userRegistration);
router.get('/admin/userList', requireAdmin, authC.userList)
router.put('/admin/changePass', requireAuth, authC.changePass)

module.exports = router;
