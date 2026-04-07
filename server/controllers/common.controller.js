const mongoose = require('mongoose');
var state_model = require('../models/state');
var city_model = require('../models/city');
var users = require('../models/users');
const helpers = require('../providers/helper');

module.exports = {
  getStateList: (req, res) => {
    state_model.find({ is_active: true })
      .exec((err, data) => {
        if (err)
          return res.status(400).send(err);
        return res.status(200).send(data);
      });
  },
  addState: (req, res) => {
    var state = new state_model();
    state.name = req.body.name;

    state.save((err) => {
      if (err)
        return res.send(err);
      return res.json({ message: 'State added successfully' });
    })
  },
  getAllCities: (req, res) => {
    const { limit, skip } = helpers.getPagination(req.query);
    city_model.find({ is_active: true })
      .populate('state_id', 'name')
      .limit(limit)
      .skip(skip)
      .exec((err, data) => {
        if (err)
          return res.status(400).send(err);
        return res.status(200).json(data);
      });
  },
  getCityList: (req, res) => {
    city_model.find({ state_id: req.params.state_id, is_active: true })
      .populate('state_id', 'name')
      .exec((err, data) => {
        if (err)
          return res.status(400).send(err);
        return res.status(200).json(data);
      });
  },
  addCity: async (req, res) => {
    try {
      var city = new city_model(req.body);
      const result = await city.save();
      console.log({ result });
      if (result) res.status(200).json({ message: 'City added successfully' });
      else throw new Error('Something Went Wrong');
    }
    catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
  removeCity: (req, res) => {
    city_model.remove({ _id: req.params.cityId }, (err, result) => {
      if (err)
        return res.status(400).send(err);
      return res.status(200).json({ message: 'City removed successfully', data: result });
    })
  },
  checkemailAvailability: (req, res) => {
    var email = req.params.email;

    users.find({ email: email }, (err, result) => {
      if (err)
        res.status(400).send(err);
      else if (result.length > 0)
        res.status(200).json({ response: true });
      else
        res.status(200).json({ response: false });
    });
  }
}
