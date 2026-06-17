import { createIcons, icons } from 'lucide';
import { initDB, getEmployees, requestDirectoryAccess } from './db.js';
import { renderLedger } from './ledger.js';
import { renderEmployeeDetails } from './employeeDetails.js';

// Initialize Lucide icons
createIcons({ icons });

document.addEventListener('DOMContentLoaded', async () => {
  
  // Folder Selection Logic
  document.getElementById('btn-select-folder').addEventListener('click', async () => {
    const success = await requestDirectoryAccess();
    if (success) {
      document.getElementById('folder-selection-overlay').classList.add('hidden');
      await initDB();
      renderDashboard();
    }
  });

  // Tab Navigation Logic
  const navItems = document.querySelectorAll('.nav-item');
  const viewContainers = document.querySelectorAll('.view-container');
  const pageTitle = document.getElementById('page-title');

  function switchTab(targetId, title) {
    // Update nav active state
    navItems.forEach(nav => {
      if(nav.dataset.target === targetId) {
        nav.classList.add('bg-teal-700', 'text-white', 'border-teal-300');
        nav.classList.remove('text-teal-100', 'border-transparent');
      } else {
        nav.classList.remove('bg-teal-700', 'text-white', 'border-teal-300');
        nav.classList.add('text-teal-100', 'border-transparent');
      }
    });

    // Update views
    viewContainers.forEach(view => {
      if(view.id === `view-${targetId}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    // Update title
    pageTitle.textContent = title;
    
    // Trigger specific render functions based on tab
    if (targetId === 'employees') {
      renderEmployees();
    } else if (targetId === 'dashboard') {
      renderDashboard();
    } else if (targetId === 'payroll-ledger') {
      initLedgerView();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.target;
      const title = item.textContent.trim();
      switchTab(target, title);
    });
  });

  async function initLedgerView() {
    const employees = await getEmployees();
    const select = document.getElementById('ledger-employee-select');
    // Keep first option, clear rest
    select.innerHTML = '<option value="">-- 選択してください --</option>';
    employees.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.employeeType})`;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      if (e.target.value) {
        renderLedger(e.target.value);
      } else {
        document.getElementById('ledger-wrapper').classList.add('hidden');
      }
    });

    document.getElementById('print-ledger-btn').addEventListener('click', () => {
      window.print();
    });
  }

  // Render Employee List
  async function renderEmployees() {
    const tbody = document.getElementById('employee-table-body');
    tbody.innerHTML = '';
    const employees = await getEmployees();
    
    employees.forEach(emp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-3 px-6 text-slate-800 font-medium">${emp.name}</td>
        <td class="py-3 px-6 text-slate-600">${emp.employeeType}</td>
        <td class="py-3 px-6 text-slate-600">${emp.standardRemuneration ? emp.standardRemuneration.toLocaleString() : '0'}円</td>
        <td class="py-3 px-6 text-right">
          <button class="text-teal-600 hover:text-teal-800 font-medium text-sm btn-edit-emp" data-id="${emp.id}">編集 / 詳細</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit-emp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        document.getElementById('view-employees').classList.add('hidden');
        document.getElementById('view-employee-details').classList.remove('hidden');
        renderEmployeeDetails(id, () => {
          // Go back callback
          document.getElementById('view-employee-details').classList.add('hidden');
          document.getElementById('view-employees').classList.remove('hidden');
          renderEmployees(); // refresh list
        });
      });
    });
  }
  
  async function renderDashboard() {
    const employees = await getEmployees();
    document.getElementById('dash-staff-count').textContent = `${employees.length} 人`;
    document.getElementById('dash-total-payout').textContent = `計算待ち`;
  }

  // Initial UI state (waiting for folder selection)
  // We don't render dashboard data until folder is selected
});
