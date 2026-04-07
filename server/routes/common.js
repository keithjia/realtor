const express = require('express');
var app = express();

var commonController = require('../controllers/common.controller');
const { requireAdmin } = require('../middleware/auth');
const { auditAdminAction } = require('../middleware/audit');
const { createRateLimiter } = require('../middleware/rateLimit');

var router = express.Router();

const lookupRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many lookup requests'
});

router.route('/state')
  .get(commonController.getStateList)
  .post(requireAdmin, auditAdminAction('admin.state.create'), commonController.addState)

router.route('/cities')
  .get(commonController.getAllCities)
  .post(requireAdmin, auditAdminAction('admin.city.create'), commonController.addCity)

router.get('/cities/:state_id', commonController.getCityList)

router.delete('/city/:cityId', requireAdmin, auditAdminAction('admin.city.delete', {
  getTarget: (req) => String(req.params.cityId || '')
}), commonController.removeCity)

router.get('/checkemail-availability/email/:email', requireAdmin, lookupRateLimit, auditAdminAction('admin.user_email.lookup', {
  getTarget: (req) => String(req.params.email || '')
}), commonController.checkemailAvailability)

module.exports = router;
