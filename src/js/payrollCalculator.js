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
                    this.parseNum(row.incomeTax) : this.calculateIncomeTax(taxableIncome, employee.dependents, employee.taxCategory);

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

  static calculateIncomeTax(taxableIncome, dependents, taxCategory = 'kou') {
    if (taxableIncome <= 0) return 0;
    dependents = dependents || 0;

    // 乙欄 (Otsu-ran) の概算計算
    if (taxCategory === 'otsu') {
      if (taxableIncome < 88000) {
        return Math.floor(taxableIncome * 0.03063);
      } else {
        const x = taxableIncome * 12;
        let y = this.getSalaryAfterEmploymentDeduction(x);
        // 乙欄は基礎控除等がないためそのまま課税給与所得とする
        let z = Math.floor(y / 1000) * 1000;
        let t = this.getAnnualTaxAmount(z);
        let monthly = Math.round(((t * 1.021) / 12) / 10) * 10;
        // 乙欄は原則高めの税率となるため最低でも3.063%を担保
        return Math.max(Math.floor(taxableIncome * 0.03063), monthly);
      }
    }

    // 甲欄 (Kou-ran) 電算機計算の特例 (令和6年分ベース)
    // 1. 月額の課税対象額を年調換算
    const x = taxableIncome * 12;

    // 2. 給与所得控除後の金額を計算
    const y = this.getSalaryAfterEmploymentDeduction(x);

    // 3. 基礎控除と扶養控除を差し引く
    // 基礎控除: 原則48万円 (所得2400万超で逓減するが一般的な給与を想定し固定)
    // 扶養控除: 1人につき38万円 (特定扶養等は考慮せず一律)
    const exemptions = 480000 + (dependents * 380000);
    let z = y - exemptions;
    if (z < 0) z = 0;

    // 1,000円未満切り捨て
    z = Math.floor(z / 1000) * 1000;

    // 4. 年間の基準所得税額を計算
    const t = this.getAnnualTaxAmount(z);

    // 5. 月額の源泉徴収税額を算出 (復興特別所得税2.1%を加味し12で割る)
    let monthlyTax = (t * 1.021) / 12;
    // 10円未満の端数を四捨五入
    monthlyTax = Math.round(monthlyTax / 10) * 10;

    return Math.max(0, monthlyTax);
  }

  static getSalaryAfterEmploymentDeduction(x) {
    if (x <= 1625000) return Math.max(0, x - 550000);
    if (x <= 1800000) return x * 0.6 + 100000;
    if (x <= 3600000) return x * 0.7 - 80000;
    if (x <= 6600000) return x * 0.8 - 440000;
    if (x <= 8500000) return x * 0.9 - 1100000;
    return x - 1950000;
  }

  static getAnnualTaxAmount(z) {
    if (z <= 1950000) return z * 0.05;
    if (z <= 3300000) return z * 0.10 - 97500;
    if (z <= 6950000) return z * 0.20 - 427500;
    if (z <= 9000000) return z * 0.23 - 636000;
    if (z <= 18000000) return z * 0.33 - 1536000;
    if (z <= 40000000) return z * 0.40 - 2796000;
    return z * 0.45 - 4796000;
  }
}
