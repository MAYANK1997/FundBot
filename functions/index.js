// functions/express-api.js
const express = require('express');
const serverless = require('serverless-http');

const app = express();
const router = express.Router();

router.get('/data', (req, res) => {
  res.json({ message: "Hello from Express on Netlify!", success: true });
});

app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
