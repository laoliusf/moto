const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");
const toastEl = document.getElementById("toast");

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3000);
}

function setNav(auth) {
  if (!auth) {
    navEl.innerHTML = '<a href="#/login" class="active">登录</a>';
    return;
  }
  navEl.innerHTML = `
    <a href="#/dashboard">仪表盘</a>
    <a href="#/fuel">加油记录</a>
    <a href="#/maintenance">保养记录</a>
    <a href="#/vehicle">车辆</a>
    <a href="#/logout">退出</a>
  `;
}

function renderLogin() {
  setNav(false);
  appEl.innerHTML = `
    <div class="card" style="max-width:360px; margin:30px auto;">
      <h3>登录 / 注册</h3>
      <form id="loginForm">
        <input name="username" placeholder="用户名" required />
        <input name="password" type="password" placeholder="密码" required />
        <div class="flex">
          <button type="submit">登录</button>
          <button type="button" id="registerBtn" class="secondary">注册</button>
        </div>
      </form>
    </div>`;
  const form = document.getElementById("loginForm");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(data) });
      store.setToken(res.token);
      location.hash = "#/dashboard";
    } catch (err) {
      showToast(err.message);
    }
  };
  document.getElementById("registerBtn").onclick = async () => {
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
      store.setToken(res.token);
      location.hash = "#/dashboard";
    } catch (err) { showToast(err.message); }
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

function renderDashboard(data) {
  setNav(true);
  const { summary, trend, breakdown } = data;
  appEl.innerHTML = `
    <div class="card-grid">
      <div class="card"><div>总费用</div><h2>¥${summary.totalCost.toFixed(2)}</h2></div>
      <div class="card"><div>本月费用</div><h2>¥${summary.monthCost.toFixed(2)}</h2></div>
      <div class="card"><div>平均油耗</div><h2>${summary.averageConsumption.toFixed(2)} L/100km</h2></div>
      <div class="card"><div>平均单价</div><h2>¥${summary.averagePrice.toFixed(2)}</h2></div>
    </div>
    <div class="card" style="margin-top:12px;">
      <canvas id="trendChart" height="120"></canvas>
    </div>
    <div class="card" style="margin-top:12px;">
      <canvas id="pieChart" height="120"></canvas>
    </div>
  `;
  const labels = trend.map(t => t.date).reverse();
  const costData = trend.map(t => t.cost).reverse();
  const litersData = trend.map(t => t.liters).reverse();
  new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: { labels, datasets:[{ label:"费用", data:costData, borderColor:"#2563eb", fill:false }, { label:"升数", data:litersData, borderColor:"#f97316", fill:false }] },
  });
  new Chart(document.getElementById("pieChart"), {
    type: "pie",
    data: { labels:["加油", "保养"], datasets:[{ data:[breakdown.fuelCost, breakdown.maintenanceCost], backgroundColor:["#2563eb", "#f59e0b"] }] }
  });
}

async function renderFuel() {
  setNav(true);
  const vehicles = await apiRequest("/api/vehicle");
  const list = await apiRequest("/api/fuel");
  appEl.innerHTML = `
    <div class="flex" style="justify-content:space-between; align-items:center;">
      <h3>加油记录</h3>
      <button id="addFuelBtn">新增</button>
    </div>
    <div id="fuelForm" class="card hidden"></div>
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>日期</th><th>车辆</th><th>里程</th><th>升数</th><th>单价</th><th>总价</th><th>加满</th><th>操作</th></tr></thead>
        <tbody id="fuelBody"></tbody>
      </table>
    </div>`;
  const body = document.getElementById("fuelBody");
  body.innerHTML = list.map(r => {
    const full = (r.fullTank !== undefined ? r.fullTank : r.isFullTank) ? "是" : "否";
    return `<tr>
    <td>${r.date}</td>
    <td>${vehicles.find(v=>v.id===r.vehicleId)?.name||"-"}</td>
    <td>${r.mileage}</td><td>${r.liters}</td><td>${r.pricePerLiter}</td><td>${r.totalCost}</td><td>${full}</td>
    <td><button data-id="${r.id}" class="secondary edit">编辑</button> <button data-id="${r.id}" class="secondary delete">删除</button></td></tr>`;
  }).join("");
  document.querySelectorAll("button.delete").forEach(btn => btn.onclick = async () => {
    if (!confirm("确认删除?")) return;
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
        <label><input type="checkbox" name="isFullTank" ${item&&item.isFullTank?"checked":""}/> 加满</label>
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
  const vehicles = await apiRequest("/api/vehicle");
  const list = await apiRequest("/api/maintenance");
  appEl.innerHTML = `
    <div class="flex" style="justify-content:space-between; align-items:center;">
      <h3>保养记录</h3><button id="addBtn">新增</button>
    </div>
    <div id="formBox" class="card hidden"></div>
    <div class="table-wrapper">
      <table class="table"><thead><tr><th>日期</th><th>车辆</th><th>项目</th><th>费用</th><th>里程</th><th>备注</th><th>操作</th></tr></thead><tbody id="body"></tbody></table>
    </div>`;
  const body = document.getElementById("body");
  body.innerHTML = list.map(r=>`<tr><td>${r.date}</td><td>${vehicles.find(v=>v.id===r.vehicleId)?.name||"-"}</td><td>${r.title}</td><td>${r.cost}</td><td>${r.mileage}</td><td>${r.notes}</td><td><button class="secondary delete" data-id="${r.id}">删除</button></td></tr>`).join("");
  document.getElementById("addBtn").onclick = () => openMaintForm(null, vehicles);
  document.querySelectorAll("button.delete").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("确认删除?")) return;
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
  const list=await apiRequest("/api/vehicle");
  appEl.innerHTML=`
    <div class="flex" style="justify-content:space-between; align-items:center;">
      <h3>车辆</h3><button id="addVehicle">新增</button>
    </div>
    <div id="vehicleForm" class="card hidden"></div>
    <div class="table-wrapper">
      <table class="table"><thead><tr><th>名称</th><th>品牌</th><th>型号</th><th>排量</th><th>购入日期</th><th>里程</th><th>备注</th><th>操作</th></tr></thead><tbody id="vehicleBody"></tbody></table>
    </div>`;
  const body=document.getElementById("vehicleBody");
  body.innerHTML=list.map(v=>`<tr><td>${v.name}</td><td>${v.brand}</td><td>${v.model}</td><td>${v.displacement}</td><td>${v.purchaseDate}</td><td>${v.currentMileage}</td><td>${v.notes}</td><td><button class="secondary edit" data-id="${v.id}">编辑</button> <button class="secondary delete" data-id="${v.id}">删除</button></td></tr>`).join("");
  document.getElementById("addVehicle").onclick=()=>openVehicleForm();
  document.querySelectorAll("button.edit").forEach(btn=>btn.onclick=()=>openVehicleForm(list.find(v=>v.id==btn.dataset.id)));
  document.querySelectorAll("button.delete").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("删除车辆会失败当存在记录时，确认继续?")) return;
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

async function handleRoute(){
  const hash=location.hash||"#/dashboard";
  if(!store.token && hash!=="#/login") { location.hash = "#/login"; return; }
  switch(hash){
    case "#/login": renderLogin(); break;
    case "#/dashboard":
      try{ const data=await fetchSummary(); renderDashboard(data);}catch(err){ showToast(err.message);} break;
    case "#/fuel":
      try{ await renderFuel(); }catch(err){ showToast(err.message);} break;
    case "#/maintenance":
      try{ await renderMaintenance(); }catch(err){ showToast(err.message);} break;
    case "#/vehicle":
      try{ await renderVehicles(); }catch(err){ showToast(err.message);} break;
    case "#/logout":
      store.setToken(null); location.hash = "#/login"; break;
    default: location.hash = "#/dashboard";
  }
}

window.addEventListener("hashchange", handleRoute);
window.addEventListener("load", handleRoute);
