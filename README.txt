SATVIK – Node version (orders saved to Excel automatically)

1. Install Node.js 18+ (nodejs.org). In this folder run:
      npm install
      npm start
2. Open http://localhost:3000
3. Every confirmed order is added to data/Satvik_Orders.xlsx
   (sheets: Customers, Orders, Order_Items; repeat customers are matched by mobile).
4. Download anytime: http://localhost:3000/admin/orders.xlsx?key=satvik123
   Change the key:  ADMIN_KEY=mysecret npm start
5. WhatsApp (+91 77982 84545) still opens with the order message; email/CSV buttons still work.
6. To go online, deploy to Render/Railway/a VPS. Note: free hosts may wipe the data folder,
   so use a persistent disk or back up the xlsx.

NOTIFICATIONS (Gmail + WhatsApp on every order)
1. Copy .env.example to .env  (WSL: cp .env.example .env) and fill it in.
2. Gmail: Google Account > Security > turn on 2-Step Verification > App passwords >
   create one > paste into GMAIL_APP_PASSWORD.
3. WhatsApp (CallMeBot, free, alerts go to YOUR number): from WhatsApp send
   "I allow callmebot to send me messages" to +34 644 51 95 23 (check callmebot.com for the
   current number). It replies with an API key -> put it in CALLMEBOT_APIKEY.
4. npm start. Missing settings are skipped safely; a failed alert never blocks the order.

QUICK START (files are all in this one folder)
  npm install
  npm start        -> open http://localhost:3000
Just want to look at the design? Double-click index.html (orders won't be saved to Excel that way).
