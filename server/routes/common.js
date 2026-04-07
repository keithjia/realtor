const express = require('express');
var app = express();

var commonController = require('../controllers/common.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');

var router = express.Router();

const lookupRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many lookup requests'
});

router.route('/state')
  .get(commonController.getStateList)
  .post(requireAdmin, commonController.addState)

router.route('/cities')
  .get(commonController.getAllCities)
  .post(requireAdmin, commonController.addCity)

router.get('/cities/:state_id', commonController.getCityList)

router.delete('/city/:cityId', requireAdmin, commonController.removeCity)

router.get('/checkemail-availability/email/:email', requireAuth, lookupRateLimit, commonController.checkemailAvailability)

module.exports = router;
