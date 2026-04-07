const jwt = require('jsonwebtoken');

let tokenConfig = null;

const init = (config = {}) => {
  const secretKey = config.secretKey;
  const algorithm = config.algorithm || 'HS256';

  if (!secretKey) {
    throw new Error('Token provider requires a secretKey');
  }

  tokenConfig = {
    secretKey,
    algorithm
  };

  return tokenConfig;
};

const signToken = (payload, options = {}) => {
  if (!tokenConfig) {
    throw new Error('Token provider has not been initialized');
  }

  return jwt.sign(payload, tokenConfig.secretKey, {
    algorithm: tokenConfig.algorithm,
    ...options
  });
};

module.exports = {
  init,
  signToken
};
