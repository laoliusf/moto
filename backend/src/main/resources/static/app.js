const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");
const toastEl = document.getElementById("toast");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let chartPromise = null;

function loadChartLib() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartPromise) {
    chartPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
      s.defer = true;
      s.onload = () => resolve(window.Chart);
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  return chartPromise;
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3000);
}

function addRipple(e) {
  const target = e.target.closest("button, a");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  target.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}
document.addEventListener("click", addRipple, { passive: true });

function triggerPageAnim() {
  appEl.classList.remove("fade-slide");
  void appEl.offsetWidth;
  appEl.classList.add("fade-slide");
}

function renderDataRow(label, value) {
  const safeValue = value === undefined || value === null || value === "" ? "-" : value;
  return `<div class="data-row"><div class="data-label">${label}</div><div class="data-value">${safeValue}</div></div>`;
}

function setNav(auth) {
  if (!auth) {
    navEl.classList.add("hidden");
    navEl.innerHTML = "";
    return;
  }
  navEl.classList.remove("hidden");
  navEl.innerHTML = `
    <a href="#/dashboard"><i class="iconfont icon-dashboard"></i>仪表盘</a>
    <a href="#/fuel"><i class="iconfont icon-oil"></i>加油</a>
    <a href="#/maintenance"><i class="iconfont icon-maintenance"></i>保养</a>
    <a href="#/vehicle"><i class="iconfont icon-car"></i>车辆</a>
    <a href="#/me"><i class="iconfont icon-user"></i>我的</a>
  `;
  highlightNav();
}

function highlightNav() {
  if (navEl.classList.contains("hidden")) return;
  const hash = location.hash || "#/dashboard";
  navEl.querySelectorAll("a").forEach(a => {
    a.classList.toggle("active", a.getAttribute("href") === hash);
  });
}
function headerScrollEffect() {
  const header = document.querySelector("header");
  if (!header) return;
  const toggle = () => header.classList.toggle("scrolled", window.scrollY > 12);
  toggle();
  window.addEventListener("scroll", toggle, { passive: true });
}
headerScrollEffect();

function renderLogin() {
  setNav(false);
  triggerPageAnim();
  appEl.innerHTML = `
    <div class="card hover-rise" style="max-width:22rem; margin:2rem auto;">
      <h3>登录 / 注册</h3>
      <form id="loginForm">
        <input name="username" placeholder="用户名" required />
        <input name="password" type="password" placeholder="密码" required />
        <div class="error-text hidden" id="loginError"></div>
        <div class="flex">
          <button type="submit">登录</button>
          <button type="button" id="registerBtn" class="secondary">注册</button>
        </div>
      </form>
    </div>`;
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
      store.setToken(res.token);
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      location.hash = "#/dashboard";
    } catch (err) {
      errorEl.textContent = err.message || "登录失败";
      errorEl.classList.remove("hidden");
      showToast(err.message);
    }
  };
  document.getElementById("registerBtn").onclick = async () => {
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
      store.setToken(res.token);
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      location.hash = "#/dashboard";
    } catch (err) {
      errorEl.textContent = err.message || "注册失败";
      errorEl.classList.remove("hidden");
      showToast(err.message);
    }
  };
}

async function fetchSummary() {
  const [summary, trend, breakdown] = await Promise.all([
    apiRequest("/api/stats/summary"),
    apiRequest("/api/stats/fuel-trend?limit=12"),
    apiRequest("/api/stats/cost-breakdown")
  ]);
  return { summary, trend, breakdown };
}

function dashboardSkeleton() {
  appEl.innerHTML = `
    <div class="card-grid">
      <div class="card skeleton card"></div>
      <div class="card skeleton card"></div>
      <div class="card skeleton card"></div>
      <div class="card skeleton card"></div>
    </div>
    <div class="card skeleton table" style="margin-top:0.75rem;"></div>
    <div class="card skeleton table" style="margin-top:0.75rem;"></div>
  `;
}

function animateCount(el, target) {
  if (prefersReducedMotion) { el.textContent = target.toFixed ? target.toFixed(2) : target; return; }
  const duration = 800;
  const start = performance.now();
  const initial = 0;
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = initial + (target - initial) * progress;
    el.textContent = value.toFixed(2);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function renderDashboard(data) {
  setNav(true);
  triggerPageAnim();
  const { summary, trend, breakdown } = data;
  appEl.innerHTML = `
    <div class="card-grid">
      <div class="card hover-rise"><div>总费用</div><h2 id="count-total">0</h2></div>
      <div class="card hover-rise"><div>本月费用</div><h2 id="count-month">0</h2></div>
      <div class="card hover-rise"><div>本次油耗 (L/100km)</div><h2 id="count-consume">0</h2><div style="color:var(--muted);font-size:0.9rem;">历史均值: ${(summary.historicalAverageConsumption || 0).toFixed(2)}</div></div>
      <div class="card hover-rise"><div>平均单价</div><h2 id="count-price">0</h2></div>
    </div>
    <div class="card hover-rise" style="margin-top:0.75rem;">
      <canvas id="trendChart" height="140"></canvas>
    </div>
    <div class="card hover-rise" style="margin-top:0.75rem;">
      <canvas id="pieChart" height="140"></canvas>
    </div>
  `;
  animateCount(document.getElementById("count-total"), summary.totalCost);
  animateCount(document.getElementById("count-month"), summary.monthCost);
  animateCount(document.getElementById("count-consume"), summary.averageConsumption);
  animateCount(document.getElementById("count-price"), summary.averagePrice);

  await loadChartLib();
  const labels = trend.map(t => t.date).reverse();
  const costData = trend.map(t => t.cost).reverse();
  const litersData = trend.map(t => t.liters).reverse();
  new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels, datasets:[
      { label:"费用", data:costData, borderColor:"#38B2AC", backgroundColor:"rgba(56,178,172,0.12)", fill:true, tension:0.35 },
      { label:"升数", data:litersData, borderColor:"#ED8936", backgroundColor:"rgba(237,137,54,0.14)", fill:true, tension:0.35 }
    ]},
    options:{ plugins:{ legend:{ labels:{ color:"#E2E8F0" } } }, scales:{ x:{ ticks:{ color:"#94A3B8" } }, y:{ ticks:{ color:"#94A3B8" } } } }
  });
  new Chart(document.getElementById("pieChart"), {
    type: "pie",
    data: { labels:["加油", "保养"], datasets:[{ data:[breakdown.fuelCost, breakdown.maintenanceCost], backgroundColor:["#38B2AC", "#ED8936"] }] },
    options:{ plugins:{ legend:{ labels:{ color:"#E2E8F0" } } } }
  });
}

async function renderFuel() {
  setNav(true);
  triggerPageAnim();
  appEl.innerHTML = `<div class="card skeleton table" style="margin-top:0;"></div>`;
  const vehicles = await apiRequest("/api/vehicle");
  const list = await apiRequest("/api/fuel");
  appEl.innerHTML = `
    <div class="flex" style="justify-content:space-between; align-items:center;">
      <h3>加油记录</h3>
      <button id="addFuelBtn">新增</button>
    </div>
    <div id="fuelForm" class="card hidden"></div>
    <div id="fuelCards" class="card-list"></div>
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>日期</th><th>车辆</th><th>里程</th><th>升数</th><th>单价</th><th>总价</th><th>加满</th><th>操作</th></tr></thead>
        <tbody id="fuelBody"></tbody>
      </table>
    </div>`;
  const body = document.getElementById("fuelBody");
  const cardBox = document.getElementById("fuelCards");
  body.innerHTML = list.map(r => {
    const full = (r.fullTank !== undefined ? r.fullTank : r.isFullTank) ? "是" : "否";
    return `<tr>
    <td>${r.date}</td>
    <td>${vehicles.find(v=>v.id===r.vehicleId)?.name||"-"}</td>
    <td>${r.mileage}</td><td>${r.liters}</td><td>${r.pricePerLiter}</td><td>${r.totalCost}</td><td>${full}</td>
    <td><button data-id="${r.id}" class="secondary edit">编辑</button> <button data-id="${r.id}" class="secondary delete">删除</button></td></tr>`;
  }).join("");
  cardBox.innerHTML = list.map(r => {
    const full = (r.fullTank !== undefined ? r.fullTank : r.isFullTank) ? "是" : "否";
    const vehicleName = vehicles.find(v => v.id === r.vehicleId)?.name || "-";
    return `
      <div class="data-card">
        <div class="data-header">
          <div class="data-title">${r.date || "-"}</div>
          <div class="data-meta">${vehicleName}</div>
        </div>
        ${renderDataRow("里程", r.mileage)}
        ${renderDataRow("升数", r.liters)}
        ${renderDataRow("单价", r.pricePerLiter)}
        ${renderDataRow("总价", r.totalCost)}
        ${renderDataRow("加满", full)}
        ${renderDataRow("备注", r.notes)}
        <div class="data-actions">
          <button data-id="${r.id}" class="secondary edit">编辑</button>
          <button data-id="${r.id}" class="secondary delete">删除</button>
        </div>
      </div>`;
  }).join("");
  document.querySelectorAll("button.delete").forEach(btn => btn.onclick = async () => {
    if (!confirm("确认删除？")) return;
    await apiRequest(`/api/fuel/${btn.dataset.id}`, { method:"DELETE" });
    showToast("已删除");
    renderFuel();
  });
  document.querySelectorAll("button.edit").forEach(btn => btn.onclick = () => openFuelForm(list.find(i=>i.id==btn.dataset.id), vehicles));
  document.getElementById("addFuelBtn").onclick = () => openFuelForm(null, vehicles);
}

function openFuelForm(item, vehicles) {
  const box = document.getElementById("fuelForm");
  box.classList.remove("hidden");
  box.innerHTML = `
    <form id="fuelFormInner">
      <div class="flex">
        <input name="date" type="date" value="${item?item.date:""}" required />
        <input name="mileage" type="number" placeholder="里程" value="${item?item.mileage:""}" required />
        <select name="vehicleId">${vehicles.map(v=>"<option value=\""+v.id+"\" "+(item&&item.vehicleId===v.id?"selected":"")+">"+v.name+"</option>").join("")}</select>
      </div>
      <div class="flex">
        <input name="liters" type="number" step="0.01" placeholder="升数" value="${item?item.liters:""}" required />
        <input name="pricePerLiter" type="number" step="0.01" placeholder="单价" value="${item?item.pricePerLiter:""}" required />
        <input name="totalCost" type="number" step="0.01" placeholder="总价" value="${item?item.totalCost:""}" required />
      </div>
      <div class="flex">
        <label style="display:flex;align-items:center;gap:0.35rem;"><input type="checkbox" name="isFullTank" ${item&&item.isFullTank?"checked":""}/> 加满</label>
        <input name="notes" placeholder="备注" value="${item?item.notes:""}" style="flex:1" />
      </div>
      <div class="flex">
        <button type="submit">${item?"更新":"保存"}</button>
        <button type="button" class="secondary" id="closeFuel">关闭</button>
      </div>
    </form>`;
  document.getElementById("closeFuel").onclick = () => box.classList.add("hidden");
  const form = document.getElementById("fuelFormInner");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.isFullTank = form.isFullTank.checked;
    data.mileage = Number(data.mileage);
    data.liters = Number(data.liters);
    data.pricePerLiter = Number(data.pricePerLiter);
    data.totalCost = Number(data.totalCost);
    data.vehicleId = Number(data.vehicleId);
    try {
      if (item) await apiRequest(`/api/fuel/${item.id}`, { method:"PUT", body: JSON.stringify(data)});
      else await apiRequest("/api/fuel", { method:"POST", body: JSON.stringify(data)});
      showToast("已保存");
      renderFuel();
    } catch(err){ showToast(err.message); }
  };
}

async function renderMaintenance() {
  setNav(true);
  triggerPageAnim();
  appEl.innerHTML = `<div class="card skeleton table"></div>`;
  const vehicles = await apiRequest("/api/vehicle");
  const list = await apiRequest("/api/maintenance");
  appEl.innerHTML = `
    <div class="flex" style="justify-content:space-between; align-items:center;">
      <h3>保养记录</h3><button id="addBtn">新增</button>
    </div>
    <div id="formBox" class="card hidden"></div>
    <div id="maintCards" class="card-list"></div>
    <div class="table-wrapper">
      <table class="table"><thead><tr><th>日期</th><th>车辆</th><th>项目</th><th>费用</th><th>里程</th><th>备注</th><th>操作</th></tr></thead><tbody id="body"></tbody></table>
    </div>`;
  const body = document.getElementById("body");
  const cardBox = document.getElementById("maintCards");
  body.innerHTML = list.map(r=>`<tr><td>${r.date}</td><td>${vehicles.find(v=>v.id===r.vehicleId)?.name||"-"}</td><td>${r.title}</td><td>${r.cost}</td><td>${r.mileage}</td><td>${r.notes}</td><td><button class="secondary delete" data-id="${r.id}">删除</button></td></tr>`).join("");
  cardBox.innerHTML = list.map(r => {
    const vehicleName = vehicles.find(v => v.id === r.vehicleId)?.name || "-";
    return `
      <div class="data-card">
        <div class="data-header">
          <div class="data-title">${r.date || "-"}</div>
          <div class="data-meta">${vehicleName}</div>
        </div>
        ${renderDataRow("项目", r.title)}
        ${renderDataRow("费用", r.cost)}
        ${renderDataRow("里程", r.mileage)}
        ${renderDataRow("备注", r.notes)}
        <div class="data-actions">
          <button class="secondary delete" data-id="${r.id}">删除</button>
        </div>
      </div>`;
  }).join("");
  document.getElementById("addBtn").onclick = () => openMaintForm(null, vehicles);
  document.querySelectorAll("button.delete").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("确认删除？")) return;
    await apiRequest(`/api/maintenance/${btn.dataset.id}`, {method:"DELETE"});
    showToast("已删除");
    renderMaintenance();
  });
}

function openMaintForm(item, vehicles){
  const box=document.getElementById("formBox");
  box.classList.remove("hidden");
  box.innerHTML=`<form id="maintForm">
    <div class="flex">
      <input name="date" type="date" value="${item?item.date:""}" required />
      <input name="title" placeholder="项目" value="${item?item.title:""}" required />
      <select name="vehicleId">${vehicles.map(v=>"<option value=\""+v.id+"\">"+v.name+"</option>").join("")}</select>
    </div>
    <div class="flex">
      <input name="cost" type="number" step="0.01" placeholder="费用" value="${item?item.cost:""}" required />
      <input name="mileage" type="number" placeholder="里程" value="${item?item.mileage:""}" required />
      <input name="notes" placeholder="备注" value="${item?item.notes:""}" />
    </div>
    <div class="flex"><button type="submit">保存</button><button type="button" class="secondary" id="closeMaint">关闭</button></div>
  </form>`;
  document.getElementById("closeMaint").onclick=()=>box.classList.add("hidden");
  const form=document.getElementById("maintForm");
  form.onsubmit=async(e)=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form).entries());
    data.cost=Number(data.cost); data.mileage=Number(data.mileage); data.vehicleId=Number(data.vehicleId);
    try{ await apiRequest("/api/maintenance", {method:"POST", body:JSON.stringify(data)}); showToast("已保存"); renderMaintenance(); }
    catch(err){ showToast(err.message); }
  };
}

async function renderVehicles(){
  setNav(true);
  triggerPageAnim();
  appEl.innerHTML = `<div class="card skeleton table"></div>`;
  const list=await apiRequest("/api/vehicle");
  appEl.innerHTML=`
    <div class="flex" style="justify-content:space-between; align-items:center;">
      <h3>车辆</h3><button id="addVehicle">新增</button>
    </div>
    <div id="vehicleForm" class="card hidden"></div>
    <div id="vehicleCards" class="card-list"></div>
    <div class="table-wrapper">
      <table class="table"><thead><tr><th>名称</th><th>品牌</th><th>型号</th><th>排量</th><th>购入日期</th><th>里程</th><th>备注</th><th>操作</th></tr></thead><tbody id="vehicleBody"></tbody></table>
    </div>`;
  const body=document.getElementById("vehicleBody");
  const cardBox = document.getElementById("vehicleCards");
  body.innerHTML=list.map(v=>`<tr><td>${v.name}</td><td>${v.brand}</td><td>${v.model}</td><td>${v.displacement}</td><td>${v.purchaseDate}</td><td>${v.currentMileage}</td><td>${v.notes}</td><td><button class="secondary edit" data-id="${v.id}">编辑</button> <button class="secondary delete" data-id="${v.id}">删除</button></td></tr>`).join("");
  cardBox.innerHTML = list.map(v => `
    <div class="data-card">
      <div class="data-header">
        <div class="data-title">${v.name || "-"}</div>
        <div class="data-meta">${v.brand || "-"} ${v.model || ""}</div>
      </div>
      ${renderDataRow("排量", v.displacement)}
      ${renderDataRow("购入日期", v.purchaseDate)}
      ${renderDataRow("里程", v.currentMileage)}
      ${renderDataRow("备注", v.notes)}
      <div class="data-actions">
        <button class="secondary edit" data-id="${v.id}">编辑</button>
        <button class="secondary delete" data-id="${v.id}">删除</button>
      </div>
    </div>`).join("");
  document.getElementById("addVehicle").onclick=()=>openVehicleForm();
  document.querySelectorAll("button.edit").forEach(btn=>btn.onclick=()=>openVehicleForm(list.find(v=>v.id==btn.dataset.id)));
  document.querySelectorAll("button.delete").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("删除车辆会丢失其记录，确认继续？")) return;
    try{ await apiRequest(`/api/vehicle/${btn.dataset.id}`, {method:"DELETE"}); showToast("已删除"); renderVehicles(); }
    catch(err){ showToast(err.message); }
  });
}

function openVehicleForm(item){
  const box=document.getElementById("vehicleForm");
  box.classList.remove("hidden");
  box.innerHTML=`<form id="vehicleFormInner">
    <div class="flex"><input name="name" placeholder="名称" value="${item?item.name:""}" required />
    <input name="brand" placeholder="品牌" value="${item?item.brand:""}" />
    <input name="model" placeholder="型号" value="${item?item.model:""}" /></div>
    <div class="flex"><input name="displacement" placeholder="排量" value="${item?item.displacement:""}" />
    <input name="purchaseDate" type="date" value="${item?item.purchaseDate:""}" />
    <input name="currentMileage" type="number" placeholder="里程" value="${item ? item.currentMileage || 0 : 0}" /></div>
    <textarea name="notes" placeholder="备注">${item?item.notes:""}</textarea>
    <div class="flex"><button type="submit">${item?"更新":"保存"}</button><button type="button" class="secondary" id="closeVehicle">关闭</button></div>
  </form>`;
  document.getElementById("closeVehicle").onclick=()=>box.classList.add("hidden");
  const form=document.getElementById("vehicleFormInner");
  form.onsubmit=async(e)=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form).entries());
    data.currentMileage=Number(data.currentMileage||0);
    try{
      if(item) await apiRequest(`/api/vehicle/${item.id}`, {method:"PUT", body:JSON.stringify(data)});
      else await apiRequest("/api/vehicle", {method:"POST", body:JSON.stringify(data)});
      showToast("已保存"); renderVehicles();
    }catch(err){ showToast(err.message); }
  };
}

async function renderProfile(){
  setNav(true);
  triggerPageAnim();
  appEl.innerHTML = `<div class="card skeleton table"></div>`;
  try{
    const [me, vehicles] = await Promise.all([
      apiRequest("/api/auth/me"),
      apiRequest("/api/vehicle")
    ]);
    const first = vehicles[0];
    appEl.innerHTML = `
      <div class="card hover-rise">
        <h3>我的</h3>
        <p>用户名：${me.username}</p>
        <p>车辆数量：${vehicles.length}</p>
        ${vehicles.length ? `<div class="card" style="margin-top:0.5rem;"><div style="font-weight:600;">首辆车辆</div><div>${first.name||"-"} ${first.brand||""} ${first.model||""}</div><div>当前里程：${first.currentMileage ?? "-"} km</div></div>` : `<p style="color:var(--muted);">暂无车辆，可前往“车辆”页添加。</p>`}
        <div class="flex" style="margin-top:0.75rem;">
          <button id="logoutBtn">退出登录</button>
        </div>
      </div>`;
    document.getElementById("logoutBtn").onclick = () => {
      store.setToken(null);
      location.hash = "#/login";
    };
  }catch(err){
    showToast(err.message);
  }
}

async function handleRoute(){
  const hash=location.hash||"#/dashboard";
  if(!store.token && hash!=="#/login") { location.hash = "#/login"; return; }
  triggerPageAnim();
  switch(hash){
    case "#/login": renderLogin(); break;
    case "#/dashboard":
      try{ dashboardSkeleton(); const data=await fetchSummary(); renderDashboard(data);}catch(err){ showToast(err.message);} break;
    case "#/fuel":
      try{ await renderFuel(); }catch(err){ showToast(err.message);} break;
    case "#/maintenance":
      try{ await renderMaintenance(); }catch(err){ showToast(err.message);} break;
    case "#/vehicle":
      try{ await renderVehicles(); }catch(err){ showToast(err.message);} break;
    case "#/me":
      try{ await renderProfile(); }catch(err){ showToast(err.message);} break;
    case "#/logout":
      store.setToken(null); location.hash = "#/login"; break;
    default: location.hash = "#/dashboard";
  }
  highlightNav();
}

window.addEventListener("hashchange", handleRoute);
window.addEventListener("load", handleRoute);




