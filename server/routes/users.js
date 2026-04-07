const express = require('express');

var app = express();
var userController = require('../controllers/users.controller');
const { requireAuth } = require('../middleware/auth');

var router = express.Router();

router.get('/:userId', requireAuth, userController.getUserDetails);

module.exports = router;
