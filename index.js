const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient } = require('dialogflow-fulfillment');
const fundData = require('./fund_data.json');

const app = express();
app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });

  function welcome(agent) {
    agent.add('Welcome to FundBot! How can I assist you with your mutual fund investments today? You can ask about your account balance, fund details, purchases, redemptions, or general FAQs.');
  }

  function fallback(agent) {
    agent.add("I'm sorry, I didn't understand that. Could you please rephrase or ask about account balance, fund details, purchases, redemptions, or FAQs?");
  }

  function checkBalance(agent) {
    const balance = 15000.75; // Simulated (replace with database query)
    agent.add(`Your current account balance is $${balance.toFixed(2)}. Would you like to explore investment options?`);
  }

  function fundDetails(agent) {
    const fundName = agent.parameters.FundName;
    const fund = fundData[fundName];
    if (fund) {
      agent.add(`Details for ${fundName}:\n- Current NAV: $${fund.nav.toFixed(2)}\n- Performance: ${fund.performance}\n- Minimum Investment: $${fund.minInvestment}\nWould you like to invest in this fund?`);
    } else {
      agent.add(`Sorry, I couldn't find details for ${fundName}. Please check the fund name and try again.`);
    }
  }

  function purchaseFund(agent) {
    const fundName = agent.parameters.FundName;
    const amount = parseFloat(agent.parameters.amount);
    const fund = fundData[fundName];
    if (!fund) {
      agent.add(`Sorry, I couldn't find ${fundName}. Please check the fund name and try again.`);
    } else if (amount < fund.minInvestment) {
      agent.add(`The minimum investment for ${fundName} is $${fund.minInvestment}. Please specify a higher amount.`);
    } else {
      agent.add(`Your purchase of $${amount} in ${fundName} has been processed successfully. You'll receive a confirmation soon.`);
    }
  }

  function redeemFund(agent) {
    const fundName = agent.parameters.FundName;
    const amount = parseFloat(agent.parameters.amount);
    const fund = fundData[fundName];
    if (!fund) {
      agent.add(`Sorry, I couldn't find ${fundName}. Please check the fund name and try again.`);
    } else {
      agent.add(`Your redemption of $${amount} from ${fundName} has been processed successfully. The amount will be credited to your account soon.`);
    }
  }

  function faqs(agent) {
    const query = agent.query.toLowerCase();
    if (query.includes('what are mutual funds')) {
      agent.add('Mutual funds are investment vehicles that pool money from multiple investors to purchase a diversified portfolio of stocks, bonds, or other securities.');
    } else if (query.includes('how do i invest')) {
      agent.add('To invest in mutual funds, you can start by selecting a fund, specifying an investment amount, and completing the purchase through our platform.');
    } else if (query.includes('what is nav')) {
      agent.add('NAV (Net Asset Value) is the per-unit value of a mutual fund, calculated by dividing the total value of the fund’s assets by the number of units outstanding.');
    } else {
      agent.add('I can answer questions about mutual funds, investing, or NAV. Please ask your question again or try something specific!');
    }
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('Check Balance', checkBalance);
  intentMap.set('Fund Details', fundDetails);
  intentMap.set('Purchase Fund', purchaseFund);
  intentMap.set('Redeem Fund', redeemFund);
  intentMap.set('FAQs', faqs);

  agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});