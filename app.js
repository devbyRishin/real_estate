/**
 * ============================================================
 *  OmniSync Logistics — js/app.js
 *  Global State + UI Renderer + Event Wiring
 * ============================================================
 */

'use strict';

// ── Global State ─────────────────────────────────────────────
const State = {
  financials:      null,
  operations:      null,
  crm:             null,
  health:          { streamA: 'pending', streamB: 'pending', streamC: 'pending' },
  latency:         0,
  efficiencyScore: null,
  anomalyLog:      [],   // ring-buffer, max 20
  sparkHistory:    { revenue: [], efficiency: [], leads: [], fuel: [] },
  lastUpdated:     null,
  sidebarCollapsed: false,
  activeTab:       'dashboard',
  initialized:     false,
};

// ── Sparkline seeds ──────────────────────────────────────────
const seedSpark = (base, variance, n = 10) =>
  Array.from({ length: n }, () => +(base + (Math.random() * variance * 2 - variance)).toFixed(2));

State.sparkHistory.revenue    = seedSpark(48,  4);
State.sparkHistory.efficiency = seedSpark(87,  5);
State.sparkHistory.leads      = seedSpark(24,  4);
State.sparkHistory.fuel       = seedSpark(1.28, 0.15);

// ── Helpers ──────────────────────────────────────────────────
const fmt = {
  lakh: v => `₹${(v / 100000).toFixed(1)}L`,
  pct:  v => `${v}%`,
  fuel: v => `₹${v}`,
  num:  v => v.toLocaleString('en-IN'),
};

const $ = id => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
const setHTML = (id, v) => { const el = $(id); if (el) el.innerHTML = v; };

// ── Sparkline SVG renderer ───────────────────────────────────
function buildSparklineSVG(data, color) {
  if (!data || data.length < 2) return '';
  const W = 80, H = 28;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = pts.trim().split(' ').pop().split(',');
  return `
    <svg width="${W}" height="${H}" class="sparkline-svg" overflow="visible">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${color}"/>
    </svg>`;
}

// ── Efficiency Gauge SVG ─────────────────────────────────────
function renderGauge(score) {
  if (!score) return;
  const pct = score.composite;
  const color = pct >= 85 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  $('gauge-circle').setAttribute('stroke', color);
  $('gauge-circle').style.strokeDasharray = circ;
  $('gauge-circle').style.strokeDashoffset = offset;
  $('gauge-value').textContent = pct;
  $('gauge-value').style.color = color;

  const bars = [
    { id:'bar-fin', val: score.financialScore, color:'#6366f1' },
    { id:'bar-flt', val: score.fleetScore,     color:'#10b981' },
    { id:'bar-crm', val: score.crmScore,       color:'#f59e0b' },
  ];
  bars.forEach(b => {
    const el = $(b.id);
    if (el) { el.style.width = `${b.val}%`; el.style.background = b.color; }
    const vEl = $(`${b.id}-val`);
    if (vEl) vEl.textContent = b.val;
  });
}

// ── KPI Tiles renderer ───────────────────────────────────────
function renderTiles() {
  const { financials: fin, operations: ops, crm, sparkHistory: sp } = State;
  if (!fin || !ops || !crm) return;

  // Update spark histories
  sp.revenue.push(+(fin.revenue / 100000).toFixed(1));     if (sp.revenue.length > 12) sp.revenue.shift();
  sp.efficiency.push(ops.deliveryEfficiency);               if (sp.efficiency.length > 12) sp.efficiency.shift();
  sp.leads.push(crm.newLeads);                              if (sp.leads.length > 12) sp.leads.shift();
  sp.fuel.push(ops.fuelCostPerKm);                         if (sp.fuel.length > 12) sp.fuel.shift();

  const tiles = [
    {
      id: 'tile-revenue',
      value: fmt.lakh(fin.revenue),
      delta: fin.revenueChange,
      deltaLabel: '% vs last month',
      up: fin.revenueChange >= 0,
      sub: `${fin.invoiceCount} invoices raised`,
      spark: sp.revenue,
      sparkColor: '#10b981',
    },
    {
      id: 'tile-efficiency',
      value: fmt.pct(ops.deliveryEfficiency),
      delta: +(ops.deliveryEfficiency - 88).toFixed(1),
      deltaLabel: '% vs baseline',
      up: ops.deliveryEfficiency >= 88,
      sub: `${ops.deliveriesCompleted} deliveries today`,
      spark: sp.efficiency,
      sparkColor: '#6366f1',
    },
    {
      id: 'tile-pipeline',
      value: fmt.lakh(crm.pipelineValue),
      delta: crm.newLeads,
      deltaLabel: ' new leads',
      up: true,
      sub: `${crm.activeContracts} active contracts`,
      spark: sp.leads,
      sparkColor: '#f59e0b',
    },
    {
      id: 'tile-fuel',
      value: fmt.fuel(ops.fuelCostPerKm),
      deltaVal: -+(ops.fuelCostPerKm - 1.28).toFixed(3),
      delta: -+(ops.fuelCostPerKm - 1.28).toFixed(3),
      deltaLabel: ' vs avg',
      up: ops.fuelCostPerKm <= 1.28,
      sub: `${ops.avgFuelConsumption}L/100km fleet avg`,
      spark: sp.fuel,
      sparkColor: '#f87171',
    },
  ];

  tiles.forEach(t => {
    const tile = $(t.id);
    if (!tile) return;
    tile.querySelector('.tile-value').textContent = t.value;
    const dEl = tile.querySelector('.tile-delta');
    dEl.className = `tile-delta ${t.up ? 'up' : 'down'}`;
    dEl.innerHTML = `<span>${t.up ? '▲' : '▼'}</span><span>${Math.abs(t.delta)}${t.deltaLabel}</span>`;
    tile.querySelector('.tile-sub').textContent = t.sub;
    tile.querySelector('.tile-spark').innerHTML = buildSparklineSVG(t.spark, t.sparkColor);
  });
}

// ── Stream health dots ────────────────────────────────────────
function renderHealth() {
  const h = State.health;
  ['A','B','C'].forEach((k, i) => {
    const key = `stream${k}`;
    const dots = document.querySelectorAll(`.hdot-${i+1}`);
    dots.forEach(d => {
      d.className = `stream-dot ${h[key]}`;
    });
    const tag = $(`stream-tag-${i+1}`);
    if (tag) { tag.className = `stream-tag ${h[key]}`; tag.textContent = ['FIN','OPS','CRM'][i]; }
  });
  setText('latency-val', `${State.latency}ms`);
  if (State.lastUpdated)
    setText('sync-val', State.lastUpdated.toLocaleTimeString('en-IN'));
  // topbar health
  ['A','B','C'].forEach((k, i) => {
    const dot = $(`topbar-dot-${i+1}`);
    if (dot) dot.className = `stream-dot ${h[`stream${k}`]}`;
  });
}

// ── Anomaly feed renderer ─────────────────────────────────────
function renderAnomalies() {
  const feed = $('anomaly-feed');
  const countEl = $('anomaly-count');
  const log = State.anomalyLog;

  if (countEl) {
    if (log.length > 0) {
      countEl.style.display = 'flex';
      countEl.querySelector('span:last-child').textContent = log.length;
    } else {
      countEl.style.display = 'none';
    }
  }

  if (!feed) return;
  if (log.length === 0) {
    feed.innerHTML = `
      <div class="no-anomalies">
        <span>✓</span> All streams nominal — no anomalies detected
      </div>`;
    return;
  }
  feed.innerHTML = log.map(a => `
    <div class="anomaly-item ${a.severity}">
      <div class="anomaly-pulse"></div>
      <div class="anomaly-body">
        <div class="anomaly-title-row">
          <span class="anomaly-name">${a.icon} ${a.title}</span>
          <span class="anomaly-badge">${a.severity}</span>
          <span class="stream-chip">Stream ${a.stream}</span>
        </div>
        <div class="anomaly-detail">${a.detail}</div>
      </div>
      <span class="anomaly-time">${a.time}</span>
    </div>`).join('');
}

// ── Fleet table renderer ──────────────────────────────────────
function renderFleet() {
  const tbody = $('fleet-tbody');
  const fleet = State.operations?.fleetStatus;
  if (!tbody || !fleet) return;

  const badgeMap = {
    IN_TRANSIT:  { cls:'badge-transit',     label:'In Transit'  },
    DELAYED:     { cls:'badge-delayed',     label:'Delayed'     },
    MAINTENANCE: { cls:'badge-maintenance', label:'Maintenance' },
  };

  tbody.innerHTML = fleet.map(t => {
    const b = badgeMap[t.status] || badgeMap.MAINTENANCE;
    const fuelCls = t.fuel > 50 ? 'fuel-high' : t.fuel > 25 ? 'fuel-mid' : 'fuel-low';
    return `
      <tr>
        <td><span class="unit-id">${t.id}</span></td>
        <td>${t.route}</td>
        <td>
          <span class="status-badge ${b.cls}">
            <span class="dot"></span>${b.label}
          </span>
        </td>
        <td style="font-family:'DM Mono',monospace">${t.eta}</td>
        <td>
          <div class="fuel-wrap">
            <div class="fuel-track"><div class="fuel-fill ${fuelCls}" style="width:${t.fuel}%"></div></div>
            <span class="fuel-pct">${t.fuel}%</span>
          </div>
        </td>
        <td style="color:var(--text-500)">${t.driver}</td>
      </tr>`;
  }).join('');

  // Fleet subtitle
  const sub = $('fleet-subtitle');
  if (sub && State.operations)
    sub.textContent = `${State.operations.activeTrucks}/${State.operations.totalFleet} units active · Real-time IoT telemetry`;
}

// ── Main data refresh cycle ───────────────────────────────────
async function refresh() {
  try {
    const result = await DataOrchestrator.orchestrate();
    const { financials, operations, crm, health, latency } = result;

    State.financials      = financials;
    State.operations      = operations;
    State.crm             = crm;
    State.health          = health;
    State.latency         = latency;
    State.lastUpdated     = new Date();
    State.efficiencyScore = EfficiencyEngine.calculate(financials, operations, crm);

    // Anomaly detection — prepend, ring-buffer to 20
    const newAnomalies = AnomalyDetector.detect(financials, operations, crm);
    if (newAnomalies.length > 0)
      State.anomalyLog = [...newAnomalies, ...State.anomalyLog].slice(0, 20);

    // Render all UI
    renderHealth();
    renderTiles();
    renderGauge(State.efficiencyScore);
    renderAnomalies();
    renderFleet();

    // Push to chart
    if (operations && financials)
      ChartManager.push(
        operations.deliveryEfficiency,
        operations.fuelCostPerKm,
        operations.deliveriesCompleted
      );

    // Hide loading overlay on first success
    if (!State.initialized) {
      State.initialized = true;
      const overlay = $('loading-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 600);
      }
    }
  } catch (err) {
    console.error('[OmniSync] Refresh error:', err);
  }
}

// ── Navigation ────────────────────────────────────────────────
function setActiveTab(tabId) {
  State.activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabId);
    const dot = el.querySelector('.nav-dot');
    if (dot) dot.style.display = el.dataset.tab === tabId ? 'block' : 'none';
  });
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${tabId}`);
  });
}

// ── Sidebar collapse ──────────────────────────────────────────
function toggleSidebar() {
  State.sidebarCollapsed = !State.sidebarCollapsed;
  const sidebar = $('sidebar');
  const btn = $('toggle-btn');
  sidebar.classList.toggle('collapsed', State.sidebarCollapsed);
  btn.textContent = State.sidebarCollapsed ? '›' : '‹';
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Date in topbar
  setText('topbar-date', new Date().toLocaleDateString('en-IN', {
    weekday:'short', day:'2-digit', month:'short', year:'numeric'
  }));

  // Nav wiring
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => setActiveTab(el.dataset.tab));
  });

  // Sidebar toggle
  $('toggle-btn')?.addEventListener('click', toggleSidebar);

  // Init chart
  ChartManager.init();

  // First data load, then poll every 8s
  refresh();
  setInterval(refresh, 8000);
});
