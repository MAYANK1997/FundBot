const fs = require('fs').promises;

     const dbPath = '/tmp/portfolio_db.json';

     async function readDb() {
       try {
         const data = await fs.readFile(dbPath, 'utf8');
         return JSON.parse(data);
       } catch (error) {
         if (error.code === 'ENOENT') {
           const initialDb = { users: [] };
           await writeDb(initialDb);
           return initialDb;
         }
         console.error('Error reading database:', error);
         return { users: [] };
       }
     }

     async function writeDb(data) {
       try {
         await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
       } catch (error) {
         console.error('Error writing to database:', error);
         throw error;
       }
     }

     async function getUser(userId) {
       const db = await readDb();
       return db.users.find(user => user.userId === userId);
     }

     async function createOrUpdateUser(userId, initialBalance = 10000.00) {
       const db = await readDb();
       let user = db.users.find(user => user.userId === userId);
       if (!user) {
         user = {
           userId,
           balance: initialBalance,
           investments: []
         };
         db.users.push(user);
       }
       await writeDb(db);
       return user;
     }

     async function investInFund(userId, fundName, amount, fundNav) {
       const db = await readDb();
       const user = db.users.find(user => user.userId === userId);
       if (!user) {
         throw new Error('User not found');
       }
       if (user.balance < amount) {
         throw new Error('Insufficient balance');
       }
       const units = amount / fundNav;
       user.balance -= amount;
       user.investments.push({
         fundName,
         units,
         purchaseNav: fundNav,
         purchaseDate: new Date().toISOString().split('T')[0]
       });
       await writeDb(db);
       return { units, remainingBalance: user.balance };
     }

     async function redeemFromFund(userId, fundName, amount, currentNav) {
       const db = await readDb();
       const user = db.users.find(user => user.userId === userId);
       if (!user) {
         throw new Error('User not found');
       }
       const investment = user.investments.find(inv => inv.fundName === fundName);
       if (!investment) {
         throw new Error(`No investment found in ${fundName}`);
       }
       const unitsToRedeem = amount / currentNav;
       if (unitsToRedeem > investment.units) {
         throw new Error('Insufficient units to redeem');
       }
       investment.units -= unitsToRedeem;
       user.balance += amount;
       if (investment.units === 0) {
         user.investments = user.investments.filter(inv => inv.fundName !== fundName);
       }
       await writeDb(db);
       return { redeemedUnits: unitsToRedeem, newBalance: user.balance };
     }

     async function getPortfolioBalance(userId, fundData) {
       const user = await getUser(userId);
       if (!user) {
         throw new Error('User not found');
       }
       let investmentValue = 0;
       for (const inv of user.investments) {
         const fund = fundData[inv.fundName];
         if (fund) {
           investmentValue += inv.units * fund.nav;
         }
       }
       return {
         cashBalance: user.balance,
         investmentValue,
         totalBalance: user.balance + investmentValue
       };
     }

     module.exports = {
       getUser,
       createOrUpdateUser,
       investInFund,
       redeemFromFund,
       getPortfolioBalance
     };