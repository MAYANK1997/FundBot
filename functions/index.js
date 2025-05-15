const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

const app = express();
const router = express.Router();

// Middleware to parse form and JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));





// POST route to receive form data
router.post('/submit', (req, res) => {

  const message = req.body;
 
  console.log(message;

  
  
  
});

// Route base path must match function name: "index"
app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
