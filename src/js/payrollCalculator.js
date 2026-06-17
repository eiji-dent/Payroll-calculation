export class PayrollCalculator {
  static INSURANCE_RATES = {
    employment: 0.006, // 6/1000
    pension: 0.0915,   // 18.3% / 2 = 9.15%
    health: 0.04955    // Example: 9.91% / 2 = 4.955%
  };

  /**
   * Calculate all deductions and totals for a given month's data
   * @param {Object} row - The row data from the ledger
   * @param {Object} employee - The employee settings
   */
  static calculate(row, employee) {
    // 1. Calculate Earnings (支給)
    const baseSalary = this.parseNum(row.baseSalary);
    const overtimePay = this.parseNum(row.overtimePay);
    const nationalHealthAllowance = this.parseNum(row.nationalHealthAllowance);
    const attendanceAllowance = this.parseNum(row.attendanceAllowance);
    const qualificationAllowance = this.parseNum(row.qualificationAllowance);
    const holidayWorkAllowance = this.parseNum(row.holidayWorkAllowance);
    const positionAllowance = this.parseNum(row.positionAllowance);
    const executivePay = this.parseNum(row.executivePay);
    const nonTaxableCommute = this.parseNum(row.nonTaxableCommute); // 非課税交通費

    // 支給合計 (Total Earnings)
    const totalEarnings = 
      baseSalary + overtimePay + nationalHealthAllowance + 
      attendanceAllowance + qualificationAllowance + holidayWorkAllowance + 
      positionAllowance + executivePay + nonTaxableCommute;

    // 2. Calculate Deductions (控除)
    // 雇用保険 (Employment Insurance): (総支給 - 非課税交通費) * 6/1000, 
    // Wait, employment insurance is typically calculated on the total gross including commuting, but non-taxable is usually included in employment insurance calc in Japan.
    // Let's use totalEarnings for employment insurance.
    let employmentInsurance = Math.round(totalEarnings * this.INSURANCE_RATES.employment);
    
    // For manual override from UI, use the row value if provided, else calculate
    employmentInsurance = row.employmentInsurance !== undefined && row.employmentInsurance !== "" ? 
                          this.parseNum(row.employmentInsurance) : employmentInsurance;

    // 健康保険 & 厚生年金 (Health & Pension): Based on standard remuneration (標準報酬月額)
    const standardRemuneration = this.parseNum(employee.standardRemuneration) || 0;
    const healthInsurance = row.healthInsurance !== undefined && row.healthInsurance !== "" ? 
                            this.parseNum(row.healthInsurance) : Math.round(standardRemuneration * this.INSURANCE_RATES.health);
    const pensionInsurance = row.pensionInsurance !== undefined && row.pensionInsurance !== "" ? 
                             this.parseNum(row.pensionInsurance) : Math.round(standardRemuneration * this.INSURANCE_RATES.pension);

    const careInsurance = this.parseNum(row.careInsurance);
    const childcareSupport = this.parseNum(row.childcareSupport);
    
    // 所得税 (Income Tax)
    // Taxable Income = Total Earnings - NonTaxableCommute - Social Insurances
    const socialInsurances = healthInsurance + careInsurance + pensionInsurance + employmentInsurance;
    const taxableIncome = totalEarnings - nonTaxableCommute - socialInsurances;
    
    // Simple mock calculation for Income Tax. In reality, requires complex tax table lookup.
    let incomeTax = row.incomeTax !== undefined && row.incomeTax !== "" ? 
                    this.parseNum(row.incomeTax) : this.calculateIncomeTax(taxableIncome, employee.dependents);

    const residentTax = this.parseNum(row.residentTax);
    const yearEndAdjustment = this.parseNum(row.yearEndAdjustment);
    const otherAdjustments = this.parseNum(row.otherAdjustments);
    const housingRent = this.parseNum(row.housingRent);

    // 控除合計 (Total Deductions)
    const totalDeductions = healthInsurance + careInsurance + childcareSupport + 
                            pensionInsurance + employmentInsurance + incomeTax + 
                            residentTax + yearEndAdjustment + otherAdjustments + housingRent;

    // 3. 差引支給合計 (Net Pay)
    const netPay = totalEarnings - totalDeductions;

    return {
      totalEarnings,
      totalDeductions,
      netPay,
      taxableIncome,
      socialInsurances,
      calculated: {
        employmentInsurance,
        healthInsurance,
        pensionInsurance,
        incomeTax
      }
    };
  }

  static parseNum(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const parsed = parseInt(String(val).replace(/,/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  static calculateIncomeTax(taxableIncome, dependents) {
    // Highly simplified mock for demonstration
    if (taxableIncome <= 88000) return 0;
    // Base simple rate ~5-20% depending on amount
    const rate = taxableIncome > 500000 ? 0.15 : (taxableIncome > 200000 ? 0.05 : 0.02);
    let tax = Math.round(taxableIncome * rate);
    // Deduction per dependent (rough estimate 3000 yen off tax)
    tax -= (dependents * 3000);
    return Math.max(0, tax);
  }
}
