const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

const app = express();
const router = express.Router();

// Middleware to parse JSON and urlencoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// POST route to receive form data
router.post('/submit', (req, res) => {
  const message = req.body;
  console.log('Received POST data:', message);

  // Respond with the received data (or a confirmation message)
  res.json({ status: 'success', received: message });
});

// Mount router at /.netlify/functions/index
app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
