/**
 * ============================================================
 *  OmniSync Logistics — js/services.js
 *  DataOrchestrator + EfficiencyEngine + AnomalyDetector
 * ============================================================
 */

'use strict';

// ── DataOrchestrator: Three mock enterprise API streams ──────
const DataOrchestrator = (() => {

  const rand = (base, variance) => +(base + (Math.random() * variance * 2 - variance)).toFixed(3);
  const randInt = (base, spread) => base + Math.floor(Math.random() * spread);

  /** Stream A — SAP ERP Financials */
  const fetchFinancials = () => new Promise(resolve =>
    setTimeout(() => resolve({
      source: 'SAP_ERP', streamId: 'A', timestamp: Date.now(),
      revenue:             4820000 + randInt(0, 180000),
      outstandingInvoices: 312400  + randInt(0, 50000),
      invoiceCount:        47      + randInt(0, 8),
      cashflow:            1240000 + randInt(0, 60000),
      revenueChange:       +rand(2.4, 1.0).toFixed(2),
    }), 400 + Math.random() * 200)
  );

  /** Stream B — IoT / Fleet Tracker Operations */
  const fetchOperations = () => new Promise(resolve =>
    setTimeout(() => resolve({
      source: 'IoT_FLEET', streamId: 'B', timestamp: Date.now(),
      activeTrucks:        38  + randInt(0, 4),
      totalFleet:          54,
      avgFuelConsumption:  +rand(8.4, 0.6).toFixed(2),
      fuelCostPerKm:       +rand(1.28, 0.18).toFixed(3),
      deliveriesCompleted: 142 + randInt(0, 15),
      deliveryEfficiency:  +rand(88, 5).toFixed(1),
      avgDeliveryTime:     +rand(4.2, 0.4).toFixed(1),
      fleetStatus: [
        { id:'TRK-001', route:'Mumbai → Delhi',          status:'IN_TRANSIT',  eta:'14:30', fuel:72, driver:'R. Sharma' },
        { id:'TRK-007', route:'Ahmedabad → Pune',        status:'IN_TRANSIT',  eta:'16:15', fuel:58, driver:'K. Patel'  },
        { id:'TRK-014', route:'Chennai → Bangalore',     status:'DELAYED',     eta:'18:45', fuel:44, driver:'S. Iyer'   },
        { id:'TRK-022', route:'Depot — Bay 3',           status:'MAINTENANCE', eta:'—',     fuel:100,driver:'—'         },
        { id:'TRK-031', route:'Delhi → Jaipur',          status:'IN_TRANSIT',  eta:'13:00', fuel:81, driver:'A. Singh'  },
        { id:'TRK-038', route:'Hyderabad → Vizag',       status:'IN_TRANSIT',  eta:'19:20', fuel:63, driver:'M. Reddy'  },
        { id:'TRK-042', route:'Depot — Bay 7',           status:'MAINTENANCE', eta:'—',     fuel:100,driver:'—'         },
        { id:'TRK-049', route:'Kolkata → Bhubaneswar',   status:'DELAYED',     eta:'20:10', fuel:29, driver:'P. Das'    },
      ],
    }), 300 + Math.random() * 200)
  );

  /** Stream C — Salesforce CRM */
  const fetchCRM = () => new Promise(resolve =>
    setTimeout(() => resolve({
      source: 'SALESFORCE_CRM', streamId: 'C', timestamp: Date.now(),
      newLeads:                  24  + randInt(0, 6),
      activeContracts:           89,
      contractsClosingThisMonth: 7   + randInt(0, 3),
      pipelineValue:             3150000 + randInt(0, 200000),
      churnRisk:                 randInt(2, 5),
      conversionRate:            +rand(34, 3).toFixed(1),
    }), 500 + Math.random() * 300)
  );

  /**
   * orchestrate() — Fans out all streams in parallel.
   * Uses Promise.allSettled so one failing stream never blocks others.
   */
  const orchestrate = async () => {
    const t0 = performance.now();
    const [finRes, opsRes, crmRes] = await Promise.allSettled([
      fetchFinancials(), fetchOperations(), fetchCRM()
    ]);
    const latency = +(performance.now() - t0).toFixed(0);
    return {
      latency,
      health: {
        streamA: finRes.status === 'fulfilled' ? 'healthy' : 'error',
        streamB: opsRes.status === 'fulfilled' ? 'healthy' : 'error',
        streamC: crmRes.status === 'fulfilled' ? 'healthy' : 'error',
      },
      financials: finRes.status === 'fulfilled' ? finRes.value : null,
      operations: opsRes.status === 'fulfilled' ? opsRes.value : null,
      crm:        crmRes.status === 'fulfilled' ? crmRes.value : null,
    };
  };

  return { orchestrate };
})();


// ── EfficiencyEngine: Weighted composite score ───────────────
/**
 * Weights:  Financial 30% | Fleet Ops 45% | CRM 25%
 * Returns:  { composite, financialScore, fleetScore, crmScore }
 */
const EfficiencyEngine = {
  calculate(financials, operations, crm) {
    if (!financials || !operations || !crm) return null;

    // Financial: AR turnover proxy — lower AR ratio = healthier cashflow
    const arRatio       = 1 - (financials.outstandingInvoices / financials.revenue);
    const financialScore = Math.min(100, Math.max(0, arRatio * 130));

    // Fleet: delivery efficiency weighted by inverse fuel cost index
    const fuelIndex  = Math.max(0, 1 - (operations.fuelCostPerKm - 1.0) / 0.8);
    const fleetScore = (operations.deliveryEfficiency * 0.7) + (fuelIndex * 30);

    // CRM: conversion rate + contract delivery saturation
    const saturation = Math.min(100, (operations.deliveriesCompleted / 160) * 100);
    const crmScore   = (crm.conversionRate * 0.6) + (saturation * 0.4);

    const composite = (financialScore * 0.30) + (fleetScore * 0.45) + (crmScore * 0.25);
    return {
      composite:      +composite.toFixed(1),
      financialScore: +financialScore.toFixed(1),
      fleetScore:     +fleetScore.toFixed(1),
      crmScore:       +crmScore.toFixed(1),
    };
  }
};


// ── AnomalyDetector: Rule-based threshold engine ─────────────
const THRESHOLDS = {
  fuelCostPerKm:           { warn: 1.35, critical: 1.55 },
  deliveryEfficiency:      { warn: 85,   critical: 78   },
  churnRisk:               { warn: 4,    critical: 7    },
  outstandingInvoiceRatio: { warn: 0.08, critical: 0.12 },
};

const AnomalyDetector = {
  detect(financials, operations, crm) {
    const anomalies = [];
    const ts = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    const uid = () => Math.random().toString(36).slice(2, 8);

    if (operations) {
      const fc = operations.fuelCostPerKm;
      if (fc >= THRESHOLDS.fuelCostPerKm.critical)
        anomalies.push({ id:`fc-${uid()}`, severity:'CRITICAL', stream:'B', icon:'⛽', title:'Fuel Cost Spike',         detail:`₹${fc}/km exceeds critical threshold`, time: ts });
      else if (fc >= THRESHOLDS.fuelCostPerKm.warn)
        anomalies.push({ id:`fc-${uid()}`, severity:'WARNING',  stream:'B', icon:'⛽', title:'Elevated Fuel Cost',       detail:`₹${fc}/km above normal range`,          time: ts });

      const de = operations.deliveryEfficiency;
      if (de <= THRESHOLDS.deliveryEfficiency.critical)
        anomalies.push({ id:`de-${uid()}`, severity:'CRITICAL', stream:'B', icon:'📦', title:'Delivery Efficiency Drop', detail:`${de}% — SLA breach risk`,               time: ts });
      else if (de <= THRESHOLDS.deliveryEfficiency.warn)
        anomalies.push({ id:`de-${uid()}`, severity:'WARNING',  stream:'B', icon:'📦', title:'Delivery Efficiency Low',  detail:`${de}% — monitor closely`,              time: ts });
    }

    if (crm) {
      const cr = crm.churnRisk;
      if (cr >= THRESHOLDS.churnRisk.critical)
        anomalies.push({ id:`cr-${uid()}`, severity:'CRITICAL', stream:'C', icon:'🔴', title:'High Churn Risk',          detail:`${cr} accounts flagged for churn`,       time: ts });
      else if (cr >= THRESHOLDS.churnRisk.warn)
        anomalies.push({ id:`cr-${uid()}`, severity:'WARNING',  stream:'C', icon:'⚠️', title:'Churn Risk Elevated',      detail:`${cr} at-risk accounts detected`,        time: ts });
    }

    if (financials) {
      const ratio = financials.outstandingInvoices / financials.revenue;
      if (ratio >= THRESHOLDS.outstandingInvoiceRatio.critical)
        anomalies.push({ id:`ar-${uid()}`, severity:'CRITICAL', stream:'A', icon:'💳', title:'AR Ratio Critical',        detail:`Outstanding: ₹${(financials.outstandingInvoices/1000).toFixed(0)}K (${(ratio*100).toFixed(1)}% of rev)`, time: ts });
      else if (ratio >= THRESHOLDS.outstandingInvoiceRatio.warn)
        anomalies.push({ id:`ar-${uid()}`, severity:'WARNING',  stream:'A', icon:'💳', title:'AR Ratio Warning',         detail:`Outstanding invoices at ${(ratio*100).toFixed(1)}% of revenue`, time: ts });
    }

    return anomalies;
  }
};
