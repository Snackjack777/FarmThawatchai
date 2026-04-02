// src/models/inventoryModel.js
import { LocalDB } from '../database/localDB.js';

export class InventoryModel {
    static COLLECTION = 'farm_inventory';

    // ดึงสต็อกทั้งหมด
    static getAll() {
        return LocalDB.get(this.COLLECTION);
    }

    // เพิ่มการนำเข้า/เบิกออก
    static addTransaction(itemName, type, quantity, dailyUsageRate = 0) {
        const item = {
            name: itemName,
            type: type, // 'IN' หรือ 'OUT'
            quantity: Number(quantity),
            dailyUsageRate: Number(dailyUsageRate) // อัตราการใช้ต่อวัน (สำหรับคำนวณวันหมด)
        };
        return LocalDB.add(this.COLLECTION, item);
    }

    // คำนวณสต็อกคงเหลือและอีกกี่วันหมด
    static getStockSummary() {
        const transactions = this.getAll();
        const summary = {};

        transactions.forEach(t => {
            if (!summary[t.name]) {
                summary[t.name] = { balance: 0, dailyUsageRate: t.dailyUsageRate };
            }
            if (t.type === 'IN') summary[t.name].balance += t.quantity;
            if (t.type === 'OUT') summary[t.name].balance -= t.quantity;
            
            // อัปเดตอัตราการใช้งานล่าสุด
            if (t.dailyUsageRate > 0) summary[t.name].dailyUsageRate = t.dailyUsageRate;
        });

        // คำนวณวันหมดและแจ้งเตือน
        const result = Object.keys(summary).map(name => {
            const data = summary[name];
            const daysLeft = data.dailyUsageRate > 0 ? Math.floor(data.balance / data.dailyUsageRate) : null;
            return {
                name,
                balance: data.balance,
                daysLeft,
                isLowStock: daysLeft !== null && daysLeft <= 3 // แจ้งเตือนถ้าเหลือน้อยกว่า 3 วัน
            };
        });

        return result;
    }
}