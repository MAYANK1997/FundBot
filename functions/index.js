const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

const app = express();
const router = express.Router();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let submissions = [];

router.get('/data', (req, res) => {
  res.json(submissions);
});

router.post('/submit', (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: 'Missing name or message' });
  }
  const entry = { name, message, timestamp: new Date().toISOString() };
  submissions.push(entry);
  res.json({ success: true, entry });
});

app.use('/.netlify/functions/index', router); // Path matches function name

module.exports.handler = serverless(app);
