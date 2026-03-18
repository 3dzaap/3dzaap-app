/**
 * 3DZAAP — Motor de Cálculo Homologado v1.0
 * Este ficheiro centraliza toda a inteligência de custos do SaaS.
 */

const PrintCalculator = {
    /**
     * @param {Object} p - Parâmetros (weightGrams, printTimeMinutes, filamentPrice, etc.)
     */
    calculate(p) {
        // Validação básica para evitar divisão por zero
        const filWeight = parseFloat(p.filamentWeight) || 1000;
        const filPrice = parseFloat(p.filamentPrice) || 0;
        const weightGrams = parseFloat(p.weightGrams) || 0;

        // 1. Custo de Material
        const materialCost = (filPrice / filWeight) * weightGrams;

        // 2. Custo de Energia
        const energyCost = (p.printTimeMinutes / 60) * (p.powerConsumption / 1000) * p.kwhPrice;

        // 3. Depreciação da Máquina
        const totalMachineHours = p.machineLifeMonths * 30 * p.machineHoursPerDay;
        const depreciationPerMin = p.machinePrice / (totalMachineHours * 60);
        const machineCost = depreciationPerMin * p.printTimeMinutes;

        // 4. Subtotal e Taxa de Falha
        const productionCost = materialCost + energyCost + machineCost;
        const totalWithFailures = productionCost * (1 + (p.failureRate / 100));

        // 5. Lucro e Preço Final
        const profitAmount = totalWithFailures * (p.profitMargin / 100);
        const finalPrice = totalWithFailures + profitAmount + p.laborFee;

        return {
            materialCost: materialCost,
            energyCost: energyCost,
            machineCost: machineCost,
            productionCost: totalWithFailures,
            profitAmount: profitAmount,
            finalPrice: finalPrice,
            timestamp: new Date().toISOString()
        };
    }
};

if (typeof module !== 'undefined') module.exports = PrintCalculator;