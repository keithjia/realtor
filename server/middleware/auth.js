const jwt = require("jsonwebtoken");

const { secretKey, jwtIssuer, jwtAudience } = require("../config/config");

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return req.headers["x-access-token"] || null;
};

const requireAuth = (req, res, next) => {
  if (!secretKey) {
    return res.status(500).json({ message: "JWT configuration is missing" });
  }

  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, secretKey, {
      algorithms: ["HS256"],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });
    req.user = payload.user || payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  return requireAuth(req, res, () => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    return next();
  });
};

const requireSelfOrAdmin = (getTargetUserId) => (req, res, next) => {
  return requireAuth(req, res, () => {
    const targetUserId = String(getTargetUserId(req) || "");
    const authenticatedUserId = String((req.user && req.user._id) || "");

    if (!targetUserId) {
      return res.status(400).json({ message: "User scope is required" });
    }

    if (req.user && req.user.isAdmin) {
      return next();
    }

    if (authenticatedUserId !== targetUserId) {
      return res.status(403).json({ message: "Not authorized to access this user scope" });
    }

    return next();
  });
};

const requireScopedUserQueryOrAdmin = (keys) => (req, res, next) => {
  const scopedKey = keys.find((key) => req.query[key]);

  if (!scopedKey) {
    return next();
  }

  return requireAuth(req, res, () => {
    if (req.user && req.user.isAdmin) {
      return next();
    }

    const authenticatedUserId = String((req.user && req.user._id) || "");
    const requestedUserId = String(req.query[scopedKey] || "");

    if (authenticatedUserId !== requestedUserId) {
      return res.status(403).json({ message: "Not authorized to access this user scope" });
    }

    return next();
  });
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
  requireScopedUserQueryOrAdmin,
};
