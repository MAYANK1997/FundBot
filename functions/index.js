const express = require('express');
     const bodyParser = require('body-parser');
     const { WebhookClient } = require('dialogflow-fulfillment');
     const serverless = require('serverless-http');

     const fundData = require('../fund_data.json');

     const app = express();
     app.use(bodyParser.json());

     app.post('/submit', (req, res) => {

       res.json({ status: 'OK', message: 'submit-test route is working' });
       
     });

     
     module.exports.handler = serverless(app);