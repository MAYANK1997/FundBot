const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

const app = express();
const router = express.Router();

// Middleware to parse form and JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage (demo only)
let submissions = [];

// GET route to show all submissions
router.get('/data', (req, res) => {
  res.json(submissions);
});

// POST route to receive form data
router.post('/submit', (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: 'Missing name or message' });
  }

  const entry = { name, message, timestamp: new Date().toISOString() };
  submissions.push(entry);

  res.json({ success: true, entry });
});

// Route base path must match function name: "index"
app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
