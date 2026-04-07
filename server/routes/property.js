const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config/config');

const router = express.Router();
const propertyController = require('../controllers/property.controller');
const { requireAdmin, requireAuth, requireSelfOrAdmin, requireScopedUserQueryOrAdmin } = require('../middleware/auth');
const { auditAdminAction } = require('../middleware/audit');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
});

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
router.post('/type', requireAdmin, auditAdminAction('admin.property_type.create'), propertyController.addPropertyType);

router.post('/new', requireAuth, upload.array("propImages"), propertyController.addNewProperty);
router.get('/list/:userId', requireSelfOrAdmin((req) => req.params.userId), propertyController.getUserList);
router.get('/list/', propertyController.getFullList);
router.get('/single/:propertySlug', propertyController.getSingleProperty);
router.get('/showGFSImage/:filename', propertyController.showGFSImage);
router.post('/markAsSold/:propertySlug', requireAdmin, auditAdminAction('admin.property.mark_sold', {
  getTarget: (req) => String(req.params.propertySlug || '')
}), propertyController.markAsSold);

router.get('/filter', requireScopedUserQueryOrAdmin(['userId', 'notUserId']), propertyController.filterProperties);

module.exports = router;
