const express = require('express');
var app = express();

var commonController = require('../controllers/common.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

var router = express.Router();

router.route('/state')
  .get(commonController.getStateList)
  .post(requireAdmin, commonController.addState)

router.route('/cities')
  .get(commonController.getAllCities)
  .post(requireAdmin, commonController.addCity)

router.get('/cities/:state_id', commonController.getCityList)

router.delete('/city/:cityId', requireAdmin, commonController.removeCity)

router.get('/checkemail-availability/email/:email', requireAuth, commonController.checkemailAvailability)

module.exports = router;
