// src/widgets/uiComponents.js

// การ์ดแสดงผลรวมบน Dashboard
export function DashboardCard(title, value, icon, colorClass) {
    return `
        <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 ${colorClass} flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500 mb-1">${title}</p>
                <h3 class="text-2xl font-bold text-gray-800">${value}</h3>
            </div>
            <div class="text-3xl ${colorClass.replace('border-', 'text-')}">${icon}</div>
        </div>
    `;
}

// แถบแจ้งเตือนของใกล้หมด
export function AlertWidget(message) {
    return `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 flex items-center" role="alert">
            <span class="mr-2">⚠️</span>
            <span class="block sm:inline text-sm">${message}</span>
        </div>
    `;
}

export function exportToCSV(dataArray, filename = 'farm_report.csv') {
    if (!dataArray || !dataArray.length) return;

    // ดึง Header จาก Key ของ Object ตัวแรก
    const headers = Object.keys(dataArray[0]).join(',');
    
    // ดึง Data
    const rows = dataArray.map(obj => 
        Object.values(obj).map(val => `"${val}"`).join(',')
    ).join('\n');

    const csvContent = headers + '\n' + rows;
    
    // ใส่ BOM (\uFEFF) เพื่อให้ Excel อ่านภาษาไทยได้ถูกต้อง
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}