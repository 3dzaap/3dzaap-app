import { describe, it, expect } from 'vitest';
import { computeResults } from '../calculator-v2.js';

describe('calculator-v2.js', () => {
  const defaultInputs = {
    mode: 'simple',
    tech: 'fdm',
    materialPrice: 20, // 20€/kg
    weight: 100,      // 100g
    time: 5,           // 5h
    printerPrice: 500,
    printerLife: 5000,
    powerConsumption: 200, // 200W
    electricityPrice: 0.20,
    failureRate: 5,
    indirectCosts: 10,
    profitMargin: 30
  };

  it('should calculate correct material cost in simple mode', () => {
    const r = computeResults(defaultInputs);
    // (20 / 1000) * 100 = 2.0
    expect(r.materialCost).toBeCloseTo(2.0, 2);
  });

  it('should calculate correct amortization cost in simple mode', () => {
    const r = computeResults(defaultInputs);
    // (500 / 5000) * 5 = 0.5
    expect(r.amortizationCost).toBeCloseTo(0.5, 2);
  });

  it('should calculate correct electricity cost in simple mode', () => {
    const r = computeResults(defaultInputs);
    // (200 / 1000) * 5 * 0.20 = 0.2
    expect(r.electricityCost).toBeCloseTo(0.2, 2);
  });

  it('should calculate correct final price', () => {
    const r = computeResults(defaultInputs);
    // base = 2.0 + 0.5 + 0.2 = 2.7
    // fail = 2.7 * 0.05 = 0.135
    // ind = 2.7 * 0.10 = 0.27
    // prod = 2.7 + 0.135 + 0.27 = 3.105
    // margin = 3.105 * 0.30 = 0.9315
    // final = 3.105 + 0.9315 = 4.0365
    expect(r.finalPrice).toBeCloseTo(4.0365, 3);
  });

  it('should calculate correct results in advanced mode', () => {
    const advInputs = {
      ...defaultInputs,
      mode: 'advanced',
      mesas: [
        {
          id: 1,
          printerId: 'p1',
          tech: 'fdm',
          parts: [
            { id: 101, weight: 50, time: 2, qty: 2, price: 20 }, // 100g total, 4h total
          ]
        }
      ],
      totalTime: 4
    };
    const printers = [{ id: 'p1', price: 500, lifeHours: 5000, powerPrint: 200 }];
    
    const r = computeResults(advInputs, printers);
    
    // Mat: (20/1000) * 50 * 2 = 2.0
    // Time: 4h
    // Amort: (500/5000) * 4 = 0.4
    // Elec: (200/1000) * 4 * 0.2 = 0.16
    // Base: 2.0 + 0.4 + 0.16 = 2.56
    // Prod: 2.56 + (2.56 * 0.05) + (2.56 * 0.10) = 2.56 * 1.15 = 2.944
    // Final: 2.944 * 1.30 = 3.8272
    
    expect(r.materialCost).toBeCloseTo(2.0, 2);
    expect(r.finalPrice).toBeCloseTo(3.8272, 4);
  });
});
