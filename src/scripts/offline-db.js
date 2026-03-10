(function bootstrapOfflineDb(globalScope) {
  const DB_VER = 5;
  const STORE_NAMES = [
    "vendedores",
    "clientes",
    "visitas",
    "plantios",
    "contatos",
    "sync_queue",
    "relatorio_vendedores",
    "plantios_criticos"
  ];

  class OfflineDB {
    constructor() {
      this.db = null;
      this.ready = this.init();
    }

    init() {
      return new Promise(resolve => {
        if (!globalScope.indexedDB) {
          console.warn("IndexedDB nao suportado");
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          console.warn("IndexedDB timeout");
          resolve();
        }, 5000);

        const req = globalScope.indexedDB.open("ControlAgroDB", DB_VER);
        req.onupgradeneeded = event => {
          const db = event.target.result;
          STORE_NAMES.forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              const options = storeName === "sync_queue"
                ? { keyPath: "id", autoIncrement: true }
                : { keyPath: "id" };
              db.createObjectStore(storeName, options);
            }
          });
        };
        req.onsuccess = event => {
          clearTimeout(timeout);
          this.db = event.target.result;
          resolve();
        };
        req.onerror = event => {
          clearTimeout(timeout);
          console.error("IndexedDB erro:", event);
          resolve();
        };
      });
    }

    async op(store, mode, operation) {
      await this.ready;
      if (!this.db) {
        return mode === "readonly" ? [] : undefined;
      }

      return new Promise(resolve => {
        try {
          const tx = this.db.transaction(store, mode);
          const objectStore = tx.objectStore(store);
          const req = operation(objectStore);
          req.onsuccess = event => resolve(event.target.result);
          req.onerror = event => {
            console.error("DB op erro:", event);
            resolve(mode === "readonly" ? [] : undefined);
          };
        } catch (error) {
          console.error("DB transaction erro:", error);
          resolve(mode === "readonly" ? [] : undefined);
        }
      });
    }

    getAll(store) {
      return this.op(store, "readonly", objectStore => objectStore.getAll());
    }

    put(store, data) {
      return this.op(store, "readwrite", objectStore => objectStore.put(data));
    }

    add(store, data) {
      return this.op(store, "readwrite", objectStore => objectStore.add(data));
    }

    delete(store, id) {
      return this.op(store, "readwrite", objectStore => objectStore.delete(id));
    }

    clear(store) {
      return this.op(store, "readwrite", objectStore => objectStore.clear());
    }
  }

  globalScope.ControlAgroOfflineDB = {
    DB_VER,
    STORE_NAMES,
    createOfflineDb() {
      return new OfflineDB();
    }
  };
})(window);
