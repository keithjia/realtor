const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userM = require("../models/users");
const { secretKey, jwtIssuer, jwtAudience, jwtExpiresIn } = require("../config/config");

module.exports = {
  userLogin: async (req, res) => {
    try {
      let loginType;

      if (req.body.emailPhone == "" || req.body.password == "") {
        return res.status(400).json({ message: "Provide all Credentials" });
      }

      if (isNaN(req.body.emailPhone)) loginType = "email";
      else loginType = "phoneNo";

      const data = await userM
        .findOne()
        .where(loginType, req.body.emailPhone)
        .select("+password");

      if (!data) {
        return res.status(401).json({ message: "Invalid Credentials2" });
      }

      const passMatch = await bcrypt.compare(req.body.password, data.password);

      if (!passMatch) {
        return res.status(401).json({ message: "Invalid Credentials1" });
      }

      if (!secretKey) {
        return res.status(500).json({ message: "JWT configuration is missing" });
      }

      let jwtData = {
        _id: data["_id"],
        fname: data["fname"],
        lname: data["lname"],
        email: data["email"],
        isAdmin: data["isAdmin"]
      };
      var token = jwt.sign(
        { user: jwtData },
        secretKey,
        {
          expiresIn: jwtExpiresIn,
          issuer: jwtIssuer,
          audience: jwtAudience,
          algorithm: "HS256",
          subject: String(data["_id"])
        }
      );

      return res
        .status(200)
        .json({ message: "Login Successful", token: token });
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  userRegistration: async (req, res) => {
    try {
      const users = new userM();
      users.fname = req.body.fname;
      users.lname = req.body.lName;
      users.email = req.body.email;
      users.phoneNo = req.body.phoneNo;
      users.state = req.body.state;
      users.city = req.body.city;
      users.pincode = req.body.pincode;
      users.userType = req.body.user_type;
      users.createdOn = new Date();
      users.password = await bcrypt.hash(req.body.password, 10);

      const data = await users.save();

      return res
        .status(200)
        .json({ message: "User Added Successfully", id: data._id });
    } catch (err) {
      return res.status(400).send(err);
    }
  },
  userList: async (req, res) => {
    try {
      const { limit, skip } = require("../providers/helper").getPagination(req.query);
      const data = await userM.find().select("-password").limit(limit).skip(skip);
      return res.status(200).json({ message: "Success", data });
    } catch (err) {
      return res.status(400).json({ message: "Something Went Wrong", data: err });
    }
  },
  changePass: async (req, res) => {
    try {
      const authenticatedUser = req.user || {};
      const targetUserId = String(req.body._id || "");
      const authenticatedUserId = String(authenticatedUser._id || "");

      if (!targetUserId) {
        return res.status(400).json({ message: "User id is required" });
      }

      if (!authenticatedUser.isAdmin && authenticatedUserId !== targetUserId) {
        return res.status(403).json({ message: "Not authorized to change this password" });
      }

      const targetUser = await userM.findOne({ _id: req.body._id });

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const hash = await bcrypt.hash(req.body.password, 10);
      const resp = await userM.updateOne({ _id: req.body._id }, { password: hash });

      return res
        .status(200)
        .json({
          message: "Password Changed Successfully",
          id: resp
        });
    } catch (err) {
      return res.status(400).json({ message: "Something Went Wrong", data: err });
    }
  }
};
