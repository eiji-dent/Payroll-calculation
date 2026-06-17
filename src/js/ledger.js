import { PayrollCalculator } from './payrollCalculator.js';
import { getEmployees, saveEmployee } from './db.js';

// Define the rows required in the wage ledger
const ledgerRows = [
  { category: "勤怠", key: "workDays", label: "労働日数", type: "number" },
  { category: "勤怠", key: "workHours", label: "労働時間", type: "number" },
  { category: "勤怠", key: "overtimeHours", label: "時間外労働時間", type: "number" },
  { category: "支給", key: "executivePay", label: "役員報酬", type: "number" },
  { category: "支給", key: "baseSalary", label: "基本給", type: "number" },
  { category: "支給", key: "overtimePay", label: "時間外手当", type: "number" },
  { category: "支給", key: "nationalHealthAllowance", label: "国保手当", type: "number" },
  { category: "支給", key: "attendanceAllowance", label: "皆勤手当", type: "number" },
  { category: "支給", key: "qualificationAllowance", label: "資格手当", type: "number" },
  { category: "支給", key: "holidayWorkAllowance", label: "休日出勤手当", type: "number" },
  { category: "支給", key: "positionAllowance", label: "役職手当", type: "number" },
  { category: "支給", key: "nonTaxableCommute", label: "非課税交通費", type: "number" },
  { category: "支給", key: "_totalEarnings", label: "支給合計", type: "calc", className: "font-bold bg-slate-50" },
  { category: "控除", key: "healthInsurance", label: "健康保険料", type: "number" },
  { category: "控除", key: "careInsurance", label: "介護保険料", type: "number" },
  { category: "控除", key: "childcareSupport", label: "子育て支援金", type: "number" },
  { category: "控除", key: "pensionInsurance", label: "厚生年金保険", type: "number" },
  { category: "控除", key: "employmentInsurance", label: "雇用保険料", type: "number" },
  { category: "控除", key: "incomeTax", label: "所得税", type: "number" },
  { category: "控除", key: "residentTax", label: "住民税", type: "number" },
  { category: "控除", key: "yearEndAdjustment", label: "年末調整", type: "number" },
  { category: "控除", key: "otherAdjustments", label: "その他調整", type: "number" },
  { category: "控除", key: "housingRent", label: "社宅家賃", type: "number" },
  { category: "控除", key: "_totalDeductions", label: "控除合計", type: "calc", className: "font-bold bg-slate-50" },
  { category: "差引", key: "_netPay", label: "差引支給合計", type: "calc", className: "font-bold bg-teal-50 text-teal-900" },
];

export async function renderLedger(employeeId) {
  const employees = await getEmployees();
  const emp = employees.find(e => e.id === employeeId);
  if (!emp) return;

  const wrapper = document.getElementById('ledger-wrapper');
  
  // Dummy data for months (would come from DB in reality)
  const months = ['1/15', '2/13', '3/13', '4/15', '5/15'];
  
  // Initialize payroll data if empty
  if (!emp.payrolls) {
    emp.payrolls = {};
    months.forEach(m => emp.payrolls[m] = {});
  }

  // Calculate totals and derivations
  const calculatedData = {};
  const ytd = { taxable: 0, social: 0, tax: 0 };
  
  months.forEach(m => {
    const data = emp.payrolls[m] || {};
    const calc = PayrollCalculator.calculate(data, emp);
    calculatedData[m] = calc;
    
    ytd.taxable += calc.taxableIncome;
    ytd.social += calc.socialInsurances;
    ytd.tax += calc.calculated.incomeTax;
  });

  // Build HTML
  let html = `
    <div class="p-4 bg-white hidden-print flex justify-between items-center border-b border-slate-200">
      <h3 class="text-lg font-bold text-slate-800">令和8年 賃金台帳</h3>
      <div class="text-sm text-slate-500">氏名: <span class="font-bold text-slate-800">${emp.name}</span> | 標準報酬月額: ${emp.standardRemuneration.toLocaleString()}円</div>
      <button class="btn-primary" id="btn-share-line">
        <i data-lucide="message-circle" class="inline w-4 h-4 mr-1"></i> LINEで明細を送る
      </button>
    </div>
    <div class="p-4" id="print-area">
      <table class="ledger-table w-full">
        <thead>
          <tr>
            <th colspan="2" rowspan="2">項目</th>
            ${months.map(m => `<th>${m}</th>`).join('')}
            <th>合計</th>
          </tr>
        </thead>
        <tbody>
  `;

  let currentCategory = "";
  
  ledgerRows.forEach(row => {
    html += `<tr>`;
    
    // Category cell spanning multiple rows
    if (row.category !== currentCategory) {
      const rowCount = ledgerRows.filter(r => r.category === row.category).length;
      html += `<td rowspan="${rowCount}" class="category-header">${row.category}</td>`;
      currentCategory = row.category;
    }

    html += `<td class="bg-slate-50 font-medium">${row.label}</td>`;

    let rowTotal = 0;
    
    months.forEach(m => {
      const data = emp.payrolls[m] || {};
      const calc = calculatedData[m];
      
      let val = "";
      if (row.type === "calc") {
        if (row.key === "_totalEarnings") val = calc.totalEarnings;
        if (row.key === "_totalDeductions") val = calc.totalDeductions;
        if (row.key === "_netPay") val = calc.netPay;
        rowTotal += val;
        html += `<td class="number-cell ${row.className || ''}">${val.toLocaleString()}</td>`;
      } else {
        val = data[row.key] || "";
        rowTotal += PayrollCalculator.parseNum(val);
        // Provide input field for editing
        html += `<td class="number-cell"><input type="text" data-emp="${emp.id}" data-month="${m}" data-key="${row.key}" value="${val ? PayrollCalculator.parseNum(val).toLocaleString() : ''}" class="ledger-input" /></td>`;
      }
    });

    // Row total column
    html += `<td class="number-cell bg-slate-50 font-bold">${rowTotal.toLocaleString()}</td>`;
    html += `</tr>`;
  });

  // Footer / YTD
  html += `
        </tbody>
      </table>
      
      <div class="mt-6 flex justify-end gap-8 text-sm">
        <div class="bg-slate-50 p-4 border border-slate-200 rounded-lg">
          <p class="font-bold mb-2">本年累計</p>
          <div class="grid grid-cols-2 gap-x-8 gap-y-2">
            <span class="text-slate-500">課税支給額累計</span> <span class="text-right font-medium">${ytd.taxable.toLocaleString()}円</span>
            <span class="text-slate-500">社会保険料累計</span> <span class="text-right font-medium">${ytd.social.toLocaleString()}円</span>
            <span class="text-slate-500">所得税累計</span> <span class="text-right font-medium">${ytd.tax.toLocaleString()}円</span>
          </div>
        </div>
      </div>
    </div>
  `;

  wrapper.innerHTML = html;
  wrapper.classList.remove('hidden');

  // Attach event listeners to inputs for auto-save and re-calc
  const inputs = wrapper.querySelectorAll('.ledger-input');
  inputs.forEach(input => {
    input.addEventListener('change', async (e) => {
      const m = e.target.dataset.month;
      const k = e.target.dataset.key;
      const v = e.target.value.replace(/,/g, '');
      
      if (!emp.payrolls[m]) emp.payrolls[m] = {};
      emp.payrolls[m][k] = v;
      
      await saveEmployee(emp);
      renderLedger(emp.id); // re-render entirely
    });
  });

  // LINE sharing feature
  document.getElementById('btn-share-line').addEventListener('click', async () => {
    try {
      const btn = document.getElementById('btn-share-line');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="loader-2" class="inline w-4 h-4 mr-1 animate-spin"></i> 準備中...';
      
      // Target the print-area (the table)
      const targetElement = document.getElementById('print-area');
      
      // Generate canvas
      const canvas = await html2canvas(targetElement, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `${emp.name}_給与明細.png`, { type: 'image/png' });
        
        // Try Web Share API with files if supported
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '給与明細',
            text: `${emp.name}さんの給与明細です。ご確認をお願いします。`
          });
        } else {
          // Fallback: Generate an object URL and open LINE messaging intent
          // Note: Since browsers don't allow sharing images via custom URL schemes directly to LINE, 
          // we prompt the user to download the image or copy it.
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${emp.name}_給与明細.png`;
          a.click();
          URL.revokeObjectURL(url);
          alert('給与明細の画像をダウンロードしました。\nLINEを開いて、画像を送信してください。');
        }
        btn.innerHTML = originalText;
        createIcons({ icons });
      }, 'image/png');
    } catch (err) {
      console.error(err);
      alert('明細の画像化に失敗しました。');
      document.getElementById('btn-share-line').innerHTML = '<i data-lucide="message-circle" class="inline w-4 h-4 mr-1"></i> LINEで明細を送る';
      createIcons({ icons });
    }
  });
}
