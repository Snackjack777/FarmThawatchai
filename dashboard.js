// src/screens/dashboard.js
import { InventoryModel } from '../models/inventoryModel.js';
import { DashboardCard, AlertWidget } from './uiComponents.js';

export function renderDashboard(containerId) {
    const container = document.getElementById(containerId);
    
    // ดึงข้อมูล (สมมติว่ามี FinanceModel และ MilkModel ด้วย)
    // const totalProfit = FinanceModel.getProfit();
    // const totalMilk = MilkModel.getTodayMilk();
    const totalProfit = "฿ 15,400"; // Mockup
    const totalMilk = "120 L"; // Mockup
    
    const stockSummary = InventoryModel.getStockSummary();
    const lowStockItems = stockSummary.filter(item => item.isLowStock);

    let html = `<h2 class="text-xl font-bold mb-4">Dashboard ฟาร์ม</h2>`;

    // 1. ระบบแจ้งเตือนของใกล้หมด
    lowStockItems.forEach(item => {
        html += AlertWidget(`${item.name} ใกล้หมด! เหลือใช้ได้อีกประมาณ ${item.daysLeft} วัน (คงเหลือ ${item.balance})`);
    });

    // 2. การ์ดแสดงข้อมูล
    html += `
        <div class="grid grid-cols-2 gap-4 mb-6">
            ${DashboardCard('กำไรเดือนนี้', totalProfit, '💰', 'border-green-500')}
            ${DashboardCard('น้ำนมวันนี้', totalMilk, '🥛', 'border-blue-500')}
        </div>
    `;

    // 3. ตารางสรุปสต็อกแบบย่อ
    html += `
        <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-700">สต็อกอาหารและยา</div>
            <ul class="divide-y divide-gray-100">
                ${stockSummary.map(item => `
                    <li class="px-4 py-3 flex justify-between items-center text-sm">
                        <span>${item.name}</span>
                        <span class="${item.isLowStock ? 'text-red-500 font-bold' : 'text-gray-600'}">
                            ${item.balance} หน่วย 
                            ${item.daysLeft !== null ? `<span class="text-xs text-gray-400">(${item.daysLeft} วัน)</span>` : ''}
                        </span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    container.innerHTML = html;
}