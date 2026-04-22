/**
 * 3DZAAP Calculator V2 Core Logic
 * Extracted for testability and modularity.
 */

export function computeResults(inputs, printers = [], filaments = []) {
  let materialCost = 0;
  let machineTime = 0;
  
  let amortizationCost = 0;
  let electricityCost = 0;
  
  if (inputs.mode === 'simple') {
    materialCost = (inputs.materialPrice / 1000) * inputs.weight;
    machineTime = inputs.time;
    amortizationCost = (inputs.printerPrice / inputs.printerLife) * machineTime;
    electricityCost = (inputs.powerConsumption / 1000) * machineTime * inputs.electricityPrice;
  } else {
    // Advanced mode: array of mesas > array of parts
    if (inputs.mesas && Array.isArray(inputs.mesas)) {
      inputs.mesas.forEach(m => {
        let prn = printers.find(p => String(p.id) === String(m.printerId));
        let pPrice = prn ? (prn.price || inputs.printerPrice) : inputs.printerPrice;
        let pLife = prn ? (prn.lifeHours || inputs.printerLife) : inputs.printerLife;
        
        let pPower = inputs.powerConsumption;
        if (prn) {
          if (m.tech === 'resin') pPower = prn.powerPrint || prn.powerStandby || 60;
          else pPower = prn.powerPrint || inputs.powerConsumption;
        }
        
        let mesaTime = 0;
        m.parts.forEach(p => {
          let pQty = p.qty || 1;
          let pPriceMat = p.price;
          if (!pPriceMat) {
            const mat = filaments.find(f => String(f.id) === String(p.materialId));
            pPriceMat = mat ? (mat.price || 0) : 25; // fallback
          }
          materialCost += (pPriceMat / 1000) * p.weight * pQty;
          mesaTime += (p.time * pQty);
        });
        
        amortizationCost += (pPrice / pLife) * mesaTime;
        electricityCost += (pPower / 1000) * mesaTime * inputs.electricityPrice;
        machineTime += mesaTime;
      });
      
      // If user overrode total project time
      if (machineTime > 0 && inputs.totalTime > 0 && inputs.totalTime !== machineTime) {
        const ratio = inputs.totalTime / machineTime;
        amortizationCost *= ratio;
        electricityCost *= ratio;
      }
      machineTime = inputs.totalTime;
    }
  }
  
  const baseCost = materialCost + amortizationCost + electricityCost;
  const failureCost = baseCost * (inputs.failureRate / 100);
  const indirectCost = baseCost * (inputs.indirectCosts / 100);
  
  const productionCost = baseCost + failureCost + indirectCost;
  const marginCost = productionCost * (inputs.profitMargin / 100);
  const finalPrice = productionCost + marginCost;

  const validTime = machineTime > 0 ? machineTime : 1;
  const profitPerHour = marginCost / validTime;

  return {
    materialCost,
    amortizationCost,
    electricityCost,
    baseCost,
    failureCost,
    indirectCost,
    productionCost,
    marginCost,
    finalPrice,
    profitPerHour,
    unitPrice: finalPrice / (inputs.qty || 1),
    qty: inputs.qty || 1
  };
}
