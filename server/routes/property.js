const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config/config');

const router = express.Router();
const propertyController = require('../controllers/property.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

let gfs;

mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFsStorage(mongoose.connection.db, {
    bucketName: 'imageMeta'
  });
});

router.use((req, res, next) => {
  req.gfs = gfs;
  next();
})

router.get('/type', propertyController.propertyTypeList);
router.post('/type', requireAdmin, propertyController.addPropertyType);

router.post('/new', requireAuth, upload.array("propImages"), propertyController.addNewProperty);
router.get('/list/:userId', propertyController.getUserList);
router.get('/list/', propertyController.getFullList);
router.get('/single/:propertySlug', propertyController.getSingleProperty);
router.get('/showGFSImage/:filename', propertyController.showGFSImage);
router.post('/markAsSold/:propertySlug', requireAdmin, propertyController.markAsSold);

router.get('/filter', propertyController.filterProperties);

module.exports = router;
