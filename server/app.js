require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const config = require('./config/config');

const users = require('./routes/users');
const auth = require('./routes/auth');
const common = require('./routes/common');
const property = require('./routes/property');
const email = require('./routes/email');

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};

const validateRuntimeConfig = () => {
  if (!config.secretKey) {
    throw new Error('JWT_SECRET is required');
  }

  if (String(config.secretKey).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
};

const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'uploads')));
  app.use(cors(corsOptions));

  app.get('/', (req, res) => { res.status(200).send('Success'); });

  app.use('/api/user', users);
  app.use('/api/auth', auth);
  app.use('/api/common', common);
  app.use('/api/property', property);
  app.use('/api/email', email);

  return app;
};

const startServer = async ({ port = process.env.PORT || 5001 } = {}) => {
  validateRuntimeConfig();
  await mongoose.connect(config.localDB);

  const app = createApp();
  const server = http.createServer(app);

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
      resolve({ app, server });
    });
  });
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startServer,
  validateRuntimeConfig,
};
