const appEl = document.getElementById("app");
const navEl = document.getElementById("nav");
const toastEl = document.getElementById("toast");

const maintenancePresetOptions = [
  "机油",
  "机滤",
  "空滤",
  "齿轮油",
  "火花塞",
  "刹车油",
  "冷却液",
  "电瓶",
  "前轮胎",
  "后轮胎",
  "刹车片",
  "传动皮带"
];

const state = {
  me: null,
  vehicles: [],
  fuelRecords: [],
  maintenanceRecords: [],
  fuelFilterVehicleId: "default",
  maintenanceFilterVehicleId: "default",
  quickActionsOpen: false,
  route: "#/dashboard"
};

const storage = {
  get defaultVehicleId() {
    const raw = localStorage.getItem("defaultVehicleId");
    return raw ? Number(raw) : null;
  },
  set defaultVehicleId(value) {
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem("defaultVehicleId");
      return;
    }
    localStorage.setItem("defaultVehicleId", String(value));
  },
  get loginFailures() {
    try {
      return JSON.parse(localStorage.getItem("loginFailures") || "{}");
    } catch (_err) {
      return {};
    }
  },
  set loginFailures(value) {
    localStorage.setItem("loginFailures", JSON.stringify(value || {}));
  }
};

function getLoginFailures(username) {
  if (!username) return 0;
  return safeNumber(storage.loginFailures[String(username).trim().toLowerCase()], 0);
}

function recordLoginFailure(username) {
  const key = String(username || "").trim().toLowerCase();
  if (!key) return 0;
  const failures = storage.loginFailures;
  const next = safeNumber(failures[key], 0) + 1;
  failures[key] = next;
  storage.loginFailures = failures;
  return next;
}

function resetLoginFailures(username) {
  const key = String(username || "").trim().toLowerCase();
  if (!key) return;
  const failures = storage.loginFailures;
  if (key in failures) {
    delete failures[key];
    storage.loginFailures = failures;
  }
}

function showToast(message, tone = "info") {
  toastEl.textContent = message;
  toastEl.className = `toast ${tone}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.className = "toast hidden";
  }, 2600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatCurrency(value) {
  return `¥ ${safeNumber(value).toFixed(2)}`;
}

function formatNumber(value, digits = 2) {
  return safeNumber(value).toFixed(digits);
}

function formatMileage(value) {
  return `${safeNumber(value).toLocaleString("zh-CN")} km`;
}

function formatDate(value) {
  return value || "-";
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function sortByDateDesc(list) {
  return [...list].sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return safeNumber(b.id) - safeNumber(a.id);
  });
}

function sortByDateAsc(list) {
  return [...list].sort((a, b) => {
    const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return safeNumber(a.id) - safeNumber(b.id);
  });
}

function getVehicleMap() {
  return new Map(state.vehicles.map(vehicle => [vehicle.id, vehicle]));
}

function getVehicleName(vehicleId) {
  return getVehicleMap().get(Number(vehicleId))?.name || "未绑定车辆";
}

function isAdminUser() {
  return state.me?.isAdmin || String(state.me?.username || "").toLowerCase() === "admin";
}

function ensureDefaultVehicle() {
  if (!state.vehicles.length) {
    storage.defaultVehicleId = null;
    return null;
  }
  const existing = state.vehicles.find(item => item.id === storage.defaultVehicleId);
  if (existing) return existing;
  storage.defaultVehicleId = state.vehicles[0].id;
  return state.vehicles[0];
}

function vehicleOptions(includeSpecial = false) {
  const options = [];
  if (includeSpecial) {
    options.push(`<option value="default">默认车辆</option>`);
    options.push(`<option value="all">全部车辆</option>`);
  }
  state.vehicles.forEach(vehicle => {
    const suffix = vehicle.id === storage.defaultVehicleId ? " · 默认" : "";
    options.push(`<option value="${vehicle.id}">${escapeHtml(vehicle.name)}${suffix}</option>`);
  });
  return options.join("");
}

function resolveFilterVehicleId(value) {
  if (value === "all") return null;
  if (value === "default") return storage.defaultVehicleId;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : storage.defaultVehicleId;
}

function getFuelRecordsByVehicle(vehicleId) {
  return sortByDateDesc(state.fuelRecords.filter(item => Number(item.vehicleId) === Number(vehicleId)));
}

function getMaintenanceRecordsByVehicle(vehicleId) {
  return sortByDateDesc(state.maintenanceRecords.filter(item => Number(item.vehicleId) === Number(vehicleId)));
}

function getLatestFuelRecord(vehicleId) {
  return getFuelRecordsByVehicle(vehicleId)[0] || null;
}

function getLatestMaintenanceRecord(vehicleId) {
  return getMaintenanceRecordsByVehicle(vehicleId)[0] || null;
}

function getVehicleCurrentMileage(vehicle) {
  const latestFuel = getLatestFuelRecord(vehicle.id);
  if (latestFuel) return safeNumber(latestFuel.mileage);
  return safeNumber(vehicle.currentMileage);
}

function getScopedFuelRecords(scopeValue) {
  const vehicleId = resolveFilterVehicleId(scopeValue);
  if (!vehicleId) return sortByDateDesc(state.fuelRecords);
  return getFuelRecordsByVehicle(vehicleId);
}

function getScopedMaintenanceRecords(scopeValue) {
  const vehicleId = resolveFilterVehicleId(scopeValue);
  if (!vehicleId) return sortByDateDesc(state.maintenanceRecords);
  return getMaintenanceRecordsByVehicle(vehicleId);
}

function buildConsumptionTrend(records) {
  const ordered = sortByDateAsc(records);
  const trend = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const mileageDelta = safeNumber(current.mileage) - safeNumber(previous.mileage);
    if (mileageDelta <= 0) continue;
    trend.push({
      id: current.id || index,
      date: current.date,
      consumption: (safeNumber(current.liters) / mileageDelta) * 100
    });
  }
  return trend.slice(-10);
}

function calculateDashboardStats() {
  const defaultVehicle = ensureDefaultVehicle();
  const fuel = defaultVehicle ? getFuelRecordsByVehicle(defaultVehicle.id) : [];
  const maintenance = defaultVehicle ? getMaintenanceRecordsByVehicle(defaultVehicle.id) : [];
  const currentMonth = monthKey();

  const monthFuelCost = fuel
    .filter(item => String(item.date || "").startsWith(currentMonth))
    .reduce((sum, item) => sum + safeNumber(item.totalCost), 0);
  const monthMaintenanceCost = maintenance
    .filter(item => String(item.date || "").startsWith(currentMonth))
    .reduce((sum, item) => sum + safeNumber(item.cost), 0);
  const totalFuelCost = fuel.reduce((sum, item) => sum + safeNumber(item.totalCost), 0);
  const totalMaintenanceCost = maintenance.reduce((sum, item) => sum + safeNumber(item.cost), 0);
  const totalLiters = fuel.reduce((sum, item) => sum + safeNumber(item.liters), 0);
  const avgPrice = totalLiters > 0 ? totalFuelCost / totalLiters : 0;
  const trend = buildConsumptionTrend(fuel);
  const latestConsumption = trend.length ? trend[trend.length - 1].consumption : 0;
  const averageConsumption = trend.length
    ? trend.reduce((sum, item) => sum + safeNumber(item.consumption), 0) / trend.length
    : 0;

  return {
    defaultVehicle,
    monthFuelCost,
    monthMaintenanceCost,
    totalFuelCost,
    totalMaintenanceCost,
    avgPrice,
    latestConsumption,
    averageConsumption,
    trend
  };
}

function getMaintenanceAlert() {
  const defaultVehicle = ensureDefaultVehicle();
  if (!defaultVehicle) return null;
  const latestMaintenance = getLatestMaintenanceRecord(defaultVehicle.id);
  if (!latestMaintenance) return null;

  if (!safeNumber(latestMaintenance.nextMaintenanceMileage)) {
    return {
      level: "info",
      title: "下次保养未设置",
      body: `${defaultVehicle.name} 最近一条维保还没有填写下次保养里程，建议补充后再由首页持续提醒。`,
      currentMileage: getVehicleCurrentMileage(defaultVehicle),
      nextMileage: 0,
      remainingMileage: 0,
      ratio: 0
    };
  }

  const currentMileage = getVehicleCurrentMileage(defaultVehicle);
  const nextMileage = safeNumber(latestMaintenance.nextMaintenanceMileage);
  const delta = nextMileage - currentMileage;
  const ratio = nextMileage > 0 ? Math.min(currentMileage / nextMileage, 1) : 0;

  if (delta <= 0) {
    return {
      level: "danger",
      title: "维保已超里程",
      body: `${defaultVehicle.name} 已超过下次保养里程 ${formatMileage(nextMileage)}，建议尽快处理。`,
      currentMileage,
      nextMileage,
      remainingMileage: 0,
      ratio
    };
  }

  if (delta <= 500) {
    return {
      level: "warn",
      title: "维保即将到期",
      body: `${defaultVehicle.name} 距下次保养还剩 ${formatMileage(delta)}，建议提前安排。`,
      currentMileage,
      nextMileage,
      remainingMileage: delta,
      ratio
    };
  }

  return {
    level: "info",
    title: "下次保养里程",
    body: `${defaultVehicle.name} 距下次保养还剩 ${formatMileage(delta)}。`,
    currentMileage,
    nextMileage,
    remainingMileage: delta,
    ratio
  };
}

async function refreshVehicles() {
  state.vehicles = await apiRequest("/api/vehicle");
  ensureDefaultVehicle();
}

async function refreshDataLists() {
  const [fuel, maintenance] = await Promise.all([
    apiRequest("/api/fuel"),
    apiRequest("/api/maintenance")
  ]);
  state.fuelRecords = sortByDateDesc(fuel);
  state.maintenanceRecords = sortByDateDesc(maintenance);
}

async function bootstrapData() {
  if (!store.token) return;
  state.me = await apiRequest("/api/auth/me");
  await refreshVehicles();
  await refreshDataLists();
}

function setNav(visible) {
  if (!visible) {
    navEl.className = "bottom-nav hidden";
    navEl.innerHTML = "";
    return;
  }
  navEl.className = "bottom-nav";
  navEl.innerHTML = `
    <a href="#/dashboard" data-route="#/dashboard">总览</a>
    <a href="#/fuel" data-route="#/fuel">补给</a>
    <a href="#/maintenance" data-route="#/maintenance">维保</a>
    <a href="#/vehicle" data-route="#/vehicle">车库</a>
    <a href="#/me" data-route="#/me">我的</a>
  `;
  highlightNav();
}

function highlightNav() {
  navEl.querySelectorAll("a").forEach(link => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });
}

function renderQuickActions() {
  return `
    <div class="quick-actions ${state.quickActionsOpen ? "open" : ""}">
      <button id="quickFab" class="quick-fab" type="button" aria-label="快捷操作"></button>
      <div class="quick-menu">
        <button class="quick-menu-btn primary" type="button" data-quick-action="create-fuel">新增补给</button>
        <button class="quick-menu-btn warn" type="button" data-quick-action="create-maintenance">新增维保</button>
        <button class="quick-menu-btn mint" type="button" data-quick-action="create-vehicle">新增车辆</button>
      </div>
    </div>
  `;
}

function shell(content, routeName) {
  state.route = routeName === "login" ? "#/login" : `#/${routeName}`;
  appEl.innerHTML = `
    <section class="screen">${content}</section>
    ${routeName === "login" ? "" : renderQuickActions()}
  `;
  setNav(routeName !== "login");
  highlightNav();
  bindQuickActions();
}

function renderLogin() {
  state.quickActionsOpen = false;
  shell(`
    <section class="auth-shell">
      <div class="hud-grid"></div>
      <div class="auth-card">
        <div class="chip accent-cyan">DRIVER AUTH</div>
        <h1>驾驶员认证</h1>
        <p class="auth-copy">接入你的骑行维护控制台，进入机库网络。</p>
        <form id="loginForm" class="auth-form">
          <label class="field"><span>用户名 / ID</span><input name="username" placeholder="admin" required /></label>
          <label class="field"><span>密码 / PASSCODE</span><input name="password" type="password" placeholder="输入密码" required /></label>
          <div id="loginError" class="inline-error hidden"></div>
          <div class="auth-actions">
            <button type="submit" class="btn btn-primary">进入控制台</button>
            <button type="button" id="registerBtn" class="btn btn-secondary">创建账号</button>
          </div>
        </form>
      </div>
    </section>
  `, "login");

    document.getElementById("loginForm").onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const errorEl = document.getElementById("loginError");
      try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload)
        });
        store.setToken(result.token);
        resetLoginFailures(payload.username);
        await bootstrapData();
        location.hash = "#/dashboard";
      } catch (err) {
        const failedCount = recordLoginFailure(payload.username);
        const baseMessage = err.message || "登录失败";
        errorEl.textContent = failedCount >= 5
          ? `${baseMessage}。已连续失败 ${failedCount} 次，请联系管理员重置密码：laoliusf911@gmail.com`
          : `${baseMessage}（已失败 ${failedCount} 次）`;
        errorEl.classList.remove("hidden");
      }
    };

  document.getElementById("registerBtn").onclick = async () => {
    const payload = Object.fromEntries(new FormData(document.getElementById("loginForm")).entries());
    const errorEl = document.getElementById("loginError");
    try {
      const result = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      store.setToken(result.token);
      await bootstrapData();
      location.hash = "#/dashboard";
    } catch (err) {
      errorEl.textContent = err.message || "注册失败";
      errorEl.classList.remove("hidden");
    }
  };
}

function renderMetricCard(title, value, details, toneClass = "", animation = null) {
  const animationAttrs = animation
    ? Object.entries(animation)
        .map(([key, item]) => `data-${key}="${escapeHtml(item)}"`)
        .join(" ")
    : "";
  return `
    <article class="metric-card ${toneClass}">
      <h2>${title}</h2>
      <div class="metric-value" ${animationAttrs}>${value}</div>
      <div class="metric-sub">${details}</div>
    </article>
  `;
}

function animateMetricCards() {
  const elements = appEl.querySelectorAll(".metric-value[data-animate]");
  elements.forEach(element => {
    const kind = element.dataset.animate;
    const duration = 850;
    const start = performance.now();

    const renderValue = progress => {
      if (kind === "currency") {
        const target = safeNumber(element.dataset.target);
        element.textContent = `¥ ${(target * progress).toFixed(2)}`;
        return;
      }

      if (kind === "number") {
        const target = safeNumber(element.dataset.target);
        element.textContent = (target * progress).toFixed(2);
        return;
      }

      if (kind === "pair") {
        const first = safeNumber(element.dataset.first);
        const second = safeNumber(element.dataset.second);
        element.textContent = `${(first * progress).toFixed(2)} / ${(second * progress).toFixed(2)}`;
      }
    };

    const tick = now => {
      const progress = Math.max(0, Math.min((now - start) / duration, 1));
      const eased = 1 - Math.pow(1 - progress, 3);
      renderValue(eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

function renderDateField(name, label, value = "", required = false) {
  return `
    <label class="field">
      <span>${label}</span>
      <div class="date-input">
        <input name="${name}" type="date" value="${escapeHtml(value)}" ${required ? "required" : ""} />
        <button type="button" class="date-trigger" data-date-trigger="${name}" aria-label="选择${label}">日历</button>
      </div>
    </label>
  `;
}

function bindDatePickerButtons(root) {
  root.querySelectorAll("[data-date-trigger]").forEach(button => {
    button.onclick = () => {
      const input = root.querySelector(`input[name="${button.dataset.dateTrigger}"]`);
      if (!input) return;
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    };
  });
}

function renderTrendPanel(trend) {
  if (!trend.length) {
    return `
      <section class="chart-panel">
        <div class="section-heading">
          <h3>趋势概览</h3>
          <span>最近 10 次平均油耗表现</span>
        </div>
        <div class="empty-box">暂无足够补给数据，至少需要两次补给记录才能计算油耗趋势。</div>
      </section>
    `;
  }

  const maxValue = Math.max(...trend.map(item => item.consumption), 1);
  const bars = trend.map(item => {
    const height = Math.max(22, (item.consumption / maxValue) * 120);
    return `
      <div class="trend-col">
        <div class="trend-bar" style="height:${height}px"></div>
        <strong>${formatNumber(item.consumption)}</strong>
        <span>${escapeHtml((item.date || "").slice(5))}</span>
      </div>
    `;
  }).join("");

  return `
    <section class="chart-panel">
      <div class="section-heading">
        <h3>趋势概览</h3>
        <span>最近 10 次平均油耗表现</span>
      </div>
      <div class="trend-chart">${bars}</div>
    </section>
  `;
}

function renderAlertPanel(alert) {
  if (!alert) return "";
  const toneClass = alert.level === "danger"
    ? "alert-danger"
    : alert.level === "warn"
      ? "alert-warn"
      : "alert-info";
  return `
    <section class="chart-panel alert-panel ${toneClass}">
      <div class="section-heading">
        <h3>${alert.title}</h3>
        <span>首页自动提醒</span>
      </div>
      <div class="service-meter">
        <div class="service-meter__value">${formatMileage(alert.remainingMileage || 0)}</div>
        <div class="service-meter__label">距离下次保养剩余里程</div>
        <div class="service-meter__track">
          <div class="service-meter__bar" style="width:${Math.max(6, Math.round((alert.ratio || 0) * 100))}%"></div>
        </div>
      </div>
      <p>${alert.body}</p>
      <div class="mini-row">
        <span>当前公里数</span>
        <strong>${formatMileage(alert.currentMileage)}</strong>
      </div>
      <div class="mini-row">
        <span>下次保养里程</span>
        <strong>${alert.nextMileage ? formatMileage(alert.nextMileage) : "未设置"}</strong>
      </div>
    </section>
  `;
}

function renderDashboard() {
  state.quickActionsOpen = false;
  const stats = calculateDashboardStats();
  const defaultVehicle = stats.defaultVehicle;
  const latestFuel = defaultVehicle ? getLatestFuelRecord(defaultVehicle.id) : null;
  const latestMaintenance = defaultVehicle ? getLatestMaintenanceRecord(defaultVehicle.id) : null;
  const alert = getMaintenanceAlert();

  shell(`
    <section class="page-shell dashboard-shell">
      <section class="hero-panel compact">
        <h1>总览控制台</h1>
        <p class="hero-copy">围绕默认车辆同步补给、维保、油耗和提醒状态，移动端首屏直接进入关键指标。</p>
      </section>

      <section class="metric-grid">
        ${renderMetricCard(
          "本月支出",
          formatCurrency(stats.monthFuelCost + stats.monthMaintenanceCost),
          `<div>油费 ${formatCurrency(stats.monthFuelCost)}</div><div>保养 ${formatCurrency(stats.monthMaintenanceCost)}</div>`,
          "tone-cyan",
          { animate: "currency", target: (stats.monthFuelCost + stats.monthMaintenanceCost).toFixed(2) }
        )}
        ${renderMetricCard(
          "总支出",
          formatCurrency(stats.totalFuelCost + stats.totalMaintenanceCost),
          `<div>油费 ${formatCurrency(stats.totalFuelCost)}</div><div>保养 ${formatCurrency(stats.totalMaintenanceCost)}</div>`,
          "tone-orange",
          { animate: "currency", target: (stats.totalFuelCost + stats.totalMaintenanceCost).toFixed(2) }
        )}
        ${renderMetricCard(
          "油耗",
          `${formatNumber(stats.latestConsumption)} / ${formatNumber(stats.averageConsumption)}`,
          `<div>本次 ${formatNumber(stats.latestConsumption)} L/100km</div><div>平均 ${formatNumber(stats.averageConsumption)} L/100km</div>`,
          "tone-mint",
          {
            animate: "pair",
            first: stats.latestConsumption.toFixed(2),
            second: stats.averageConsumption.toFixed(2)
          }
        )}
        ${renderMetricCard(
          "平均油价",
          formatCurrency(stats.avgPrice),
          `<div>${defaultVehicle ? `${escapeHtml(defaultVehicle.name)} 当前统计` : "未设置默认车辆"}</div><div>按默认车辆同步刷新</div>`,
          "tone-yellow",
          { animate: "currency", target: stats.avgPrice.toFixed(2) }
        )}
      </section>

      ${renderAlertPanel(alert)}
      ${renderTrendPanel(stats.trend)}

      <section class="dual-list">
        <article class="mini-panel">
          <div class="section-heading">
            <h3>最近补给</h3>
            <span>${latestFuel ? escapeHtml(getVehicleName(latestFuel.vehicleId)) : "暂无记录"}</span>
          </div>
          ${latestFuel ? `
            <div class="mini-row"><span>日期</span><strong>${formatDate(latestFuel.date)}</strong></div>
            <div class="mini-row"><span>里程</span><strong>${formatMileage(latestFuel.mileage)}</strong></div>
            <div class="mini-row"><span>金额</span><strong>${formatCurrency(latestFuel.totalCost)}</strong></div>
          ` : '<div class="empty-text">还没有补给记录。</div>'}
        </article>
        <article class="mini-panel">
          <div class="section-heading">
            <h3>最近维保</h3>
            <span>${latestMaintenance ? escapeHtml(getVehicleName(latestMaintenance.vehicleId)) : "暂无记录"}</span>
          </div>
          ${latestMaintenance ? `
            <div class="mini-row"><span>项目</span><strong>${escapeHtml(latestMaintenance.title)}</strong></div>
            <div class="mini-row"><span>日期</span><strong>${formatDate(latestMaintenance.date)}</strong></div>
            <div class="mini-row"><span>下次保养</span><strong>${latestMaintenance.nextMaintenanceMileage ? formatMileage(latestMaintenance.nextMaintenanceMileage) : "未填写"}</strong></div>
          ` : '<div class="empty-text">还没有维保记录。</div>'}
        </article>
      </section>
      </section>
    `, "dashboard");
  animateMetricCards();
}

function renderFuelRecord(record) {
  return `
    <article class="record-card">
      <div class="record-head">
        <div>
          <strong>${escapeHtml(getVehicleName(record.vehicleId))}</strong>
          <span>${formatDate(record.date)}</span>
        </div>
      </div>
      <div class="record-grid">
        <span>里程</span><strong>${formatMileage(record.mileage)}</strong>
        <span>升数</span><strong>${formatNumber(record.liters)} L</strong>
        <span>单价</span><strong>${formatCurrency(record.pricePerLiter)}</strong>
        <span>总价</span><strong>${formatCurrency(record.totalCost)}</strong>
        <span>状态</span><strong>${record.isFullTank ? "已加满" : "未加满"}</strong>
        <span>备注</span><strong>${escapeHtml(record.notes || "-")}</strong>
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary btn-small" type="button" data-action="edit-fuel" data-id="${record.id}">编辑</button>
        <button class="btn btn-danger btn-small" type="button" data-action="delete-fuel" data-id="${record.id}">删除</button>
      </div>
    </article>
  `;
}

function renderFuel() {
  state.quickActionsOpen = false;
  const records = getScopedFuelRecords(state.fuelFilterVehicleId);
  shell(`
    <section class="page-shell">
      <section class="hero-panel compact">
        <h1>补给记录</h1>
        <p class="hero-copy">列表仅保留筛选与编辑，新增动作统一收进全局悬浮按钮。</p>
      </section>
      <section class="toolbar-panel">
        <div class="toolbar-row">
          <div>
            <strong>车辆范围</strong>
            <p>默认车辆优先，支持切换到全部车辆查看。</p>
          </div>
          <select id="fuelFilter">${vehicleOptions(true)}</select>
        </div>
      </section>
      <section class="record-stack">
        ${records.length ? records.map(renderFuelRecord).join("") : '<article class="empty-panel"><p>暂无补给记录，使用右下角悬浮按钮新增。</p></article>'}
      </section>
    </section>
  `, "fuel");

  const select = document.getElementById("fuelFilter");
  select.value = state.fuelFilterVehicleId;
  select.onchange = event => {
    state.fuelFilterVehicleId = event.target.value;
    renderFuel();
  };

  appEl.querySelectorAll("[data-action='edit-fuel']").forEach(button => {
    button.onclick = () => openFuelModal(state.fuelRecords.find(item => item.id === Number(button.dataset.id)));
  });

  appEl.querySelectorAll("[data-action='delete-fuel']").forEach(button => {
    button.onclick = async () => {
      if (!confirm("确认删除这条补给记录？")) return;
      try {
        await apiRequest(`/api/fuel/${button.dataset.id}`, { method: "DELETE" });
        await refreshDataLists();
        showToast("补给记录已删除");
        renderFuel();
      } catch (err) {
        showToast(err.message || "删除失败", "warn");
      }
    };
  });
}

function renderMaintenanceRecord(record) {
  return `
    <article class="record-card">
      <div class="record-head">
        <div>
          <strong>${escapeHtml(record.title)}</strong>
          <span>${escapeHtml(getVehicleName(record.vehicleId))} · ${formatDate(record.date)}</span>
        </div>
      </div>
      <div class="record-grid">
        <span>费用</span><strong>${formatCurrency(record.cost)}</strong>
        <span>里程</span><strong>${formatMileage(record.mileage)}</strong>
        <span>下次保养</span><strong>${record.nextMaintenanceMileage ? formatMileage(record.nextMaintenanceMileage) : "未填写"}</strong>
        <span>备注</span><strong>${escapeHtml(record.notes || "-")}</strong>
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary btn-small" type="button" data-action="edit-maintenance" data-id="${record.id}">编辑</button>
        <button class="btn btn-danger btn-small" type="button" data-action="delete-maintenance" data-id="${record.id}">删除</button>
      </div>
    </article>
  `;
}

function renderMaintenance() {
  state.quickActionsOpen = false;
  const records = getScopedMaintenanceRecords(state.maintenanceFilterVehicleId);
  shell(`
    <section class="page-shell">
      <section class="hero-panel compact orange">
        <h1>维保工单</h1>
        <p class="hero-copy">记录本次维保和下次保养里程，首页会根据默认车辆自动给出提醒。</p>
      </section>
      <section class="toolbar-panel">
        <div class="toolbar-row">
          <div>
            <strong>车辆范围</strong>
            <p>下次保养提醒基于默认车辆最近一次维保记录。</p>
          </div>
          <select id="maintenanceFilter">${vehicleOptions(true)}</select>
        </div>
      </section>
      <section class="record-stack">
        ${records.length ? records.map(renderMaintenanceRecord).join("") : '<article class="empty-panel"><p>暂无维保记录，使用右下角悬浮按钮新增。</p></article>'}
      </section>
    </section>
  `, "maintenance");

  const select = document.getElementById("maintenanceFilter");
  select.value = state.maintenanceFilterVehicleId;
  select.onchange = event => {
    state.maintenanceFilterVehicleId = event.target.value;
    renderMaintenance();
  };

  appEl.querySelectorAll("[data-action='edit-maintenance']").forEach(button => {
    button.onclick = () => openMaintenanceModal(state.maintenanceRecords.find(item => item.id === Number(button.dataset.id)));
  });

  appEl.querySelectorAll("[data-action='delete-maintenance']").forEach(button => {
    button.onclick = async () => {
      if (!confirm("确认删除这条维保记录？")) return;
      try {
        await apiRequest(`/api/maintenance/${button.dataset.id}`, { method: "DELETE" });
        await refreshDataLists();
        showToast("维保记录已删除");
        renderMaintenance();
      } catch (err) {
        showToast(err.message || "删除失败", "warn");
      }
    };
  });
}

function renderVehicleCard(vehicle) {
  const isDefault = vehicle.id === storage.defaultVehicleId;
  const latestFuel = getLatestFuelRecord(vehicle.id);
  const currentMileage = getVehicleCurrentMileage(vehicle);
  const latestMaintenance = getLatestMaintenanceRecord(vehicle.id);
  return `
    <article class="garage-card ${isDefault ? "default" : ""}">
      <div class="record-head">
        <div>
          <strong>${escapeHtml(vehicle.name)}</strong>
          <span>${escapeHtml(vehicle.brand || "-")} ${escapeHtml(vehicle.model || "")}</span>
        </div>
      </div>
      <div class="record-grid">
        <span>当前里程</span><strong>${formatMileage(currentMileage)}</strong>
        <span>排量</span><strong>${escapeHtml(vehicle.displacement || "-")}</strong>
        <span>购入日期</span><strong>${escapeHtml(vehicle.purchaseDate || "-")}</strong>
        <span>最后补给</span><strong>${latestFuel ? formatDate(latestFuel.date) : "暂无"}</strong>
        <span>下次保养</span><strong>${latestMaintenance?.nextMaintenanceMileage ? formatMileage(latestMaintenance.nextMaintenanceMileage) : "未填写"}</strong>
        <span>备注</span><strong>${escapeHtml(vehicle.notes || "-")}</strong>
      </div>
      <div class="record-actions">
        <button class="btn ${isDefault ? "btn-outline" : "btn-secondary"} btn-small" type="button" data-action="default-vehicle" data-id="${vehicle.id}">
          ${isDefault ? "当前默认" : "设为默认"}
        </button>
        <button class="btn btn-secondary btn-small" type="button" data-action="edit-vehicle" data-id="${vehicle.id}">编辑</button>
        <button class="btn btn-danger btn-small" type="button" data-action="delete-vehicle" data-id="${vehicle.id}">删除</button>
      </div>
    </article>
  `;
}

function renderVehicle() {
  state.quickActionsOpen = false;
  const defaultVehicle = ensureDefaultVehicle();
  shell(`
    <section class="page-shell">
      <section class="hero-panel compact yellow">
        <h1>车库管理</h1>
        <p class="hero-copy">多车场景下可切换默认车辆，总览页面和提醒逻辑会同步切换。</p>
        <div class="current-default">${defaultVehicle ? `当前默认：${escapeHtml(defaultVehicle.name)}` : "尚未设置默认车辆"}</div>
      </section>
      <section class="record-stack">
        ${state.vehicles.length ? state.vehicles.map(renderVehicleCard).join("") : '<article class="empty-panel"><p>还没有车辆，使用右下角悬浮按钮新增。</p></article>'}
      </section>
    </section>
  `, "vehicle");

  appEl.querySelectorAll("[data-action='default-vehicle']").forEach(button => {
    const vehicle = state.vehicles.find(item => item.id === Number(button.dataset.id));
    if (!vehicle || vehicle.id === storage.defaultVehicleId) return;
    button.onclick = () => openDefaultVehicleModal(vehicle);
  });

  appEl.querySelectorAll("[data-action='edit-vehicle']").forEach(button => {
    button.onclick = () => openVehicleModal(state.vehicles.find(item => item.id === Number(button.dataset.id)));
  });

  appEl.querySelectorAll("[data-action='delete-vehicle']").forEach(button => {
    button.onclick = async () => {
      if (!confirm("删除车辆前请确认没有依赖记录，是否继续？")) return;
      try {
        await apiRequest(`/api/vehicle/${button.dataset.id}`, { method: "DELETE" });
        if (storage.defaultVehicleId === Number(button.dataset.id)) {
          storage.defaultVehicleId = null;
        }
        await refreshVehicles();
        await refreshDataLists();
        showToast("车辆已删除");
        renderVehicle();
      } catch (err) {
        showToast(err.message || "删除失败", "warn");
      }
    };
  });
}

function renderProfile() {
  state.quickActionsOpen = false;
  const defaultVehicle = ensureDefaultVehicle();
  shell(`
    <section class="page-shell">
      <section class="hero-panel compact">
        <h1>我的</h1>
        <p class="hero-copy">账户信息、车辆数量和默认车辆状态都在这里汇总。</p>
      </section>
      <section class="profile-panel">
        <div class="profile-row"><span>用户名</span><strong>${escapeHtml(state.me?.username || "-")}</strong></div>
        <div class="profile-row"><span>车辆数量</span><strong>${state.vehicles.length}</strong></div>
        <div class="profile-row"><span>默认车辆</span><strong>${escapeHtml(defaultVehicle?.name || "未设置")}</strong></div>
        <div class="profile-row"><span>补给记录</span><strong>${state.fuelRecords.length}</strong></div>
        <div class="profile-row"><span>维保记录</span><strong>${state.maintenanceRecords.length}</strong></div>
      </section>
      <section class="quick-note action-panel">
        <div class="section-heading account-heading">
          <div class="section-kicker">ACCOUNT CONTROL</div>
          <div>
            <strong>账号控制面板</strong>
            <p>安全操作与会话控制统一收拢在这里。</p>
          </div>
        </div>
        <div class="action-grid">
          <button id="changePasswordBtn" class="btn btn-primary action-main" type="button">修改密码</button>
          ${isAdminUser() ? '<button id="adminResetBtn" class="btn btn-secondary action-secondary" type="button">重置用户密码</button>' : ""}
          <button id="logoutBtn" class="btn btn-danger action-quiet" type="button">退出登录</button>
        </div>
        <p class="panel-footnote">修改密码后下次登录立即生效。退出后会清空本地令牌，需要重新登录。</p>
      </section>
    </section>
  `, "me");

  document.getElementById("changePasswordBtn").onclick = openChangePasswordModal;
  document.getElementById("adminResetBtn")?.addEventListener("click", openAdminResetPasswordModal);
  document.getElementById("logoutBtn").onclick = () => {
      store.setToken(null);
      state.me = null;
      state.vehicles = [];
      state.fuelRecords = [];
    state.maintenanceRecords = [];
    storage.defaultVehicleId = null;
    location.hash = "#/login";
  };
}

function openChangePasswordModal() {
  const content = `
    <form id="changePasswordForm" class="modal-form">
      <label class="field"><span>原密码</span><input name="currentPassword" type="password" autocomplete="current-password" required /></label>
      <label class="field"><span>新密码</span><input name="newPassword" type="password" autocomplete="new-password" minlength="6" required /></label>
      <label class="field"><span>确认新密码</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required /></label>
      <div id="changePasswordError" class="inline-error hidden"></div>
      <div class="modal-actions"><button class="btn btn-primary" type="submit">确认修改</button></div>
    </form>
  `;

  mountModal("修改密码", content, () => {
    document.getElementById("changePasswordForm").onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      const errorEl = document.getElementById("changePasswordError");
      if (payload.newPassword !== payload.confirmPassword) {
        errorEl.textContent = "两次输入的新密码不一致";
        errorEl.classList.remove("hidden");
        return;
      }
      try {
        await apiRequest("/api/auth/change-password", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        closeModal();
        showToast("密码修改成功");
      } catch (err) {
        errorEl.textContent = err.message || "修改密码失败";
        errorEl.classList.remove("hidden");
      }
    };
  });
}

function openAdminResetPasswordModal() {
  const content = `
    <form id="adminResetPasswordForm" class="modal-form">
      <label class="field"><span>目标用户名</span><input name="username" placeholder="输入要重置的用户名" required /></label>
      <div class="quick-note compact-note">
        <p>确认后该用户密码将被重置为 <strong>moto123</strong>。</p>
      </div>
      <div id="adminResetError" class="inline-error hidden"></div>
      <div class="modal-actions"><button class="btn btn-primary" type="submit">确认重置</button></div>
    </form>
  `;

  mountModal("管理员重置密码", content, () => {
    document.getElementById("adminResetPasswordForm").onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      const errorEl = document.getElementById("adminResetError");
      try {
        const result = await apiRequest("/api/auth/admin-reset-password", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        resetLoginFailures(payload.username);
        closeModal();
        showToast(result.message || `已重置 ${payload.username} 的密码`);
      } catch (err) {
        errorEl.textContent = err.message || "重置密码失败";
        errorEl.classList.remove("hidden");
      }
    };
  });
}

function modalChrome(title, content) {
  return `
    <div id="modalBackdrop" class="modal-backdrop">
      <section class="modal-sheet">
        <button id="closeModalBtn" class="close-btn" type="button" aria-label="关闭弹窗">×</button>
        <div class="modal-head">
          <div><strong>${title}</strong></div>
        </div>
        ${content}
      </section>
    </div>
  `;
}

function mountModal(title, content, bind) {
  closeModal();
  appEl.insertAdjacentHTML("beforeend", modalChrome(title, content));
  document.getElementById("closeModalBtn").onclick = closeModal;
  document.getElementById("modalBackdrop").onclick = event => {
    if (event.target.id === "modalBackdrop") closeModal();
  };
  bind?.();
}

function closeModal() {
  document.getElementById("modalBackdrop")?.remove();
}

function renderCurrentRoute() {
  switch (state.route) {
    case "#/fuel":
      renderFuel();
      break;
    case "#/maintenance":
      renderMaintenance();
      break;
    case "#/vehicle":
      renderVehicle();
      break;
    case "#/me":
      renderProfile();
      break;
    default:
      renderDashboard();
  }
}

function bindFuelStatusToggle(form, selected) {
  const hiddenInput = form.querySelector("input[name='isFullTank']");
  const updateActive = value => {
    hiddenInput.value = String(value);
    form.querySelectorAll("[data-status-option]").forEach(option => {
      option.classList.toggle("active", option.dataset.statusOption === String(value));
    });
  };
  form.querySelectorAll("[data-status-option]").forEach(option => {
    option.onclick = () => updateActive(option.dataset.statusOption === "true");
  });
  updateActive(selected);
}

function openFuelModal(item = null) {
  const content = `
    <form id="fuelForm" class="modal-form">
      ${renderDateField("date", "日期", item?.date || "", true)}
      <label class="field"><span>车辆</span><select name="vehicleId">${vehicleOptions(false)}</select></label>
      <label class="field"><span>里程</span><input name="mileage" type="number" value="${escapeHtml(item?.mileage ?? "")}" required /></label>
      <label class="field"><span>升数</span><input name="liters" type="number" step="0.01" value="${escapeHtml(item?.liters ?? "")}" required /></label>
      <label class="field"><span>单价</span><input name="pricePerLiter" type="number" step="0.01" value="${escapeHtml(item?.pricePerLiter ?? "")}" required /></label>
      <label class="field"><span>总价</span><input name="totalCost" type="number" step="0.01" value="${escapeHtml(item?.totalCost ?? "")}" required /></label>
      <div class="field">
        <span>加满状态</span>
        <input name="isFullTank" type="hidden" value="${item?.isFullTank === false ? "false" : "true"}" />
        <div class="status-toggle">
          <button class="status-option" type="button" data-status-option="true">已加满</button>
          <button class="status-option" type="button" data-status-option="false">未加满</button>
        </div>
      </div>
      <label class="field"><span>备注</span><textarea name="notes">${escapeHtml(item?.notes || "")}</textarea></label>
      <div class="modal-actions"><button class="btn btn-primary" type="submit">${item ? "更新补给" : "保存补给"}</button></div>
    </form>
  `;

  mountModal(item ? "编辑补给任务" : "新增补给任务", content, () => {
    const form = document.getElementById("fuelForm");
    bindDatePickerButtons(form);
    form.vehicleId.value = String(item?.vehicleId || ensureDefaultVehicle()?.id || state.vehicles[0]?.id || "");
    bindFuelStatusToggle(form, item?.isFullTank !== false);
    form.onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.vehicleId = Number(payload.vehicleId);
      payload.mileage = Number(payload.mileage);
      payload.liters = Number(payload.liters);
      payload.pricePerLiter = Number(payload.pricePerLiter);
      payload.totalCost = Number(payload.totalCost);
      payload.isFullTank = payload.isFullTank === "true";
      try {
        if (item) {
          await apiRequest(`/api/fuel/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          await apiRequest("/api/fuel", { method: "POST", body: JSON.stringify(payload) });
        }
        await refreshDataLists();
        closeModal();
        showToast(item ? "补给记录已更新" : "补给记录已保存");
        renderCurrentRoute();
      } catch (err) {
        showToast(err.message || "保存失败", "warn");
      }
    };
  });
}

function openMaintenanceModal(item = null) {
  const content = `
    <form id="maintenanceForm" class="modal-form">
      ${renderDateField("date", "日期", item?.date || "", true)}
      <label class="field"><span>车辆</span><select name="vehicleId">${vehicleOptions(false)}</select></label>
      <label class="field"><span>维保项目</span><input name="title" value="${escapeHtml(item?.title || "")}" placeholder="机油 / 机滤" required /></label>
      <div class="preset-grid modal-preset-grid">
        ${maintenancePresetOptions.map(option => `<button type="button" class="preset-btn" data-preset="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}
      </div>
      <label class="field"><span>费用</span><input name="cost" type="number" step="0.01" value="${escapeHtml(item?.cost ?? "")}" required /></label>
      <label class="field"><span>本次里程</span><input name="mileage" type="number" value="${escapeHtml(item?.mileage ?? "")}" required /></label>
      <label class="field"><span>下次保养里程</span><input name="nextMaintenanceMileage" type="number" value="${escapeHtml(item?.nextMaintenanceMileage ?? "")}" /></label>
      <label class="field"><span>备注</span><textarea name="notes">${escapeHtml(item?.notes || "")}</textarea></label>
      <div class="modal-actions"><button class="btn btn-primary warn" type="submit">${item ? "更新维保" : "保存维保"}</button></div>
    </form>
  `;

  mountModal(item ? "编辑维保工单" : "新增维保工单", content, () => {
    const form = document.getElementById("maintenanceForm");
    bindDatePickerButtons(form);
    form.vehicleId.value = String(item?.vehicleId || ensureDefaultVehicle()?.id || state.vehicles[0]?.id || "");
    form.querySelectorAll("[data-preset]").forEach(button => {
      button.onclick = () => {
        const current = form.title.value.trim();
        const parts = current ? current.split(/[、/，,\s]+/).filter(Boolean) : [];
        if (!parts.includes(button.dataset.preset)) parts.push(button.dataset.preset);
        form.title.value = parts.join(" / ");
      };
    });
    form.onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.vehicleId = Number(payload.vehicleId);
      payload.cost = Number(payload.cost);
      payload.mileage = Number(payload.mileage);
      payload.nextMaintenanceMileage = Number(payload.nextMaintenanceMileage || 0);
      try {
        if (item) {
          await apiRequest(`/api/maintenance/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          await apiRequest("/api/maintenance", { method: "POST", body: JSON.stringify(payload) });
        }
        await refreshDataLists();
        closeModal();
        showToast(item ? "维保记录已更新" : "维保记录已保存");
        renderCurrentRoute();
      } catch (err) {
        showToast(err.message || "保存失败", "warn");
      }
    };
  });
}

function openVehicleModal(item = null) {
  const content = `
    <form id="vehicleForm" class="modal-form">
      <label class="field"><span>名称</span><input name="name" value="${escapeHtml(item?.name || "")}" required /></label>
      <label class="field"><span>品牌</span><input name="brand" value="${escapeHtml(item?.brand || "")}" /></label>
      <label class="field"><span>型号</span><input name="model" value="${escapeHtml(item?.model || "")}" /></label>
      <label class="field"><span>排量</span><input name="displacement" value="${escapeHtml(item?.displacement || "")}" /></label>
      ${renderDateField("purchaseDate", "购入日期", item?.purchaseDate || "", false)}
      <label class="field"><span>初始里程</span><input name="currentMileage" type="number" value="${escapeHtml(item?.currentMileage ?? 0)}" /></label>
      <label class="field"><span>备注</span><textarea name="notes">${escapeHtml(item?.notes || "")}</textarea></label>
      <div class="modal-actions"><button class="btn btn-primary" type="submit">${item ? "更新车辆" : "保存车辆"}</button></div>
    </form>
  `;

  mountModal(item ? "编辑车辆档案" : "新增车辆档案", content, () => {
    const form = document.getElementById("vehicleForm");
    bindDatePickerButtons(form);
    form.onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.currentMileage = Number(payload.currentMileage || 0);
      try {
        let created = null;
        if (item) {
          await apiRequest(`/api/vehicle/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          created = await apiRequest("/api/vehicle", { method: "POST", body: JSON.stringify(payload) });
        }
        await refreshVehicles();
        await refreshDataLists();
        if (!storage.defaultVehicleId && created?.id) storage.defaultVehicleId = created.id;
        closeModal();
        showToast(item ? "车辆已更新" : "车辆已保存");
        renderCurrentRoute();
      } catch (err) {
        showToast(err.message || "保存失败", "warn");
      }
    };
  });
}

function openDefaultVehicleModal(vehicle) {
  const current = ensureDefaultVehicle();
  mountModal("设为默认车辆", `
    <section class="confirm-copy">
      <p>当前默认：<strong>${escapeHtml(current?.name || "未设置")}</strong></p>
      <p>切换后，总览页统计、最近记录和维保提醒都会改为 <strong>${escapeHtml(vehicle.name)}</strong> 的数据。</p>
    </section>
    <div class="modal-actions">
      <button id="confirmDefaultBtn" class="btn btn-primary warn" type="button">确认切换</button>
      <button id="cancelDefaultBtn" class="btn btn-secondary" type="button">取消</button>
    </div>
  `, () => {
    document.getElementById("confirmDefaultBtn").onclick = async () => {
      storage.defaultVehicleId = vehicle.id;
      await refreshDataLists();
      closeModal();
      showToast(`已切换默认车辆：${vehicle.name}`);
      renderCurrentRoute();
    };
    document.getElementById("cancelDefaultBtn").onclick = closeModal;
  });
}

function bindQuickActions() {
  const quickRoot = appEl.querySelector(".quick-actions");
  const quickFab = document.getElementById("quickFab");
  if (!quickRoot || !quickFab) return;

  quickFab.onclick = () => {
    state.quickActionsOpen = !state.quickActionsOpen;
    quickRoot.classList.toggle("open", state.quickActionsOpen);
  };

  appEl.querySelectorAll("[data-quick-action]").forEach(button => {
    button.onclick = () => {
      state.quickActionsOpen = false;
      quickRoot.classList.remove("open");
      switch (button.dataset.quickAction) {
        case "create-fuel":
          openFuelModal();
          break;
        case "create-maintenance":
          openMaintenanceModal();
          break;
        case "create-vehicle":
          openVehicleModal();
          break;
        default:
          break;
      }
    };
  });
}

async function handleRoute() {
  const hash = location.hash || "#/dashboard";
  state.route = hash;

  if (!store.token && hash !== "#/login") {
    location.hash = "#/login";
    return;
  }

  if (!store.token) {
    renderLogin();
    return;
  }

  if (!state.me) {
    try {
      await bootstrapData();
    } catch (_err) {
      store.setToken(null);
      state.me = null;
      location.hash = "#/login";
      return;
    }
  }

  switch (hash) {
    case "#/dashboard":
      renderDashboard();
      break;
    case "#/fuel":
      renderFuel();
      break;
    case "#/maintenance":
      renderMaintenance();
      break;
    case "#/vehicle":
      renderVehicle();
      break;
    case "#/me":
      renderProfile();
      break;
    case "#/login":
      renderLogin();
      break;
    default:
      location.hash = "#/dashboard";
  }
}

window.addEventListener("hashchange", handleRoute);
window.addEventListener("load", handleRoute);
