/**
 * ============================================================
 *  OmniSync Logistics — js/chart.js
 *  Multi-axis performance chart using Chart.js
 * ============================================================
 */

'use strict';

const ChartManager = (() => {
  let chart = null;
  const MAX_POINTS = 15;

  const labels   = [];
  const effData  = [];
  const fuelData = [];
  const delData  = [];

  // Seed with realistic initial data
  const seed = () => {
    const now = new Date();
    for (let i = MAX_POINTS - 1; i >= 0; i--) {
      const d = new Date(now - i * 8000);
      labels.push(d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
      effData.push(+(87 + (Math.random() * 8 - 4)).toFixed(1));
      fuelData.push(+(1.24 + (Math.random() * 0.28 - 0.14)).toFixed(3));
      delData.push(142 + Math.floor(Math.random() * 15));
    }
  };

  const init = () => {
    seed();
    const ctx = document.getElementById('perf-chart');
    if (!ctx) return;

    Chart.defaults.color = '#52525b';
    Chart.defaults.font.family = "'DM Mono', monospace";

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Delivery Efficiency %',
            data: effData,
            type: 'line',
            yAxisID: 'yEff',
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#10b981',
            fill: true,
            tension: 0.4,
            order: 1,
          },
          {
            label: 'Fuel Cost ₹/km',
            data: fuelData,
            type: 'bar',
            yAxisID: 'yFuel',
            backgroundColor: 'rgba(245,158,11,0.18)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 3,
            order: 2,
          },
          {
            label: 'Deliveries Completed',
            data: delData,
            type: 'line',
            yAxisID: 'yDel',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            pointHoverRadius: 3,
            fill: false,
            tension: 0.3,
            order: 0,
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: { size: 11, family: "'DM Sans', sans-serif" },
              color: '#52525b',
              boxWidth: 10,
              boxHeight: 10,
              padding: 16,
              usePointStyle: true,
            }
          },
          tooltip: {
            backgroundColor: '#18181b',
            borderColor: '#3f3f46',
            borderWidth: 1,
            padding: 10,
            titleColor: '#71717a',
            bodyColor: '#d4d4d8',
            titleFont: { family: "'DM Mono', monospace", size: 10 },
            bodyFont:  { family: "'DM Mono', monospace", size: 11 },
            callbacks: {
              title: items => items[0].label,
              label: item => ` ${item.dataset.label}: ${item.formattedValue}`,
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(39,39,42,0.8)', drawBorder: false },
            ticks: {
              font: { size: 9, family: "'DM Mono', monospace" },
              color: '#3f3f46',
              maxTicksLimit: 6,
              maxRotation: 0,
            },
          },
          yEff: {
            type: 'linear', position: 'left',
            min: 70, max: 100,
            grid: { color: 'rgba(39,39,42,0.8)', drawBorder: false },
            ticks: { font: { size: 9 }, color: '#10b981', stepSize: 5 },
            title: { display: true, text: 'Efficiency %', color: '#10b981', font: { size: 9, family: "'DM Mono'" } }
          },
          yFuel: {
            type: 'linear', position: 'right',
            min: 1.0, max: 1.8,
            grid: { display: false },
            ticks: { font: { size: 9 }, color: '#f59e0b' },
            title: { display: true, text: 'Fuel ₹/km', color: '#f59e0b', font: { size: 9, family: "'DM Mono'" } }
          },
          yDel: {
            type: 'linear', position: 'right',
            display: false,
            min: 100, max: 200,
          },
        }
      }
    });
  };

  const push = (efficiency, fuelCost, deliveries) => {
    if (!chart) return;
    const t = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    labels.push(t);
    effData.push(efficiency);
    fuelData.push(fuelCost);
    delData.push(deliveries);
    if (labels.length > MAX_POINTS) {
      labels.shift(); effData.shift(); fuelData.shift(); delData.shift();
    }
    chart.update('active');
  };

  return { init, push };
})();
