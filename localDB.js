// src/database/localDB.js
export class LocalDB {
    static get(collectionName) {
        const data = localStorage.getItem(collectionName);
        return data ? JSON.parse(data) : [];
    }

    static save(collectionName, data) {
        localStorage.setItem(collectionName, JSON.stringify(data));
    }

    static add(collectionName, item) {
        const data = this.get(collectionName);
        item.id = Date.now().toString(); // สร้าง ID ง่ายๆ จาก Timestamp
        item.createdAt = new Date().toISOString();
        data.push(item);
        this.save(collectionName, data);
        return item;
    }

    static update(collectionName, id, updatedData) {
        let data = this.get(collectionName);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...updatedData, updatedAt: new Date().toISOString() };
            this.save(collectionName, data);
        }
    }

    static delete(collectionName, id) {
        let data = this.get(collectionName);
        data = data.filter(item => item.id !== id);
        this.save(collectionName, data);
    }
}