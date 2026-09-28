require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "satvik123";   // change this!
const FILE = path.join(__dirname, "data", "Satvik_Orders.xlsx");
fs.mkdirSync(path.dirname(FILE), { recursive: true });

const SHEETS = {
  Customers:   ["Customer ID", "Name", "Mobile", "Address", "First Order Date"],
  Orders:      ["Order ID", "Placed On", "Customer ID", "Delivery Date", "Delivery Time", "Notes", "Status", "Total Items"],
  Order_Items: ["Order ID", "Product", "Qty"],
};

async function load() {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(FILE)) await wb.xlsx.readFile(FILE);
  for (const [name, cols] of Object.entries(SHEETS)) {
    if (wb.getWorksheet(name)) continue;
    const ws = wb.addWorksheet(name);
    ws.addRow(cols).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
    ws.columns.forEach(c => (c.width = 22));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return wb;
}

// Serialize writes so two simultaneous orders never corrupt the file
let queue = Promise.resolve();
const enqueue = fn => (queue = queue.then(fn, fn));

async function saveOrder(o) {
  const wb = await load();
  const cs = wb.getWorksheet("Customers");
  let cid = null;
  cs.eachRow((r, i) => { if (i > 1 && String(r.getCell(3).value) === o.d.mobile) cid = r.getCell(1).value; });
  if (!cid) {
    cid = "C" + String(cs.rowCount).padStart(3, "0");
    cs.addRow([cid, o.d.name, o.d.mobile, o.d.addr, o.d.date]);
  }
  const total = o.items.reduce((s, i) => s + i.q, 0);
  wb.getWorksheet("Orders").addRow([o.id, o.placed, cid, o.d.date, o.d.time, o.d.notes || "", "New", total]);
  const its = wb.getWorksheet("Order_Items");
  o.items.forEach(i => its.addRow([o.id, i.p, i.q]));
  await wb.xlsx.writeFile(FILE);
}


// ===== NOTIFICATIONS (Gmail + WhatsApp) =====
const EMAIL_TO = process.env.EMAIL_TO || "satvgandh@gmail.com";
const mailer = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
  : null;

function orderText(o, bold) {
  const b = bold ? "*" : "";
  const lines = o.items.map((i, n) => `${n + 1}. ${i.p} x ${i.q}`).join("\n");
  return `${b}New Order - Satvik${b}\nOrder ID: ${o.id}\n\n${b}Products:${b}\n${lines}\n\n${b}Customer:${b} ${o.d.name}\n${b}Mobile:${b} ${o.d.mobile}\n${b}Address:${b} ${o.d.addr}\n${b}Delivery:${b} ${o.d.date}, ${o.d.time}\n${b}Notes:${b} ${o.d.notes || "-"}`;
}

async function notifyEmail(o) {
  if (!mailer) return console.log("Email skipped (GMAIL_USER / GMAIL_APP_PASSWORD not set)");
  await mailer.sendMail({ from: `"Satvik Orders" <${process.env.GMAIL_USER}>`, to: EMAIL_TO,
    subject: `New Order ${o.id} - ${o.d.name}`, text: orderText(o, false) });
  console.log("Email sent for", o.id);
}

// Free WhatsApp alert to the owner's own number via CallMeBot (one-time setup, see README)
async function notifyWhatsApp(o) {
  const { CALLMEBOT_PHONE: phone, CALLMEBOT_APIKEY: key } = process.env;
  if (!phone || !key) return console.log("WhatsApp skipped (CALLMEBOT_PHONE / CALLMEBOT_APIKEY not set)");
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(key)}&text=${encodeURIComponent(orderText(o, true))}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("CallMeBot HTTP " + r.status);
  console.log("WhatsApp sent for", o.id);
}

const notify = o => Promise.allSettled([notifyEmail(o), notifyWhatsApp(o)])
  .then(rs => rs.forEach(r => r.status === "rejected" && console.error("Notify failed:", r.reason.message)));

const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/order", (req, res) => {
  const o = req.body || {};
  const d = o.d || {};
  const ok = typeof o.id === "string" && Array.isArray(o.items) && o.items.length > 0 && o.items.length <= 50
    && o.items.every(i => typeof i.p === "string" && Number.isInteger(i.q) && i.q > 0 && i.q < 100)
    && d.name && /^[6-9]\d{9}$/.test(d.mobile || "") && d.addr && d.date && d.time;
  if (!ok) return res.status(400).json({ error: "Invalid order" });
  const clean = s => String(s || "").slice(0, 300).replace(/^[=+\-@]/, "'$&"); // block Excel formula injection
  const order = { id: clean(o.id), placed: clean(o.placed),
    d: { name: clean(d.name), mobile: d.mobile, addr: clean(d.addr), date: clean(d.date), time: clean(d.time), notes: clean(d.notes) },
    items: o.items.map(i => ({ p: clean(i.p), q: i.q })) };
  enqueue(() => saveOrder(order))
    .then(() => { res.json({ ok: true }); notify(order); })
    .catch(e => { console.error(e); res.status(500).json({ error: "Could not save" }); });
});

// Download all orders:  http://localhost:3000/admin/orders.xlsx?key=YOUR_KEY
app.get("/admin/orders.xlsx", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).send("Unauthorized");
  if (!fs.existsSync(FILE)) return res.status(404).send("No orders yet");
  res.download(FILE);
});

app.listen(PORT, () => console.log(`Satvik running at http://localhost:${PORT}\nOrders file: ${FILE}`));
