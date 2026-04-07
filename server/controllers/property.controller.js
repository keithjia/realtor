const mongoose = require('mongoose');
var Grid = require('gridfs-stream');

const helpers = require('../providers/helper');
var propertyType = require('../models/propertyTypes');
var Property = require('../models/property');

var gfs;
var conn = mongoose.connection;
conn.on('connected', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('imageMeta');
});

module.exports = {
  propertyTypeList: (req, res) => {
    propertyType.find({ is_active: true }, (err, result) => {
      if (err)
        return res.status(400).json({ message: 'Unable to fetch property types' });
      else
        res.status(200).json(result);
    });
  },
  addPropertyType: (req, res) => {
    var proptyp = new propertyType();

    proptyp.title = req.body.title;
    proptyp.type = req.body.type;
    proptyp.createdOn = Date.now();

    proptyp.save((err, result) => {
      if (err)
        return res.status(400).json({ message: 'Unable to add property type' });
      else
        res.status(200).json({ message: 'Property type added successfully', id: result._id });
    });
  },
  addNewProperty: async (req, res) => {
    let imgs = [];
    try {
      const imageStore = req.gfs || gfs;

      if (!req.user || !req.user._id) {
        throw new Error('Authenticated user is required');
      }

      if (req.files && req.files.length) {
        if (!imageStore) {
          throw new Error('Image storage backend is not available');
        }

        if (req.files.some((file) => !file.filename)) {
          throw new Error('Uploaded images could not be persisted');
        }

        req.files.forEach(ele => imgs.push(ele.filename))
      }
      var slug = await helpers.slugGenerator(req.body.title, 'title', 'property');
      req.body.slug = slug;
      req.body.type = req.body.Proptype;
      req.body.userId = req.user._id;
      req.body.cornrPlot = req.body.cornrPlot ? true : false;
      req.body.images = imgs;
      req.body.imgPath = 'properties';
      if (!req.body.isSociety) {
        req.body.flatNo = '';
        req.body.societyName = '';
      }
      const prop = new Property(req.body);
      const result = await prop.save();

      if (result && result._id && result.slug)
        res.status(200).json({ result, message: "Your property has been successfully posted" });
      else throw new Error('Something Went Wrong');
    }
    catch (err) {
      if (err && err.code === 11000 && err.keyPattern && err.keyPattern.slug) {
        return res.status(409).json({ message: 'A property with this slug already exists' });
      }

      console.log({ err });
      return res.status(400).json({ message: err.message });
    }
  },
  getUserList: (req, res) => {
    const { limit, skip } = helpers.getPagination(req.query);
    Property.find({ isActive: true, userId: req.params.userId })
      .populate('city', 'name')
      .populate('state', 'name')
      .populate('type', 'title')
      .limit(limit)
      .skip(skip)
      .exec((err, result) => {
        if (err)
          return res.status(400).json({ message: 'Unable to fetch user properties' });
        else
          res.status(200).json(result);
      });
  },
  getSingleProperty: async (req, res) => {
    try {
      const imageStore = req.gfs || gfs;
      var result = await Property.findOne({ slug: req.params.propertySlug })
        .populate('city', 'name')
        .populate('state', 'name')
        .populate('type', 'title');

      var files = [];
      if (result && result.images.length) {
        if (!imageStore) {
          throw new Error('Image storage backend is not available');
        }

        files = await imageStore.files.find({ filename: { $in: result.images } }).toArray();
      }
      if (result) res.status(200).json({ result, files });
      else throw new Error('Something Went Wrong');
    }
    catch (err) {
      res.status(400).json({ message: err.message });
    }

  },
  getFullList: (req, res) => {
    const { limit, skip } = helpers.getPagination(req.query);
    Property.find({ isActive: true })
      .populate('city', 'name')
      .populate('state', 'name')
      .populate('type', 'title')
      .populate('userId', 'name')
      .limit(limit)
      .skip(skip)
      .exec((err, result) => {
        if (err)
          return res.status(400).json({ message: 'Unable to fetch properties' });
        else
          res.status(200).json(result);
      });
  },
  markAsSold: async (req, res) => {
    try {
      const result = await Property.update({ slug: req.params.propertySlug }, { status: req.body.status });
      console.log({ result });
      if (result && result.nModified == 1) res.status(200).json({ result, message: "Property has been updated Successfully" });
      else throw new Error('Error in updating property');
    }
    catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
  filterProperties: (req, res) => {
    const { limit, skip } = helpers.getPagination(req.query);
    var query = {};
    if (req.query.propertyFor)
      query['propertyFor'] = { $in: req.query.propertyFor.split(",") }
    if (req.query.type)
      query['type'] = { $in: req.query.type.split(",") }
    if (req.query.city)
      query['city'] = { $in: req.query.city.split(",") }
    if (req.query.userId)
      query['userId'] = req.query.userId
    if (req.query.notUserId)
      query['userId'] = { $ne: req.query.notUserId }
    if (req.query.status)
      query['status'] = { $in: req.query.status.split(",") }
    console.log({ query });
    Property.find(query)
      .populate('city', 'name')
      .populate('state', 'name')
      .populate('type', 'title')
      .populate('userId', 'name')
      .limit(limit)
      .skip(skip)
      .exec((err, result) => {
        if (err)
          return res.status(400).json({ message: 'Unable to filter properties' });
        else
          res.status(200).json(result);
      });
  },
  testController: async (req, res) => {
    const testData = await Property.find({ updatedOn: { $gte: '2019-04-01' } })
    console.log({ testData });
    return res.send(testData);
  },
  showGFSImage: (req, res) => {
    const imageStore = req.gfs || gfs;

    if (!imageStore) {
      return res.status(503).json({
        err: 'Image storage backend is not available'
      });
    }

    imageStore.files.findOne({ filename: req.params.filename }, (err, file) => {
      if (!file || file.length === 0) {
        return res.status(404).json({
          err: 'No file exists'
        });
      }
      if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
        const readstream = imageStore.createReadStream(file.filename);
        readstream.pipe(res);
      } else {
        res.status(404).json({
          err: 'Not an image'
        });
      }
    })
  }
}
