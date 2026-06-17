import { getEmployees, saveEmployee, savePhysicalFile } from './db.js';
import { createIcons, icons } from 'lucide';

let currentEmpId = null;

export async function renderEmployeeDetails(empId, goBackCallback) {
  currentEmpId = empId;
  const employees = await getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  // Set basics
  document.getElementById('detail-header-name').textContent = `スタッフ詳細 - ${emp.name}`;
  document.getElementById('emp-detail-name').value = emp.name || '';
  document.getElementById('emp-detail-type').value = emp.employeeType || '';
  document.getElementById('emp-detail-hiredate').value = emp.hireDate || '';
  document.getElementById('emp-detail-remuneration').value = emp.standardRemuneration || '';
  document.getElementById('emp-detail-dependents').value = emp.dependents || 0;
  document.getElementById('emp-detail-taxcategory').value = emp.taxCategory || 'kou';

  // Set commute & memo
  document.getElementById('emp-detail-route').value = emp.commuteRoute || '';
  document.getElementById('emp-detail-fare').value = emp.commuteFare || '';
  document.getElementById('emp-detail-memo').value = emp.memo || '';

  // Set leaves
  document.getElementById('emp-leave-total').value = emp.leaveTotal || 0;
  renderLeaves(emp);

  // Set files (mock display for now, indexedDB blob storage requires db expansion)
  renderFiles(emp);

  // Setup Back button
  const backBtn = document.getElementById('back-to-employees-btn');
  backBtn.onclick = goBackCallback;

  // Setup Save button
  const saveBtn = document.getElementById('btn-save-emp-details');
  saveBtn.onclick = async () => {
    emp.name = document.getElementById('emp-detail-name').value;
    emp.employeeType = document.getElementById('emp-detail-type').value;
    emp.hireDate = document.getElementById('emp-detail-hiredate').value;
    emp.standardRemuneration = parseInt(document.getElementById('emp-detail-remuneration').value, 10) || 0;
    emp.dependents = parseInt(document.getElementById('emp-detail-dependents').value, 10) || 0;
    emp.taxCategory = document.getElementById('emp-detail-taxcategory').value || 'kou';
    
    emp.commuteRoute = document.getElementById('emp-detail-route').value;
    emp.commuteFare = parseInt(document.getElementById('emp-detail-fare').value, 10) || 0;
    emp.memo = document.getElementById('emp-detail-memo').value;
    
    emp.leaveTotal = parseInt(document.getElementById('emp-leave-total').value, 10) || 0;

    await saveEmployee(emp);
    alert('保存しました！');
    renderLeaves(emp); // re-render remaining days
  };

  // Setup Add Leave
  const addLeaveBtn = document.getElementById('btn-add-leave');
  addLeaveBtn.onclick = async () => {
    const dateInput = document.getElementById('emp-leave-date').value;
    if (!dateInput) return;
    if (!emp.leaves) emp.leaves = [];
    if (!emp.leaves.includes(dateInput)) {
      emp.leaves.push(dateInput);
      emp.leaves.sort();
      await saveEmployee(emp);
      renderLeaves(emp);
    }
  };
  
  // Setup File Upload (Save physically)
  const fileInput = document.getElementById('emp-file-upload');
  fileInput.onchange = async (e) => {
    const files = e.target.files;
    if (!emp.files) emp.files = [];
    for(let f of files) {
      // Save metadata to DB
      emp.files.push({ name: f.name, size: f.size, date: new Date().toISOString() });
      // Physically save the file
      await savePhysicalFile(f, emp.id);
    }
    await saveEmployee(emp);
    renderFiles(emp);
  };
}

function renderLeaves(emp) {
  const list = document.getElementById('emp-leave-list');
  const leaves = emp.leaves || [];
  const total = parseInt(document.getElementById('emp-leave-total').value, 10) || 0;
  
  document.getElementById('emp-leave-remaining').textContent = `${Math.max(0, total - leaves.length)}日`;
  
  if (leaves.length === 0) {
    list.innerHTML = '<li>使用履歴はありません</li>';
    return;
  }
  
  list.innerHTML = leaves.map(date => `
    <li class="flex justify-between items-center bg-slate-50 p-2 rounded">
      <span><i data-lucide="calendar" class="inline w-4 h-4 mr-2"></i>${date}</span>
      <button class="text-red-500 hover:text-red-700 text-sm" onclick="removeLeave('${date}')">削除</button>
    </li>
  `).join('');
  
  createIcons({ icons });

  // Attach global remove function hack for simplicity
  window.removeLeave = async (date) => {
    emp.leaves = emp.leaves.filter(d => d !== date);
    await saveEmployee(emp);
    renderLeaves(emp);
  };
}

function renderFiles(emp) {
  const list = document.getElementById('emp-file-list');
  const files = emp.files || [];
  
  if (files.length === 0) {
    list.innerHTML = '<div class="text-sm text-slate-500">アップロードされたファイルはありません</div>';
    return;
  }

  list.innerHTML = files.map((f, i) => `
    <div class="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
      <div class="flex items-center gap-3">
        <div class="bg-blue-100 text-blue-600 p-2 rounded">
          <i data-lucide="file-text" class="w-5 h-5"></i>
        </div>
        <div>
          <p class="text-sm font-medium text-slate-700">${f.name}</p>
          <p class="text-xs text-slate-400">${(f.size / 1024).toFixed(1)} KB</p>
        </div>
      </div>
      <button class="text-slate-400 hover:text-red-500" onclick="removeFile(${i})">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');

  createIcons({ icons });

  window.removeFile = async (idx) => {
    emp.files.splice(idx, 1);
    await saveEmployee(emp);
    renderFiles(emp);
  };
}
