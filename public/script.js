// ===== CONFIG =====
const WHATSAPP = "917798284545";
const EMAIL = "satvgandh@gmail.com";
// Prices intentionally NOT shown. Edit this list to add/remove products.
const PRODUCTS = {
  ghee:[["Cow Ghee","500 ml","ghee-500.jpg"],["Cow Ghee","1 L","ghee-1l.jpg"],["Cow Ghee","2 L","ghee-2l.jpg"],["Cow Ghee","5 L","ghee-5l.jpg"]],
  laddoo:[["Besan Laddoo","250 g","besan.jpg"],["Moti Choor Laddoo","250 g","motichur.jpg"],["Rava Laddoo","250 g","rava.jpg"],["Dry Fruit Laddoo","250 g","dryfruit-laddoo.jpg"],["Til Laddoo","250 g","til.jpg"],["Jaggery Laddoo","250 g","jaggery.jpg"]],
  barfi:[["Kaju Barfi","250 g","kaju.jpg"],["Kesar Peda","250 g","kesar.jpg"],["Milk Peda","250 g","milkpeda.jpg"],["Chocolate Barfi","250 g","chocbarfi.jpg"],["Dry Fruit Barfi","250 g","dryfruit-barfi.jpg"],["Mixed Peda","250 g","mixedpeda.jpg"]]
};
const ALL = Object.values(PRODUCTS).flat().map(p => `${p[0]} (${p[1]})`);
const IMG = {}; Object.values(PRODUCTS).flat().forEach(p => IMG[`${p[0]} (${p[1]})`] = "images/" + p[2]);
let cart = []; // {p, q}
const $ = id => document.getElementById(id);

// Render product cards
for (const k in PRODUCTS) $("g-"+k).innerHTML = PRODUCTS[k].map(p =>
  `<div class="card"><img src="images/${p[2]}" alt="${p[0]} ${p[1]}"><h4>${p[0]}</h4><small>${p[1]}</small><button class="btn" onclick="addItem('${p[0]} (${p[1]})')">Order Now</button></div>`).join("");

function addItem(name){
  const f = cart.find(c => c.p === name);
  f ? f.q++ : cart.push({p:name, q:1});
  draw(); $("order").scrollIntoView({behavior:"smooth"});
}
function draw(){
  $("rows").innerHTML = cart.map((c,i) => `<div class="row">
    <div class="pick"><img src="${IMG[c.p]}" alt=""><select onchange="cart[${i}].p=this.value;draw()">${ALL.map(a=>`<option ${a===c.p?"selected":""}>${a}</option>`).join("")}</select></div>
    <div class="qty"><button type="button" onclick="chg(${i},-1)">−</button><span>${c.q}</span><button type="button" onclick="chg(${i},1)">+</button></div>
    <button type="button" class="del" onclick="cart.splice(${i},1);draw()" title="Remove"><svg class="i"><use href="#i-trash"/></svg></button></div>`).join("");
  $("sum").innerHTML = cart.length ? cart.map(c => `<div class="si"><span><img src="${IMG[c.p]}" alt="">${c.p}</span><b>× ${c.q}</b></div>`).join("") : "<p>No products selected yet.</p>";
  $("tot").textContent = cart.reduce((s,c)=>s+c.q,0);
}
function chg(i,d){ cart[i].q = Math.max(1, Math.min(99, cart[i].q+d)); draw(); }
$("add").onclick = () => { cart.push({p:ALL[0], q:1}); draw(); };
$("burger").onclick = () => $("menu").classList.toggle("open");
$("menu").onclick = () => $("menu").classList.remove("open");
$("date").min = new Date().toISOString().split("T")[0];
cart.push({p:"Cow Ghee (1 L)", q:1}); draw();

// ===== ORDER SUBMIT =====
let last = null;
$("f").addEventListener("submit", e => {
  e.preventDefault();
  const d = {name:$("name").value.trim(), mobile:$("mobile").value.trim(), addr:$("addr").value.trim(),
             date:$("date").value, time:$("time").value, notes:$("notes").value.trim()};
  const bad = !cart.length ? "Please add at least one product."
    : !d.name ? "Please enter your full name."
    : !/^[6-9]\d{9}$/.test(d.mobile) ? "Enter a valid 10-digit mobile number."
    : !d.date ? "Please choose a delivery date."
    : !d.time ? "Please choose a delivery time."
    : d.addr.length < 10 ? "Please enter your full address." : "";
  $("err").textContent = bad; if (bad) return;

  const id = "SAT-" + new Date().toISOString().slice(2,10).replace(/-/g,"") + "-" + Math.floor(1000+Math.random()*9000);
  const items = cart.map(c => ({...c}));
  last = {id, d, items, placed:new Date().toLocaleString("en-IN")};
  try { const all = JSON.parse(localStorage.getItem("satvikOrders")||"[]"); all.push(last); localStorage.setItem("satvikOrders", JSON.stringify(all)); } catch(_){}

  fetch("/api/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(last)}).catch(()=>{}); // saves to Excel via server.js
  const lines = items.map((c,i)=>`${i+1}. ${c.p} × ${c.q}`).join("\n");
  const msg = `🌿 *New Order – Satvik*\nOrder ID: ${id}\n\n*Products:*\n${lines}\n\n*Customer:* ${d.name}\n*Mobile:* ${d.mobile}\n*Address:* ${d.addr}\n*Delivery:* ${d.date}, ${d.time}\n*Notes:* ${d.notes||"-"}`;
  $("oid").textContent = "Order ID: " + id; $("msg").textContent = msg;
  const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
  $("wa").href = url;
  $("mail").href = `mailto:${EMAIL}?subject=${encodeURIComponent("New Order "+id)}&body=${encodeURIComponent(msg.replace(/\*/g,""))}`;
  $("done").classList.add("show");
  window.open(url, "_blank"); // opens WhatsApp with the order message
});

// ===== EXCEL-READY CSV (matches Satvik_Orders.xlsx: Customers / Orders / Order_Items) =====
$("csv").onclick = () => {
  const q = v => `"${String(v).replace(/"/g,'""')}"`;
  const o = last, rows = [["Order ID","Placed On","Customer Name","Mobile","Address","Delivery Date","Delivery Time","Notes","Product","Qty","Status"]];
  o.items.forEach(c => rows.push([o.id,o.placed,o.d.name,o.d.mobile,o.d.addr,o.d.date,o.d.time,o.d.notes,c.p,c.q,"New"]));
  const blob = new Blob(["\ufeff"+rows.map(r=>r.map(q).join(",")).join("\n")], {type:"text/csv"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.id+".csv"; a.click();
};
