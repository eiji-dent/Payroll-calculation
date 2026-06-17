let dirHandle = null;
let databaseCache = { employees: [] };

/**
 * Request access to a local directory from the user
 */
export async function requestDirectoryAccess() {
  try {
    dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    await loadDatabase();
    return true;
  } catch (err) {
    console.error("Directory access failed or cancelled:", err);
    return false;
  }
}

/**
 * Load the database.json file from the selected directory
 */
async function loadDatabase() {
  if (!dirHandle) throw new Error("No directory selected");
  try {
    const fileHandle = await dirHandle.getFileHandle('database.json', { create: true });
    const file = await fileHandle.getFile();
    const contents = await file.text();
    if (contents) {
      databaseCache = JSON.parse(contents);
    } else {
      // Empty file, initialize with default schema
      databaseCache = { employees: [] };
      await saveDatabase();
    }
  } catch (err) {
    console.error("Failed to load database.json:", err);
    databaseCache = { employees: [] };
  }
}

/**
 * Save the databaseCache to database.json
 */
async function saveDatabase() {
  if (!dirHandle) throw new Error("No directory selected");
  try {
    const fileHandle = await dirHandle.getFileHandle('database.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(databaseCache, null, 2));
    await writable.close();
  } catch (err) {
    console.error("Failed to save database.json:", err);
  }
}

// ------------------------------------------------------------------
// API methods for the rest of the application
// ------------------------------------------------------------------

export async function initDB() {
  // DB is now initialized via user gesture in requestDirectoryAccess()
  // But we can check if we have a sample employee if cache is empty
  if (dirHandle && databaseCache.employees.length === 0) {
    const sampleEmployee = {
      id: "E001",
      name: "柴田瑛治",
      gender: "男性",
      hireDate: "2025-06-01",
      department: "",
      employeeType: "正社員",
      standardRemuneration: 500000,
      taxTable: "甲",
      dependents: 0,
      commuteRoute: "〇〇駅〜〇〇駅",
      commuteFare: 12600,
      baseSalary: 1000000,
      memo: "サンプル初期データです。"
    };
    await saveEmployee(sampleEmployee);
  }
}

export async function getEmployees() {
  return databaseCache.employees || [];
}

export async function saveEmployee(employee) {
  if (!employee.id) employee.id = 'E' + Date.now();
  const index = databaseCache.employees.findIndex(e => e.id === employee.id);
  
  if (index >= 0) {
    databaseCache.employees[index] = employee;
  } else {
    databaseCache.employees.push(employee);
  }
  
  await saveDatabase();
}

/**
 * Save a physical file to the directory
 */
export async function savePhysicalFile(fileObj, employeeId) {
  if (!dirHandle) throw new Error("No directory selected");
  try {
    // Create an employee-specific subfolder
    const empFolder = await dirHandle.getDirectoryHandle(employeeId, { create: true });
    const fileHandle = await empFolder.getFileHandle(fileObj.name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(fileObj);
    await writable.close();
    return true;
  } catch (err) {
    console.error("Failed to write physical file:", err);
    return false;
  }
}
