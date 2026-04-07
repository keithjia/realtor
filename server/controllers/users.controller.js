var users = require('../models/users');

module.exports = {
  getUserDetails: async (req, res) => {
    try {
      const authenticatedUser = req.user || {};
      const targetUserId = String(req.params.userId || '');
      const authenticatedUserId = String(authenticatedUser._id || '');

      if (!authenticatedUser.isAdmin && authenticatedUserId !== targetUserId) {
        return res.status(403).json({ message: 'Not authorized to access this user' });
      }

      const result = await users.findOne({ _id: req.params.userId })
      .select('-password')
      .populate('city', 'name')
      .populate('state', 'name')
      
      return res.status(200).send(result);
    } catch (err) {
      return res.status(400).send(err);
    }
  }
}
