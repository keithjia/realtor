var users = require('../models/users');

module.exports = {
  getUserDetails: (req, res) => {
    users.findOne({ _id: req.params.userId })
      .select('-password')
      .populate('city', 'name')
      .populate('state', 'name')
      .exec((err, result) => {
        if (err)
          res.status(400).send(err);
        else {
          res.status(200).send(result);
        }
      });
  }
}
