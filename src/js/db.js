class LocalDB {
    constructor(dbName = 'AppVentasDB', version = 2) { // Upgraded to v2
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (event) => {
                console.error('Error opening DB', event);
                reject('Error opening DB');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('DB Opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Clients Store
                if (!db.objectStoreNames.contains('clients')) {
                    const clientsStore = db.createObjectStore('clients', { keyPath: 'code' });
                    clientsStore.createIndex('name', 'name', { unique: false });
                }

                // Orders Store
                if (!db.objectStoreNames.contains('orders')) {
                    const ordersStore = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
                    ordersStore.createIndex('date', 'date', { unique: false });
                    ordersStore.createIndex('clientCode', 'clientCode', { unique: false });
                    ordersStore.createIndex('shop', 'shop', { unique: false }); // Store Name denormalized for easier search
                }

                // Config/Meta Store (for goals, last import date, etc.)
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }

                // Departments Store (New in v2)
                if (!db.objectStoreNames.contains('departments')) {
                    db.createObjectStore('departments', { keyPath: 'id' });
                }
            };
        });
    }

    // Generic Add/Put
    async put(storeName, data, key = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = key ? store.put(data, key) : store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Delete
    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic Get
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Generic GetAll
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Bulk Add (for Excel import)
    async bulkPut(storeName, dataArray) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e);

            dataArray.forEach(item => {
                store.put(item);
            });
        });
    }

    // Clear Store
    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
