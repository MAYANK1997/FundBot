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

       console.log('Webhook Request:', JSON.stringify(req.body, null, 2));
       const userId = req.body.session.split('/').pop();
       console.log('User ID:', userId);

       async function welcome(agent) {
         try {
           console.log('Welcome Intent Triggered');
           const user = await portfolioDb.getUser(userId);
           const confirmAccount = agent.parameters.confirmAccount?.toLowerCase();
           const userName = agent.parameters.userName;
           const mobileNumber = agent.parameters.mobileNumber;
           const userAge = parseInt(agent.parameters.userAge);
           const userEmail = agent.parameters.userEmail;
           console.log('Parameters:', { confirmAccount, userName, mobileNumber, userAge, userEmail });

           // Contexts
           const confirmationContext = agent.getContext('awaiting_account_confirmation');
           const nameContext = agent.getContext('awaiting_name');
           const mobileContext = agent.getContext('awaiting_mobile');
           const ageContext = agent.getContext('awaiting_age');
           const emailContext = agent.getContext('awaiting_email');
           console.log('Contexts:', { confirmationContext, nameContext, mobileContext, ageContext, emailContext });

           // Store user details in context parameters for persistence
           let userDetails = agent.getContext('user_details')?.parameters || {};
           if (userName) userDetails.name = userName;
           if (mobileNumber) userDetails.mobile = mobileNumber;
           if (userAge) userDetails.age = userAge;
           if (userEmail) userDetails.email = userEmail;
           agent.setContext({
             name: 'user_details',
             lifespan: 10,
             parameters: userDetails
           });

           // Existing user
           if (user) {
             const portfolio = await portfolioDb.getPortfolioBalance(userId, fundData);
             agent.add(`Welcome back, ${user.name || 'there'}! Your portfolio: Cash Balance: $${portfolio.cashBalance.toFixed(2)}, Total Value: $${portfolio.totalBalance.toFixed(2)}. Try "Show my investments" or "Invest in a fund."`);
             agent.setContext({ name: 'welcome_greeting', lifespan: 5 });
             console.log('Existing User:', userId);
             return;
           }

           // Handle email
           if (emailContext && userEmail) {
             if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
               agent.add('Please provide a valid email address (e.g., john.doe@example.com).');
               agent.setContext({ name: 'awaiting_email', lifespan: 2 });
               return;
             }
             userDetails.email = userEmail;
             // Create account
             await portfolioDb.createOrUpdateUser(userId, 10000.00, userDetails);
             agent.add(`Welcome, ${userDetails.name || 'there'}! Your account has been created with a $10,000 initial balance. Try saying, "Invest in Growth Fund" or "Show my investments."`);
             agent.setContext({ name: 'welcome_greeting', lifespan: 5 });
             agent.setContext({ name: 'user_details', lifespan: 0 }); // Clear details
             console.log('Account Created for:', userId, userDetails);
             return;
           }

           // Handle age
           if (ageContext && userAge) {
             if (isNaN(userAge) || userAge < 18 || userAge > 100) {
               agent.add('Please provide a valid age between 18 and 100.');
               agent.setContext({ name: 'awaiting_age', lifespan: 2 });
               return;
             }
             userDetails.age = userAge;
             agent.add('What is your email address?');
             agent.setContext({ name: 'awaiting_email', lifespan: 2 });
             return;
           }

           // Handle mobile
           if (mobileContext && mobileNumber) {
             if (!/^\d{10}$/.test(mobileNumber)) {
               agent.add('Please provide a valid 10-digit mobile number (e.g., 9876543210).');
               agent.setContext({ name: 'awaiting_mobile', lifespan: 2 });
               return;
             }
             userDetails.mobile = mobileNumber;
             agent.add('What is your age?');
             agent.setContext({ name: 'awaiting_age', lifespan: 2 });
             return;
           }

           // Handle name
           if (nameContext && userName) {
             if (!userName || userName.length < 2) {
               agent.add('Please provide a valid full name.');
               agent.setContext({ name: 'awaiting_name', lifespan: 2 });
               return;
             }
             userDetails.name = userName;
             agent.add('What is your mobile number?');
             agent.setContext({ name: 'awaiting_mobile', lifespan: 2 });
             return;
           }

           // Handle confirmation
           if (confirmationContext && confirmAccount) {
             if (['yes', 'sure', 'okay', 'ok', 'confirm'].includes(confirmAccount)) {
               agent.add('Great! Let’s set up your account. What is your full name?');
               agent.setContext({ name: 'awaiting_name', lifespan: 2 });
               console.log('Confirmation Received:', userId);
               return;
             } else {
               agent.add('Account creation cancelled. Say "Get started" to try again.');
               agent.setContext({ name: 'awaiting_account_confirmation', lifespan: 2 });
               console.log('Account Creation Cancelled');
               return;
             }
           }

           // New user prompt
           agent.add(`Hello, there! You're new here. Create an account to start investing? Say "Yes" or "Sure."`);
           agent.setContext({ name: 'awaiting_account_confirmation', lifespan: 2 });
           console.log('New User Prompted:', userId);
         } catch (error) {
           console.error('Welcome Error:', error);
           agent.add(`Error: ${error.message}. Try again.`);
         }
       }

       async function purchaseFund(agent) {
         try {
           console.log('Purchase Fund Intent Triggered');
           const fundName = agent.parameters.FundName;
           const amount = parseFloat(agent.parameters.amount);
           console.log('Purchase Parameters:', { fundName, amount });
           const fund = fundData[fundName];
           if (!fund) {
             agent.add(`Couldn't find ${fundName}. Check the name.`);
             console.log('Fund Not Found:', fundName);
             return;
           }
           if (isNaN(amount) || amount <= 0) {
             agent.add('Specify a valid positive amount.');
             console.log('Invalid Amount:', amount);
             return;
           }
           if (amount < fund.minInvestment) {
             agent.add(`Minimum investment for ${fundName} is $${fund.minInvestment}.`);
             console.log('Below Min Investment:', amount, fund.minInvestment);
             return;
           }
           const user = await portfolioDb.getUser(userId);
           if (!user) {
             agent.add('No account found. Say "Get started" to create one.');
             console.log('User Not Found:', userId);
             return;
           }
           const { units, remainingBalance } = await portfolioDb.investInFund(userId, fundName, amount, fund.nav);
           agent.add(`Purchased ${units.toFixed(2)} units of ${fundName} for $${amount.toFixed(2)}. Cash balance: $${remainingBalance.toFixed(2)}.`);
           console.log('Purchase Successful:', { units, remainingBalance });
         } catch (error) {
           console.error('Purchase Error:', error);
           agent.add(`Error investing: ${error.message}`);
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

       async function redeemFund(agent) {
         try {
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
       intentMap.set('Purchase Fund', purchaseFund);
       intentMap.set('Get Investments', getInvestments);
       intentMap.set('Check Balance', checkBalance);
       intentMap.set('Fund Details', fundDetails);
       intentMap.set('Redeem Fund', redeemFund);
       intentMap.set('FAQs', faqs);
       intentMap.set('Default Fallback Intent', faqs);

       agent.handleRequest(intentMap);
  
});

// Mount router at /.netlify/functions/index
app.use('/.netlify/functions/index', router);

module.exports.handler = serverless(app);
