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

  // Extract user ID from session
  const userId = req.body.session.split('/').pop();

  async function welcome(agent) {
    try {
      const user = await portfolioDb.getUser(userId);
      const userName = agent.parameters.userName || 'there';
      const confirmAccount = agent.parameters.confirmAccount?.toLowerCase();

      if (agent.getContext('awaiting_account_confirmation') && confirmAccount) {
        if (['yes', 'sure', 'okay', 'ok'].includes(confirmAccount)) {
          await portfolioDb.createOrUpdateUser(userId, 10000.00);
          agent.add(`Welcome, ${userName}! Your account has been created with a $10,000 initial balance. Try saying, "Invest in Growth Fund" or "Show my investments."`);
          agent.setContext({ name: 'welcome_greeting', lifespan: 5 });
          return;
        } else {
          agent.add('Account creation cancelled. Say "Get started" to try again.');
          return;
        }
      }

      if (user) {
        const portfolio = await portfolioDb.getPortfolioBalance(userId, fundData);
        agent.add(`Welcome back, ${userName}! Your portfolio: Cash Balance: $${portfolio.cashBalance.toFixed(2)}, Total Value: $${portfolio.totalBalance.toFixed(2)}. Try "Show my investments" or "Invest in a fund."`);
        agent.setContext({ name: 'welcome_greeting', lifespan: 5 });
        return;
      }

      agent.add(`Hello, ${userName}! You're new here. Create an account to start investing? Say "Yes" or "Sure."`);
      agent.setContext({ name: 'awaiting_account_confirmation', lifespan: 2 });
    } catch (error) {
      agent.add(`Error: ${error.message}. Try again.`);
    }
  }

  async function getInvestments(agent) {
    try {
      const user = await portfolioDb.getUser(userId);
      if (!user) {
        agent.add('No account found. Say "Get started" to create one.');
        return;
      }
      if (user.investments.length === 0) {
        agent.add('No investments yet. Explore our funds?');
        return;
      }
      let response = 'Your investments:\n';
      for (const inv of user.investments) {
        const currentNav = fundData[inv.fundName]?.nav || inv.purchaseNav;
        const currentValue = inv.units * currentNav;
        response += `- ${inv.fundName}: ${inv.units.toFixed(2)} units, Purchased at $${inv.purchaseNav.toFixed(2)}, Value: $${currentValue.toFixed(2)} (${inv.purchaseDate})\n`;
      }
      agent.add(response + 'Invest more or redeem funds?');
    } catch (error) {
      agent.add(`Error fetching investments: ${error.message}`);
    }
  }

  async function checkBalance(agent) {
    try {
      const user = await portfolioDb.getUser(userId);
      if (!user) {
        agent.add('No account found. Say "Get started" to create one.');
        return;
      }
      const portfolio = await portfolioDb.getPortfolioBalance(userId, fundData);
      agent.add(`Portfolio:\n- Cash: $${portfolio.cashBalance.toFixed(2)}\n- Investments: $${portfolio.investmentValue.toFixed(2)}\n- Total: $${portfolio.totalBalance.toFixed(2)}\nExplore investment options?`);
    } catch (error) {
      agent.add(`Error fetching balance: ${error.message}`);
    }
  }

  async function fundDetails(agent) {
    const fundName = agent.parameters.FundName;
    const fund = fundData[fundName];
    if (fund) {
      agent.add(`${fundName}:\n- NAV: $${fund.nav.toFixed(2)}\n- Performance: ${fund.performance}\n- Min Investment: $${fund.minInvestment}\nInvest in this fund?`);
    } else {
      agent.add(`Couldn't find ${fundName}. Check the name and try again.`);
    }
  }

  async function purchaseFund(agent) {
    const fundName = agent.parameters.FundName;
    const amount = parseFloat(agent.parameters.amount);
    const fund = fundData[fundName];
    if (!fund) {
      agent.add(`Couldn't find ${fundName}. Check the name.`);
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      agent.add('Specify a valid positive amount.');
      return;
    }
    if (amount < fund.minInvestment) {
      agent.add(`Minimum investment for ${fundName} is $${fund.minInvestment}.`);
      return;
    }
    try {
      const user = await portfolioDb.getUser(userId);
      if (!user) {
        agent.add('No account found. Say "Get started" to create one.');
        return;
      }
      const { units, remainingBalance } = await portfolioDb.investInFund(userId, fundName, amount, fund.nav);
      agent.add(`Purchased ${units.toFixed(2)} units of ${fundName} for $${amount.toFixed(2)}. Cash balance: $${remainingBalance.toFixed(2)}.`);
    } catch (error) {
      agent.add(`Error investing: ${error.message}`);
    }
  }

  async function redeemFund(agent) {
    const fundName = agent.parameters.FundName;
    const amount = parseFloat(agent.parameters.amount);
    const fund = fundData[fundName];
    if (!fund) {
      agent.add(`Couldn't find ${fundName}. Check the name.`);
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      agent.add('Specify a valid positive amount to redeem.');
      return;
    }
    try {
      const user = await portfolioDb.getUser(userId);
      if (!user) {
        agent.add('No account found. Say "Get started" to create one.');
        return;
      }
      const { redeemedUnits, newBalance } = await portfolioDb.redeemFromFund(userId, fundName, amount, fund.nav);
      agent.add(`Redeemed ${redeemedUnits.toFixed(2)} units of ${fundName} for $${amount.toFixed(2)}. Cash balance: $${newBalance.toFixed(2)}.`);
    } catch (error) {
      agent.add(`Error redeeming: ${error.message}`);
    }
  }

  function faqs(agent) {
    const query = agent.query.toLowerCase();
    if (query.includes('what are mutual funds')) {
      agent.add('Mutual funds pool money from investors to buy diversified portfolios of stocks, bonds, or securities.');
    } else if (query.includes('how do i invest')) {
      agent.add('Select a fund, specify an amount, and purchase through our platform.');
    } else if (query.includes('what is nav')) {
      agent.add('NAV is the per-unit value of a mutual fund, calculated as total assets divided by units outstanding.');
    } else {
      agent.add('Ask about mutual funds, investing, or NAV. Try again!');
    }
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', faqs);
  intentMap.set('Get Investments', getInvestments);
  intentMap.set('Check Balance', checkBalance);
  intentMap.set('Fund Details', fundDetails);
  intentMap.set('Purchase Fund', purchaseFund);
  intentMap.set('Redeem Fund', redeemFund);
  intentMap.set('FAQs', faqs);

  agent.handleRequest(intentMap);

  
});

// Mount router at /.netlify/functions/index
app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
