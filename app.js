// app.js - MooManager Complete Application


// DATE HELPERS (Bangkok timezone)
function toLocalDateStr(isoString) { return new Date(isoString).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); }
function todayLocalStr() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); }

// ==========================================
// LOCAL DATABASE (Embedded)
// ==========================================
const LocalDB = {
    get(key) {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    },
    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
   // แก้ไขเพื่อให้รองรับการส่ง createdAt เข้าไปเองได้ (สำหรับการบันทึกย้อนหลัง)
    add(key, item) {
    const data = this.get(key);
    item.id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    // ถ้าใน item ไม่มี createdAt ส่งมา ให้ใช้เวลาปัจจุบัน
    item.createdAt = item.createdAt || new Date().toISOString(); 
    data.push(item);
    this.save(key, data);
    return item;
    },
    update(key, id, updated) {
        const data = this.get(key);
        const i = data.findIndex(x => x.id === id);
        if (i !== -1) { data[i] = { ...data[i], ...updated, updatedAt: new Date().toISOString() }; this.save(key, data); }
    },
    delete(key, id) {
        this.save(key, this.get(key).filter(x => x.id !== id));
    }
};

// ==========================================
// MODELS
// ==========================================
const CowModel = {
    COLLECTION: 'farm_cows',
    getAll() { return LocalDB.get(this.COLLECTION); },
    add(data) { return LocalDB.add(this.COLLECTION, data); },
    update(id, data) { LocalDB.update(this.COLLECTION, id, data); },
    delete(id) { LocalDB.delete(this.COLLECTION, id); },
    getById(id) { return this.getAll().find(c => c.id === id); }
};

const MilkModel = {
    COLLECTION: 'farm_milk',
    getAll() { return LocalDB.get(this.COLLECTION); },
    add(data) { return LocalDB.add(this.COLLECTION, data); },
    delete(id) { LocalDB.delete(this.COLLECTION, id); },
    getTodayTotal() {
        const today = todayLocalStr();
        return this.getAll()
            .filter(r => toLocalDateStr(r.createdAt) === today)
            .reduce((sum, r) => sum + Number(r.amount), 0);
    },
    getMonthlyTotal() {
        const nowStr = todayLocalStr(); // YYYY-MM-DD
        const yearMonth = nowStr.slice(0, 7); // YYYY-MM
        return this.getAll()
            .filter(r => toLocalDateStr(r.createdAt).slice(0, 7) === yearMonth)
            .reduce((sum, r) => sum + Number(r.amount), 0);
    },
    getRecentRecords(limit = 10) {
        return this.getAll().slice(-limit).reverse();
    },
    getDailyTotals(days = 30) {
        const all = this.getAll();
        const byDate = {};
        all.forEach(r => {
            const d = toLocalDateStr(r.createdAt);
            byDate[d] = (byDate[d] || 0) + Number(r.amount);
        });
        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-days);
    },
    addDailyTotal(date, amount, note = '') {
        return LocalDB.add(this.COLLECTION, {
            cowId: 'total',
            cowName: 'รวมทั้งฟาร์ม',
            session: 'daily',
            amount: Number(amount),
            note,
            createdAt: new Date(date + 'T12:00:00+07:00').toISOString()
        });
    }
};

const InventoryModel = {
    COLLECTION: 'farm_inventory',
    getAll() { return LocalDB.get(this.COLLECTION); },
    add(data) { return LocalDB.add(this.COLLECTION, data); },
    delete(id) { LocalDB.delete(this.COLLECTION, id); },
    getStockSummary() {
        const transactions = this.getAll();
        const summary = {};
        transactions.forEach(t => {
            if (!summary[t.name]) summary[t.name] = { balance: 0, unit: t.unit || 'หน่วย', dailyUsageRate: 0 };
            if (t.type === 'IN') summary[t.name].balance += Number(t.quantity);
            if (t.type === 'OUT') summary[t.name].balance -= Number(t.quantity);
            if (t.dailyUsageRate > 0) summary[t.name].dailyUsageRate = Number(t.dailyUsageRate);
            if (t.unit) summary[t.name].unit = t.unit;
        });
        return Object.keys(summary).map(name => {
            const d = summary[name];
            const daysLeft = d.dailyUsageRate > 0 ? Math.floor(d.balance / d.dailyUsageRate) : null;
            return { name, balance: d.balance, unit: d.unit, daysLeft, dailyUsageRate: d.dailyUsageRate, isLowStock: daysLeft !== null && daysLeft <= 3 };
        });
    }
};

const ExpenseModel = {
    COLLECTION: 'farm_expenses',
    getAll() { return LocalDB.get(this.COLLECTION); },
    add(data) { return LocalDB.add(this.COLLECTION, data); },
    delete(id) { LocalDB.delete(this.COLLECTION, id); },
    getMonthlyExpense() {
        const yearMonth = todayLocalStr().slice(0, 7);
        return this.getAll()
            .filter(r => !r.isIncome && toLocalDateStr(r.createdAt).slice(0, 7) === yearMonth)
            .reduce((sum, r) => sum + Number(r.amount), 0);
    },
    getMonthlyIncome() {
        const yearMonth = todayLocalStr().slice(0, 7);
        return this.getAll()
            .filter(r => r.isIncome && toLocalDateStr(r.createdAt).slice(0, 7) === yearMonth)
            .reduce((sum, r) => sum + Number(r.amount), 0);
    }
};

// ==========================================
// SEED DATA (สร้างข้อมูลตัวอย่างถ้ายังไม่มี)
// ==========================================
function seedDemoData() {
    if (LocalDB.get('farm_seeded').length > 0) return;

    CowModel.add({ number: '001', name: 'แดง', breed: 'โฮลสไตน์', status: 'milking', birthDate: '2020-03-15', weight: 480 });
    CowModel.add({ number: '002', name: 'ทอง', breed: 'โฮลสไตน์', status: 'dry', birthDate: '2019-07-22', weight: 510 });
    CowModel.add({ number: '003', name: 'ดาว', breed: 'เจอร์ซีย์', status: 'milking', birthDate: '2021-01-10', weight: 380 });

    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    LocalDB.add('farm_milk', { cowId: '001', cowName: 'แดง (#001)', session: 'morning', amount: 12, createdAt: today });
    LocalDB.add('farm_milk', { cowId: '001', cowName: 'แดง (#001)', session: 'evening', amount: 10, createdAt: today });
    LocalDB.add('farm_milk', { cowId: '003', cowName: 'ดาว (#003)', session: 'morning', amount: 8, createdAt: today });
    LocalDB.add('farm_milk', { cowId: '003', cowName: 'ดาว (#003)', session: 'evening', amount: 7, createdAt: today });
    LocalDB.add('farm_milk', { cowId: '001', cowName: 'แดง (#001)', session: 'morning', amount: 13, createdAt: yesterday });
    LocalDB.add('farm_milk', { cowId: '003', cowName: 'ดาว (#003)', session: 'morning', amount: 9, createdAt: yesterday });

    LocalDB.add('farm_inventory', { name: 'อาหารข้น (สูตร 1)', type: 'IN', quantity: 200, unit: 'กก.', dailyUsageRate: 80, createdAt: today });
    LocalDB.add('farm_inventory', { name: 'อาหารข้น (สูตร 1)', type: 'OUT', quantity: 40, unit: 'กก.', dailyUsageRate: 0, createdAt: today });
    LocalDB.add('farm_inventory', { name: 'ยาถ่ายพยาธิ', type: 'IN', quantity: 10, unit: 'ขวด', dailyUsageRate: 0, createdAt: today });
    LocalDB.add('farm_inventory', { name: 'วิตามินรวม', type: 'IN', quantity: 50, unit: 'เม็ด', dailyUsageRate: 15, createdAt: today });
    LocalDB.add('farm_inventory', { name: 'วิตามินรวม', type: 'OUT', quantity: 5, unit: 'เม็ด', dailyUsageRate: 0, createdAt: today });

    LocalDB.add('farm_expenses', { description: 'ขายนมสด', amount: 9000, isIncome: true, category: 'income', createdAt: today });
    LocalDB.add('farm_expenses', { description: 'ค่าอาหารสัตว์', amount: 3200, isIncome: false, category: 'feed', createdAt: today });

    LocalDB.save('farm_seeded', [{ done: true }]);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatDate(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
}


function formatNum(n) {
    return Number(n).toLocaleString('th-TH');
}

function statusLabel(status) {
    const map = { milking: ['กำลังให้นม', 'bg-green-100 text-green-700'], dry: ['พักรีด/ตั้งท้อง', 'bg-yellow-100 text-yellow-700'], sick: ['ป่วย/รักษา', 'bg-red-100 text-red-700'], sold: ['ขายแล้ว', 'bg-gray-100 text-gray-500'] };
    return map[status] || [status, 'bg-gray-100 text-gray-500'];
}

function showToast(msg, type = 'success') {
    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    const toast = document.createElement('div');
    toast.className = `fixed top-5 left-1/2 -translate-x-1/2 ${colors[type]} text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium z-50 transition-all duration-300 opacity-0 translate-y-2`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translate(-50%, 0)'; });
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

function showModal(title, bodyHTML, onConfirm, confirmLabel = 'บันทึก', confirmClass = 'bg-blue-600 hover:bg-blue-700') {
    document.getElementById('modal-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4';
    overlay.innerHTML = `
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            <div class="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
                <h3 class="text-base font-bold text-gray-800">${title}</h3>
                <button id="modal-close" class="text-gray-400 hover:text-gray-600 p-1"><i class="ph ph-x text-xl"></i></button>
            </div>
            <div class="p-5 max-h-[70vh] overflow-y-auto">${bodyHTML}</div>
            <div class="flex gap-3 px-5 pb-5 pt-2">
                <button id="modal-cancel" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">ยกเลิก</button>
                <button id="modal-confirm" class="flex-1 ${confirmClass} text-white py-2.5 rounded-xl text-sm font-medium">${confirmLabel}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#modal-close').addEventListener('click', close);
    overlay.querySelector('#modal-cancel').addEventListener('click', close);
    overlay.querySelector('#modal-confirm').addEventListener('click', () => { if (onConfirm()) close(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

function showConfirm(msg, onConfirm) {
    showModal('ยืนยันการลบ', `<p class="text-gray-600 text-sm text-center py-4">${msg}</p>`, onConfirm, 'ลบ', 'bg-red-500 hover:bg-red-600');
}

function exportToCSV(dataArray, filename = 'farm_report.csv') {
    if (!dataArray || !dataArray.length) { showToast('ไม่มีข้อมูลสำหรับ Export', 'error'); return; }
    const headers = Object.keys(dataArray[0]).join(',');
    const rows = dataArray.map(obj => Object.values(obj).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    showToast('Export สำเร็จ!');
}

// ==========================================
// VIEW: DASHBOARD
// ==========================================
function renderDashboardView(container) {
    const todayMilk = MilkModel.getTodayTotal();
    const monthlyMilk = MilkModel.getMonthlyTotal();
    const monthlyExpense = ExpenseModel.getMonthlyExpense();
    const monthlyIncome = ExpenseModel.getMonthlyIncome();
    const profit = monthlyIncome - monthlyExpense;
    const cows = CowModel.getAll();
    const milkingCows = cows.filter(c => c.status === 'milking').length;
    const stockSummary = InventoryModel.getStockSummary();
    const lowStockItems = stockSummary.filter(i => i.isLowStock);

    const milkHistory = (() => {
        const all = MilkModel.getAll();
        const byDate = {};
        all.forEach(r => {
            const d = new Date(r.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
            byDate[d] = (byDate[d] || 0) + Number(r.amount);
        });
        return Object.entries(byDate).slice(-7);
    })();
    const maxMilk = Math.max(...milkHistory.map(([, v]) => v), 1);

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Alerts -->
            ${lowStockItems.length > 0 ? `
            <div class="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div class="flex items-center gap-2 mb-2">
                    <i class="ph-fill ph-warning text-red-500 text-lg"></i>
                    <span class="text-sm font-semibold text-red-700">แจ้งเตือน (${lowStockItems.length} รายการ)</span>
                </div>
                ${lowStockItems.map(i => `<p class="text-xs text-red-600 ml-6">• ${i.name} เหลือ ${i.balance} ${i.unit} (อีก ${i.daysLeft} วันหมด)</p>`).join('')}
            </div>` : ''}

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-blue-100 p-1.5 rounded-lg"><i class="ph-fill ph-drop text-blue-600 text-base"></i></div>
                        <span class="text-xs text-gray-500">น้ำนมวันนี้</span>
                    </div>
                    <p class="text-2xl font-bold text-gray-800">${formatNum(todayMilk)} <span class="text-sm font-normal text-gray-400">ลิตร</span></p>
                </div>
                <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-green-100 p-1.5 rounded-lg"><i class="ph-fill ph-cow text-green-600 text-base"></i></div>
                        <span class="text-xs text-gray-500">วัวให้นม</span>
                    </div>
                    <p class="text-2xl font-bold text-gray-800">${milkingCows} <span class="text-sm font-normal text-gray-400">ตัว / ${cows.length}</span></p>
                </div>
                <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-emerald-100 p-1.5 rounded-lg"><i class="ph-fill ph-trend-up text-emerald-600 text-base"></i></div>
                        <span class="text-xs text-gray-500">กำไรเดือนนี้</span>
                    </div>
                    <p class="text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}">฿${formatNum(Math.abs(profit))} <span class="text-sm font-normal text-gray-400">${profit >= 0 ? '' : '(ขาดทุน)'}</span></p>
                </div>
                <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="bg-purple-100 p-1.5 rounded-lg"><i class="ph-fill ph-chart-bar text-purple-600 text-base"></i></div>
                        <span class="text-xs text-gray-500">นมเดือนนี้</span>
                    </div>
                    <p class="text-2xl font-bold text-gray-800">${formatNum(monthlyMilk)} <span class="text-sm font-normal text-gray-400">ลิตร</span></p>
                </div>
            </div>

            <!-- Mini Bar Chart -->
            ${milkHistory.length > 0 ? `
            <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p class="text-sm font-semibold text-gray-700 mb-3">น้ำนม 7 วันล่าสุด</p>
                <div class="flex items-end gap-1.5 h-20">
                    ${milkHistory.map(([date, val]) => `
                        <div class="flex-1 flex flex-col items-center gap-1">
                            <span class="text-[9px] text-gray-400">${val}</span>
                            <div class="w-full bg-blue-500 rounded-t-md" style="height:${Math.max(4, (val / maxMilk) * 56)}px"></div>
                            <span class="text-[8px] text-gray-400 truncate w-full text-center">${date}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- Quick Actions -->
            <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p class="text-sm font-semibold text-gray-700 mb-3">ทางลัด</p>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="App.navigate('milk')" class="flex items-center gap-2 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition">
                        <i class="ph-fill ph-drop text-blue-600 text-lg"></i>
                        <span class="text-xs font-medium text-blue-700">บันทึกน้ำนม</span>
                    </button>
                    <button onclick="App.navigate('inventory')" class="flex items-center gap-2 p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition">
                        <i class="ph-fill ph-package text-orange-600 text-lg"></i>
                        <span class="text-xs font-medium text-orange-700">จัดการสต็อก</span>
                    </button>
                    <button onclick="App.navigate('cows')" class="flex items-center gap-2 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition">
                        <i class="ph-fill ph-cow text-green-600 text-lg"></i>
                        <span class="text-xs font-medium text-green-700">ฝูงวัว</span>
                    </button>
                    <button id="dash-add-expense" class="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition">
                        <i class="ph-fill ph-receipt text-emerald-600 text-lg"></i>
                        <span class="text-xs font-medium text-emerald-700">บันทึกรายรับ/จ่าย</span>
                    </button>
                </div>
            </div>
        </div>`;

    document.getElementById('dash-add-expense')?.addEventListener('click', showExpenseModal);
}

// ==========================================
// VIEW: COWS
// ==========================================
function renderCowsView(container) {
    const cows = CowModel.getAll();

    function render() {
        const cows = CowModel.getAll();
        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div>
                    <h2 class="text-xl font-bold text-gray-800">ทะเบียนฝูงวัว</h2>
                    <p class="text-xs text-gray-400">ทั้งหมด ${cows.length} ตัว</p>
                </div>
                <button id="btn-add-cow" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 shadow-sm hover:bg-blue-700 transition">
                    <i class="ph ph-plus text-base"></i> เพิ่มวัว
                </button>
            </div>
            ${cows.length === 0 ? `
            <div class="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <i class="ph ph-cow text-5xl text-gray-300 mb-3 block"></i>
                <p class="text-gray-400 text-sm">ยังไม่มีข้อมูลวัว<br>กด "+ เพิ่มวัว" เพื่อเริ่มต้น</p>
            </div>` : `
            <div class="space-y-3">
                ${cows.map(cow => {
                    const [label, cls] = statusLabel(cow.status);
                    return `
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div class="flex items-center gap-3 p-4">
                            <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">🐄</div>
                            <div class="flex-1 min-w-0">
                                <p class="font-bold text-sm text-gray-800">#${cow.number} ${cow.name ? `(${cow.name})` : ''}</p>
                                <p class="text-xs text-gray-400">${cow.breed || '-'}</p>
                                <span class="inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${cls}">${label}</span>
                            </div>
                            <div class="flex gap-1">
                                <button data-edit="${cow.id}" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                                    <i class="ph ph-pencil-simple text-lg"></i>
                                </button>
                                <button data-del="${cow.id}" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                    <i class="ph ph-trash text-lg"></i>
                                </button>
                            </div>
                        </div>
                        ${cow.birthDate || cow.weight ? `
                        <div class="border-t border-gray-50 px-4 py-2 flex gap-4 text-xs text-gray-400">
                            ${cow.birthDate ? `<span><i class="ph ph-calendar mr-1"></i>${formatDate(cow.birthDate)}</span>` : ''}
                            ${cow.weight ? `<span><i class="ph ph-scales mr-1"></i>${cow.weight} กก.</span>` : ''}
                        </div>` : ''}
                    </div>`;
                }).join('')}
            </div>`}`;

        document.getElementById('btn-add-cow')?.addEventListener('click', () => showCowModal(null, render));
        container.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
            const cow = CowModel.getById(btn.dataset.edit);
            if (cow) showCowModal(cow, render);
        }));
        container.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
            showConfirm('ต้องการลบข้อมูลวัวตัวนี้ใช่ไหม?', () => {
                CowModel.delete(btn.dataset.del);
                showToast('ลบข้อมูลแล้ว', 'info');
                render();
                return true;
            });
        }));
    }
    render();
}

function showCowModal(cow, onSaved) {
    const isEdit = !!cow;
    const bodyHTML = `
        <div class="space-y-3">
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">เบอร์วัว *</label>
                <input id="cow-number" type="text" value="${cow?.number || ''}" placeholder="เช่น 001" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">ชื่อเล่น</label>
                <input id="cow-name" type="text" value="${cow?.name || ''}" placeholder="เช่น แดง" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">สายพันธุ์</label>
                <input id="cow-breed" type="text" value="${cow?.breed || ''}" placeholder="เช่น โฮลสไตน์" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">สถานะ</label>
                <select id="cow-status" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="milking" ${cow?.status === 'milking' ? 'selected' : ''}>กำลังให้นม</option>
                    <option value="dry" ${cow?.status === 'dry' ? 'selected' : ''}>พักรีด/ตั้งท้อง</option>
                    <option value="sick" ${cow?.status === 'sick' ? 'selected' : ''}>ป่วย/รักษา</option>
                    <option value="sold" ${cow?.status === 'sold' ? 'selected' : ''}>ขายแล้ว</option>
                </select>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">วันเกิด</label>
                <input id="cow-birth" type="date" value="${cow?.birthDate || ''}" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">น้ำหนัก (กก.)</label>
                <input id="cow-weight" type="number" value="${cow?.weight || ''}" placeholder="480" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
        </div>`;

    showModal(isEdit ? 'แก้ไขข้อมูลวัว' : 'เพิ่มวัวใหม่', bodyHTML, () => {
        const number = document.getElementById('cow-number').value.trim();
        if (!number) { showToast('กรุณาใส่เบอร์วัว', 'error'); return false; }
        const data = {
            number,
            name: document.getElementById('cow-name').value.trim(),
            breed: document.getElementById('cow-breed').value.trim(),
            status: document.getElementById('cow-status').value,
            birthDate: document.getElementById('cow-birth').value,
            weight: document.getElementById('cow-weight').value
        };
        if (isEdit) { CowModel.update(cow.id, data); showToast('แก้ไขข้อมูลแล้ว'); }
        else { CowModel.add(data); showToast('เพิ่มวัวแล้ว!'); }
        onSaved();
        return true;
    });
}

// ==========================================
// VIEW: MILK
// ==========================================
function renderMilkView(container) {
    function render() {
        const cows = CowModel.getAll().filter(c => c.status === 'milking');
        const records = MilkModel.getRecentRecords(30);
        const todayTotal = MilkModel.getTodayTotal();
        const dailyTotals = MilkModel.getDailyTotals(30);
        const maxVal = Math.max(...dailyTotals.map(([, v]) => v), 1);
        const avgVal = dailyTotals.length > 0
            ? (dailyTotals.reduce((s, [, v]) => s + v, 0) / dailyTotals.length).toFixed(1)
            : 0;

        // สร้าง SVG Line Chart
        const W = 320, H = 110, padL = 32, padR = 8, padT = 12, padB = 28;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        let chartHTML = '';
        if (dailyTotals.length >= 1) {
            const pts = dailyTotals.map(([, v], i) => {
                const x = dailyTotals.length === 1
                    ? padL + chartW / 2
                    : padL + (i / (dailyTotals.length - 1)) * chartW;
                const y = padT + chartH - (v / maxVal) * chartH;
                return { x, y, v };
            });
            // Y axis labels
            const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)];
            const yAxisHTML = yLabels.map(val => {
                const y = padT + chartH - (val / maxVal) * chartH;
                return `<text x="${padL - 4}" y="${y + 4}" text-anchor="end" font-size="8" fill="#9ca3af">${val}</text>
                        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#f3f4f6" stroke-width="1"/>`;
            }).join('');

            // Area fill (ต้องการ >= 2 จุด)
            const areaPath = pts.length >= 2
                ? `M ${pts[0].x} ${padT + chartH} ` + pts.map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length-1].x} ${padT + chartH} Z`
                : '';

            // Line path (ต้องการ >= 2 จุด)
            const linePath = pts.length >= 2
                ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                : '';

            // Avg line
            const avgY = padT + chartH - (avgVal / maxVal) * chartH;

            // X axis labels
            const xLabelIndices = pts.length === 1
                ? [0]
                : [0, Math.floor((dailyTotals.length - 1) / 2), dailyTotals.length - 1];
            const xLabels = xLabelIndices
                .filter((v, i, arr) => arr.indexOf(v) === i) // deduplicate
                .map(i => {
                    const [date] = dailyTotals[i];
                    const [, mm, dd] = date.split('-'); // YYYY-MM-DD, parse directly — no UTC shift
                    const label = `${parseInt(dd)}/${parseInt(mm)}`;
                    return `<text x="${pts[i].x}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#9ca3af">${label}</text>`;
                }).join('');

            // Dots + tooltip values (แสดงเฉพาะ dot ล่าสุด)
            const lastPt = pts[pts.length - 1];
            chartHTML = `
            <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="w-full">
                <defs>
                    <linearGradient id="milkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
                    </linearGradient>
                </defs>
                ${yAxisHTML}
                <line x1="${padL}" y1="${avgY}" x2="${W - padR}" y2="${avgY}" stroke="#fbbf24" stroke-width="1" stroke-dasharray="4,3"/>
                <text x="${W - padR - 2}" y="${avgY - 3}" text-anchor="end" font-size="7.5" fill="#d97706">เฉลี่ย ${avgVal} ล.</text>
                ${areaPath ? `<path d="${areaPath}" fill="url(#milkGrad)"/>` : ''}
                ${linePath ? `<path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
                ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="white" stroke="#3b82f6" stroke-width="1.5"/>`).join('')}
                <circle cx="${lastPt.x}" cy="${lastPt.y}" r="4" fill="#3b82f6"/>
                <text x="${lastPt.x}" y="${lastPt.y - 7}" text-anchor="middle" font-size="8.5" fill="#1d4ed8" font-weight="bold">${lastPt.v} ล.</text>
                ${xLabels}
            </svg>`;
        } else {
            chartHTML = `<div class="text-center py-6 text-gray-300 text-sm">ยังไม่มีข้อมูลนม กรอกด้านบนเพื่อเริ่มต้น</div>`;
        }

        const todayStr = todayLocalStr();

        container.innerHTML = `
            <div class="space-y-4">
                <!-- Header -->
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-xl font-bold text-gray-800">บันทึกน้ำนม</h2>
                        <p class="text-xs text-gray-400">วันนี้รวม <span class="text-blue-600 font-semibold">${todayTotal} ลิตร</span></p>
                    </div>
                    <div class="flex gap-2">
                        <button id="btn-add-daily" class="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 shadow-sm hover:bg-blue-700 transition">
                            <i class="ph ph-plus text-base"></i> บันทึกรวม
                        </button>
                        <button id="btn-add-milk" class="border border-blue-300 text-blue-600 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-1 hover:bg-blue-50 transition">
                            <i class="ph ph-cow text-base"></i> แยกวัว
                        </button>
                    </div>
                </div>

                <!-- Quick daily input card -->
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-md">
                    <p class="text-xs text-blue-100 mb-2 font-medium">กรอกนมรวมวันนี้ (${new Date().toLocaleDateString('th-TH', { day:'numeric', month:'short', timeZone:'Asia/Bangkok' })})</p>
                    <div class="flex gap-2 items-center">
                        <div class="relative flex-1">
                            <input id="quick-milk-input" type="number" step="0.5" min="0" placeholder="0.0"
                                class="w-full bg-white/20 border border-white/30 text-white placeholder-blue-200 rounded-xl px-3 py-2.5 text-lg font-bold focus:outline-none focus:bg-white/30">
                            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200 text-sm">ลิตร</span>
                        </div>
                        <button id="btn-quick-save" class="bg-white text-blue-600 font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-blue-50 transition shadow-sm whitespace-nowrap">
                            บันทึก
                        </button>
                    </div>
                    <p class="text-xs text-blue-200 mt-2">หรือกด "บันทึกรวม" เพื่อเลือกวันที่และเพิ่มหมายเหตุ</p>
                </div>

                <!-- Chart -->
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div class="flex justify-between items-center mb-3">
                        <p class="text-sm font-semibold text-gray-700">กราฟน้ำนมรายวัน (30 วัน)</p>
                        <div class="flex items-center gap-3 text-xs text-gray-400">
                            <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-blue-500 inline-block rounded"></span>นมรวม</span>
                            <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-amber-400 inline-block rounded" style="border-top: 1px dashed #fbbf24; background: none;"></span>เฉลี่ย</span>
                        </div>
                    </div>
                    ${chartHTML}
                    ${dailyTotals.length > 0 ? `
                    <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                        <div class="text-center">
                            <p class="text-xs text-gray-400">เฉลี่ย/วัน</p>
                            <p class="font-bold text-gray-800 text-sm">${avgVal} <span class="font-normal text-xs text-gray-400">ล.</span></p>
                        </div>
                        <div class="text-center border-x border-gray-100">
                            <p class="text-xs text-gray-400">สูงสุด</p>
                            <p class="font-bold text-gray-800 text-sm">${Math.max(...dailyTotals.map(([,v])=>v))} <span class="font-normal text-xs text-gray-400">ล.</span></p>
                        </div>
                        <div class="text-center">
                            <p class="text-xs text-gray-400">รวม 30 วัน</p>
                            <p class="font-bold text-gray-800 text-sm">${dailyTotals.reduce((s,[,v])=>s+v,0).toFixed(1)} <span class="font-normal text-xs text-gray-400">ล.</span></p>
                        </div>
                    </div>` : ''}
                </div>

                <!-- Recent records -->
                <div class="space-y-2">
                    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">ประวัติล่าสุด</p>
                    ${records.length === 0
                        ? `<div class="bg-white rounded-2xl p-8 text-center border border-gray-100"><i class="ph ph-drop text-4xl text-gray-300 block mb-2"></i><p class="text-sm text-gray-400">ยังไม่มีข้อมูล</p></div>`
                        : records.map(r => `
                        <div class="bg-white rounded-xl border border-gray-100 px-4 py-3 flex justify-between items-center shadow-sm">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-lg flex items-center justify-center text-base ${r.session === 'daily' ? 'bg-blue-100' : r.session === 'morning' ? 'bg-orange-50' : 'bg-indigo-50'}">
                                    ${r.session === 'daily' ? '🥛' : r.session === 'morning' ? '🌅' : '🌙'}
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-gray-800">${r.cowName || 'ไม่ระบุ'}</p>
                                    <p class="text-xs text-gray-400">${r.session === 'daily' ? 'รวมทั้งวัน' : r.session === 'morning' ? 'เช้า' : 'เย็น'} · ${formatDate(r.createdAt)}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-blue-600">${r.amount} ล.</span>
                                <button data-del-milk="${r.id}" class="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                    <i class="ph ph-trash text-base"></i>
                                </button>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;

        // Quick save (กรอกตรงหน้า)
        document.getElementById('btn-quick-save')?.addEventListener('click', () => {
        const input = document.getElementById('quick-milk-input');
        const dateInput = document.getElementById('quick-milk-date');
        const amount = parseFloat(input.value);
     const selectedDate = dateInput.value;

    if (!amount || amount <= 0) { showToast('กรุณาใส่ปริมาณนม', 'error'); return; }
    
    // ส่งวันที่ที่เลือกเข้าไป
    MilkModel.addDailyTotal(selectedDate, amount);
    showToast(`บันทึก ${amount} ลิตร ของวันที่ ${formatDate(selectedDate)} แล้ว!`);
    input.value = '';
    render();
});

        // Enter key สำหรับ quick input
        document.getElementById('quick-milk-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('btn-quick-save')?.click();
        });

        // บันทึกรวม (modal เลือกวันที่)
        document.getElementById('btn-add-daily')?.addEventListener('click', () => showDailyMilkModal(render));

        // บันทึกแยกวัว
        document.getElementById('btn-add-milk')?.addEventListener('click', () => showMilkModal(cows, render));

        // ลบ
        container.querySelectorAll('[data-del-milk]').forEach(btn => btn.addEventListener('click', () => {
            showConfirm('ลบบันทึกน้ำนมนี้ใช่ไหม?', () => {
                MilkModel.delete(btn.dataset.delMilk);
                showToast('ลบแล้ว', 'info');
                render();
                return true;
            });
        }));
    }
    render();
}

function showDailyMilkModal(onSaved) {
    const todayStr = todayLocalStr();
    const bodyHTML = `
        <div class="space-y-3">
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">วันที่ *</label>
                <input id="daily-date" type="date" value="${todayStr}" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">น้ำนมรวมทั้งวัน (ลิตร) *</label>
                <input id="daily-amount" type="number" step="0.5" min="0" placeholder="เช่น 120" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">หมายเหตุ</label>
                <input id="daily-note" type="text" placeholder="เช่น วัวป่วย 1 ตัว" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
        </div>`;
    showModal('บันทึกนมรวมทั้งวัน', bodyHTML, () => {
        const date = document.getElementById('daily-date').value;
        const amount = parseFloat(document.getElementById('daily-amount').value);
        const note = document.getElementById('daily-note').value.trim();
        if (!date) { showToast('กรุณาเลือกวันที่', 'error'); return false; }
        if (!amount || amount <= 0) { showToast('กรุณาใส่ปริมาณนม', 'error'); return false; }
        MilkModel.addDailyTotal(date, amount, note);
        showToast(`บันทึก ${amount} ลิตร สำเร็จ!`);
        onSaved();
        return true;
    });
}

function showMilkModal(cows, onSaved) {
    if (cows.length === 0) { showToast('กรุณาเพิ่มวัวที่กำลังให้นมก่อน', 'error'); return; }
    const bodyHTML = `
        <div class="space-y-3">
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">เลือกวัว *</label>
                <select id="milk-cow" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    ${cows.map(c => `<option value="${c.id}" data-name="${c.name} (#${c.number})">${c.name} (#${c.number})</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">รอบรีด *</label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                        <input type="radio" name="session" value="morning" checked class="accent-blue-600">
                        <span class="text-sm">🌅 เช้า</span>
                    </label>
                    <label class="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                        <input type="radio" name="session" value="evening" class="accent-blue-600">
                        <span class="text-sm">🌙 เย็น</span>
                    </label>
                </div>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">ปริมาณ (ลิตร) *</label>
                <input id="milk-amount" type="number" step="0.5" min="0" placeholder="เช่น 12.5" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
        </div>`;
    showModal('บันทึกน้ำนมแยกวัว', bodyHTML, () => {
        const select = document.getElementById('milk-cow');
        const cowId = select.value;
        const cowName = select.options[select.selectedIndex].dataset.name;
        const session = document.querySelector('input[name="session"]:checked').value;
        const amount = parseFloat(document.getElementById('milk-amount').value);
        if (!amount || amount <= 0) { showToast('กรุณาใส่ปริมาณน้ำนม', 'error'); return false; }
        MilkModel.add({ cowId, cowName, session, amount });
        showToast(`บันทึก ${amount} ลิตร สำเร็จ!`);
        onSaved();
        return true;
    });
}

// ==========================================
// VIEW: INVENTORY
// ==========================================
function renderInventoryView(container) {
    function render() {
        const summary = InventoryModel.getStockSummary();
        const transactions = InventoryModel.getAll().slice(-15).reverse();

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">สต็อกอาหารและยา</h2>
                <button id="btn-add-stock" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 shadow-sm hover:bg-blue-700 transition">
                    <i class="ph ph-plus text-base"></i> เพิ่ม/เบิก
                </button>
            </div>

            <!-- Stock Summary -->
            <div class="space-y-2 mb-5">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">ยอดคงเหลือ</p>
                ${summary.length === 0 ? `
                <div class="bg-white rounded-2xl p-8 text-center border border-gray-100">
                    <i class="ph ph-package text-4xl text-gray-300 block mb-2"></i>
                    <p class="text-sm text-gray-400">ยังไม่มีข้อมูลสต็อก</p>
                </div>` :
                summary.map(item => `
                    <div class="bg-white rounded-xl border ${item.isLowStock ? 'border-red-200 bg-red-50' : 'border-gray-100'} px-4 py-3 shadow-sm">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center gap-2">
                                ${item.isLowStock ? '<i class="ph-fill ph-warning text-red-500"></i>' : '<i class="ph ph-package text-gray-400"></i>'}
                                <span class="text-sm font-medium ${item.isLowStock ? 'text-red-700' : 'text-gray-800'}">${item.name}</span>
                            </div>
                            <span class="text-sm font-bold ${item.isLowStock ? 'text-red-600' : 'text-gray-700'}">${formatNum(item.balance)} ${item.unit}</span>
                        </div>
                        ${item.daysLeft !== null ? `
                        <div class="mt-2">
                            <div class="flex justify-between text-xs text-gray-400 mb-1">
                                <span>ใช้ ${item.dailyUsageRate} ${item.unit}/วัน</span>
                                <span class="${item.isLowStock ? 'text-red-500 font-semibold' : ''}">เหลือ ${item.daysLeft} วัน</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-1.5">
                                <div class="h-1.5 rounded-full ${item.isLowStock ? 'bg-red-400' : 'bg-blue-400'}" style="width:${Math.min(100, (item.daysLeft / 30) * 100)}%"></div>
                            </div>
                        </div>` : ''}
                    </div>`).join('')}
            </div>

            <!-- Recent Transactions -->
            <div class="space-y-2">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">รายการล่าสุด</p>
                ${transactions.map(t => `
                    <div class="bg-white rounded-xl border border-gray-100 px-4 py-3 flex justify-between items-center shadow-sm">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 ${t.type === 'IN' ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center">
                                <i class="ph ph-${t.type === 'IN' ? 'arrow-line-down text-green-600' : 'arrow-line-up text-red-600'} text-sm"></i>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-800">${t.name}</p>
                                <p class="text-xs text-gray-400">${t.type === 'IN' ? 'รับเข้า' : 'เบิกออก'} · ${formatDate(t.createdAt)}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-500'}">${t.type === 'IN' ? '+' : '-'}${formatNum(t.quantity)} ${t.unit || ''}</span>
                            <button data-del-stock="${t.id}" class="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                <i class="ph ph-trash text-base"></i>
                            </button>
                        </div>
                    </div>`).join('')}
            </div>`;

        document.getElementById('btn-add-stock')?.addEventListener('click', () => showInventoryModal(render));
        container.querySelectorAll('[data-del-stock]').forEach(btn => btn.addEventListener('click', () => {
            showConfirm('ลบรายการนี้ใช่ไหม?', () => {
                InventoryModel.delete(btn.dataset.delStock);
                showToast('ลบแล้ว', 'info');
                render();
                return true;
            });
        }));
    }
    render();
}

function showInventoryModal(onSaved) {
    const bodyHTML = `
        <div class="space-y-3">
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">ชื่อสินค้า *</label>
                <input id="inv-name" type="text" placeholder="เช่น อาหารข้น, ยาถ่ายพยาธิ" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">ประเภทรายการ *</label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-green-400 has-[:checked]:bg-green-50">
                        <input type="radio" name="inv-type" value="IN" checked class="accent-green-600">
                        <span class="text-sm">📥 รับเข้า</span>
                    </label>
                    <label class="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-red-400 has-[:checked]:bg-red-50">
                        <input type="radio" name="inv-type" value="OUT" class="accent-red-500">
                        <span class="text-sm">📤 เบิกออก</span>
                    </label>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs font-medium text-gray-500 block mb-1">จำนวน *</label>
                    <input id="inv-qty" type="number" min="0" placeholder="0" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                </div>
                <div>
                    <label class="text-xs font-medium text-gray-500 block mb-1">หน่วย</label>
                    <input id="inv-unit" type="text" placeholder="กก., ขวด, เม็ด" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                </div>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">อัตราใช้ต่อวัน (ใส่ถ้ารู้)</label>
                <input id="inv-rate" type="number" min="0" step="0.1" placeholder="0 = ไม่คำนวณวันหมด" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
        </div>`;

    showModal('เพิ่ม/เบิกสินค้า', bodyHTML, () => {
        const name = document.getElementById('inv-name').value.trim();
        const qty = parseFloat(document.getElementById('inv-qty').value);
        if (!name) { showToast('กรุณาใส่ชื่อสินค้า', 'error'); return false; }
        if (!qty || qty <= 0) { showToast('กรุณาใส่จำนวนที่ถูกต้อง', 'error'); return false; }
        InventoryModel.add({
            name,
            type: document.querySelector('input[name="inv-type"]:checked').value,
            quantity: qty,
            unit: document.getElementById('inv-unit').value.trim() || 'หน่วย',
            dailyUsageRate: parseFloat(document.getElementById('inv-rate').value) || 0
        });
        showToast('บันทึกสำเร็จ!');
        onSaved();
        return true;
    });
}

// ==========================================
// EXPENSE MODAL (from dashboard)
// ==========================================
function showExpenseModal() {
    const bodyHTML = `
        <div class="space-y-3">
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">ประเภท *</label>
                <div class="grid grid-cols-2 gap-2">
                    <label class="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-green-400 has-[:checked]:bg-green-50">
                        <input type="radio" name="exp-type" value="income" checked class="accent-green-600">
                        <span class="text-sm">💰 รายรับ</span>
                    </label>
                    <label class="flex items-center gap-2 border border-gray-200 rounded-xl p-3 cursor-pointer has-[:checked]:border-red-400 has-[:checked]:bg-red-50">
                        <input type="radio" name="exp-type" value="expense" class="accent-red-500">
                        <span class="text-sm">💸 รายจ่าย</span>
                    </label>
                </div>
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">รายละเอียด *</label>
                <input id="exp-desc" type="text" placeholder="เช่น ขายนมสด, ค่าอาหารสัตว์" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">จำนวนเงิน (บาท) *</label>
                <input id="exp-amount" type="number" min="0" placeholder="0" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            </div>
        </div>`;

    showModal('บันทึกรายรับ/รายจ่าย', bodyHTML, () => {
        const desc = document.getElementById('exp-desc').value.trim();
        const amount = parseFloat(document.getElementById('exp-amount').value);
        const type = document.querySelector('input[name="exp-type"]:checked').value;
        if (!desc) { showToast('กรุณาใส่รายละเอียด', 'error'); return false; }
        if (!amount || amount <= 0) { showToast('กรุณาใส่จำนวนเงิน', 'error'); return false; }
        ExpenseModel.add({ description: desc, amount, isIncome: type === 'income', category: type });
        showToast(`บันทึก ${type === 'income' ? 'รายรับ' : 'รายจ่าย'} สำเร็จ!`);
        App.navigate('dashboard');
        return true;
    });
}

// ==========================================
// EXPORT ALL DATA
// ==========================================
function exportAllData() {
    const all = [
        ...CowModel.getAll().map(r => ({ ประเภท: 'วัว', ...r })),
        ...MilkModel.getAll().map(r => ({ ประเภท: 'น้ำนม', ...r })),
        ...InventoryModel.getAll().map(r => ({ ประเภท: 'สต็อก', ...r })),
        ...ExpenseModel.getAll().map(r => ({ ประเภท: 'รายรับจ่าย', ...r }))
    ];
    if (all.length === 0) { showToast('ไม่มีข้อมูลสำหรับ Export', 'error'); return; }
    exportToCSV(all, `MooManager_Export_${todayLocalStr()}.csv`);
}

// ==========================================
// ROUTER & APP INIT
// ==========================================
window.App = {
    currentPage: 'dashboard',
    navigate(page) {
        const contentArea = document.getElementById('app-content');
        const navButtons = document.querySelectorAll('.nav-btn');
        const routes = { dashboard: renderDashboardView, cows: renderCowsView, milk: renderMilkView, inventory: renderInventoryView };

        this.currentPage = page;

        contentArea.innerHTML = `<div class="flex justify-center items-center h-full pt-24"><div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>`;

        setTimeout(() => {
            if (routes[page]) routes[page](contentArea);
        }, 100);

        navButtons.forEach(btn => {
            const icon = btn.querySelector('i');
            if (btn.dataset.target === page) {
                btn.classList.add('text-blue-600');
                btn.classList.remove('text-gray-400');
                if (icon) { icon.className = icon.className.replace(' ph ', ' ph-fill '); }
            } else {
                btn.classList.remove('text-blue-600');
                btn.classList.add('text-gray-400');
                if (icon) { icon.className = icon.className.replace(' ph-fill ', ' ph '); }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Seed ข้อมูลตัวอย่าง
    seedDemoData();

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => App.navigate(btn.dataset.target));
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', exportAllData);

    // Modal slide-up animation
    const style = document.createElement('style');
    style.textContent = `@keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slide-up { animation: slide-up 0.25s ease-out; }`;
    document.head.appendChild(style);

    // Load dashboard
    App.navigate('dashboard');
});