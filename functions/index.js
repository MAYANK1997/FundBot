const serverless = require('serverless-http');
const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient } = require('dialogflow-fulfillment');
const fundData = require('../fund_data.json');
const portfolioDb = require('../portfolio_db');

const app = express();
const router = express.Router();

// Middleware to parse JSON and urlencoded form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// POST route to receive form data
router.post('/submit', (req, res) => {
  const message = req.body;
  console.log('Received POST data:', message);
  

  const agent = new WebhookClient({ request: req, response: res });

  function welcome(agent) {
    agent.add('Welcome to FundBot! Do you want to create an account to start investing? Say "Yes" to proceed.');
    agent.setContext({
      name: 'awaiting_account_confirmation',
      lifespan: 5,
    });
  }

  function confirmAccount(agent) {
    const confirmAccount = agent.parameters.confirmAccount;
    if (confirmAccount && confirmAccount.toLowerCase() === 'yes') {
      agent.add('Great! Let’s start with your name. What’s your full name?');
      agent.setContext({
        name: 'collecting_details',
        lifespan: 5,
      });
    } else {
      agent.add('No worries! You can say "Yes" anytime to create an account or ask about investments.');
      agent.setContext({
        name: 'awaiting_account_confirmation',
        lifespan: 5,
      });
    }
  }

  function collectDetails(agent) {
    const name = agent.parameters.name;
    const mobile = agent.parameters.mobile;
    const age = agent.parameters.age;
    const email = agent.parameters.email;
    let currentContext = agent.getContext('collecting_details');
    let userDetails = currentContext ? currentContext.parameters : {};

    if (name) userDetails.name = name;
    if (mobile) userDetails.mobile = mobile;
    if (age) userDetails.age = age;
    if (email) userDetails.email = email;

    agent.setContext({
      name: 'collecting_details',
      lifespan: 5,
      parameters: userDetails,
    });

    if (!userDetails.name) {
      agent.add('Please provide your full name.');
    } else if (!userDetails.mobile) {
      agent.add(`Thanks, ${userDetails.name}! What’s your mobile number?`);
    } else if (!userDetails.age) {
      agent.add('Got your number! How old are you?');
    } else if (!userDetails.email) {
      agent.add('Almost done! What’s your email address?');
    } else {
      agent.add(`Awesome, ${userDetails.name}! Your account is set up with mobile ${userDetails.mobile}, age ${userDetails.age}, and email ${userDetails.email}. You’re ready to invest! Ask me about investment options.`);
      agent.clearContext('collecting_details');
    }
  }

  function investmentQuery(agent) {
    agent.add('Investing is a great way to grow your wealth! Popular options include stocks, mutual funds, and ETFs. Would you like details on any specific investment type?');
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Confirm Account', confirmAccount);
  intentMap.set('Collect Details', collectDetails);
  intentMap.set('Investment Query', investmentQuery);

  agent.handleRequest(intentMap);
  
});

// Mount router at /.netlify/functions/index
app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
