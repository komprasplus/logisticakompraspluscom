import { supabase } from "@/integrations/supabase/client";

// IndexedDB configuration
const DB_NAME = "plusenvios_offline";
const DB_VERSION = 1;
const STORE_DELIVERIES = "pending_deliveries";
const STORE_NOVEDADES = "pending_novedades";

interface PendingDelivery {
  id: string;
  pedidoId: number;
  estado: string;
  foto_evidencia: string | null;
  foto_paquete: string | null;
  firma_cliente: string | null;
  latitude: number | null;
  longitude: number | null;
  isDeviation: boolean;
  timestamp: number;
  synced: boolean;
}

interface PendingNovedad {
  id: string;
  pedidoId: number;
  tipo_novedad: string;
  foto_evidencia: string | null;
  novedadReason: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: number;
  synced: boolean;
}

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_DELIVERIES)) {
        const deliveryStore = db.createObjectStore(STORE_DELIVERIES, { keyPath: "id" });
        deliveryStore.createIndex("pedidoId", "pedidoId", { unique: false });
        deliveryStore.createIndex("synced", "synced", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NOVEDADES)) {
        const novedadStore = db.createObjectStore(STORE_NOVEDADES, { keyPath: "id" });
        novedadStore.createIndex("pedidoId", "pedidoId", { unique: false });
        novedadStore.createIndex("synced", "synced", { unique: false });
      }
    };
  });
};

// Save pending delivery offline
export const savePendingDeliveryOffline = async (
  delivery: Omit<PendingDelivery, "id" | "timestamp" | "synced">
): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_DELIVERIES], "readwrite");
    const store = transaction.objectStore(STORE_DELIVERIES);

    const pendingDelivery: PendingDelivery = {
      ...delivery,
      id: `delivery_${delivery.pedidoId}_${Date.now()}`,
      timestamp: Date.now(),
      synced: false,
    };

    store.add(pendingDelivery);
    db.close();
    console.log("Delivery saved offline:", pendingDelivery.id);
  } catch (error) {
    console.error("Error saving delivery offline:", error);
    throw error;
  }
};

// Save pending novedad offline
export const savePendingNovedadOffline = async (
  novedad: Omit<PendingNovedad, "id" | "timestamp" | "synced">
): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NOVEDADES], "readwrite");
    const store = transaction.objectStore(STORE_NOVEDADES);

    const pendingNovedad: PendingNovedad = {
      ...novedad,
      id: `novedad_${novedad.pedidoId}_${Date.now()}`,
      timestamp: Date.now(),
      synced: false,
    };

    store.add(pendingNovedad);
    db.close();
    console.log("Novedad saved offline:", pendingNovedad.id);
  } catch (error) {
    console.error("Error saving novedad offline:", error);
    throw error;
  }
};

// Get all pending (unsynced) items
export const getPendingItems = async (): Promise<{
  deliveries: PendingDelivery[];
  novedades: PendingNovedad[];
}> => {
  try {
    const db = await initDB();
    
    const deliveries = await new Promise<PendingDelivery[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_DELIVERIES], "readonly");
      const store = transaction.objectStore(STORE_DELIVERIES);
      const index = store.index("synced");
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const novedades = await new Promise<PendingNovedad[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NOVEDADES], "readonly");
      const store = transaction.objectStore(STORE_NOVEDADES);
      const index = store.index("synced");
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return { deliveries, novedades };
  } catch (error) {
    console.error("Error getting pending items:", error);
    return { deliveries: [], novedades: [] };
  }
};

// Sync a single delivery to Supabase
const syncDelivery = async (delivery: PendingDelivery): Promise<boolean> => {
  try {
    const updateData: Record<string, unknown> = {
      estado: delivery.estado,
      foto_evidencia: delivery.foto_evidencia,
      foto_paquete: delivery.foto_paquete,
      firma_cliente: delivery.firma_cliente,
      fecha_actualizacion: new Date(delivery.timestamp).toISOString(),
    };

    // Add deviation info if applicable
    if (delivery.isDeviation) {
      const existingObs = await supabase
        .from("pedidos")
        .select("observaciones")
        .eq("id", delivery.pedidoId)
        .single();

      const deviationNote = `[SISTEMA] ${new Date(delivery.timestamp).toLocaleString()} - Entrega con Desviación GPS. Coordenadas reales: ${delivery.latitude}, ${delivery.longitude}`;
      updateData.observaciones = existingObs.data?.observaciones 
        ? `${existingObs.data.observaciones}\n\n${deviationNote}` 
        : deviationNote;
    }

    const { error } = await supabase
      .from("pedidos")
      .update(updateData)
      .eq("id", delivery.pedidoId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error syncing delivery:", error);
    return false;
  }
};

// Sync a single novedad to Supabase
const syncNovedad = async (novedad: PendingNovedad): Promise<boolean> => {
  try {
    const updateData: Record<string, unknown> = {
      estado: "Novedad",
      tipo_novedad: novedad.tipo_novedad,
      fecha_actualizacion: new Date(novedad.timestamp).toISOString(),
    };

    if (novedad.foto_evidencia) {
      updateData.foto_evidencia = novedad.foto_evidencia;
    }

    if (novedad.latitude && novedad.longitude) {
      updateData.novedad_latitud = novedad.latitude;
      updateData.novedad_longitud = novedad.longitude;
    }

    const { error } = await supabase
      .from("pedidos")
      .update(updateData)
      .eq("id", novedad.pedidoId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error syncing novedad:", error);
    return false;
  }
};

// Mark item as synced
const markAsSynced = async (storeName: string, id: string): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result;
      if (item) {
        item.synced = true;
        store.put(item);
      }
    };
    
    db.close();
  } catch (error) {
    console.error("Error marking as synced:", error);
  }
};

// Sync all pending items
export const syncAllPending = async (): Promise<{
  syncedDeliveries: number;
  syncedNovedades: number;
  failedDeliveries: number;
  failedNovedades: number;
}> => {
  const { deliveries, novedades } = await getPendingItems();
  
  let syncedDeliveries = 0;
  let syncedNovedades = 0;
  let failedDeliveries = 0;
  let failedNovedades = 0;

  // Sync deliveries
  for (const delivery of deliveries) {
    const success = await syncDelivery(delivery);
    if (success) {
      await markAsSynced(STORE_DELIVERIES, delivery.id);
      syncedDeliveries++;
    } else {
      failedDeliveries++;
    }
  }

  // Sync novedades
  for (const novedad of novedades) {
    const success = await syncNovedad(novedad);
    if (success) {
      await markAsSynced(STORE_NOVEDADES, novedad.id);
      syncedNovedades++;
    } else {
      failedNovedades++;
    }
  }

  return { syncedDeliveries, syncedNovedades, failedDeliveries, failedNovedades };
};

// Check if we're online
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Setup automatic sync when coming online
export const setupOnlineSync = (onSync?: (result: Awaited<ReturnType<typeof syncAllPending>>) => void): () => void => {
  const handleOnline = async () => {
    console.log("Device came online, syncing pending items...");
    const result = await syncAllPending();
    console.log("Sync result:", result);
    onSync?.(result);
  };

  window.addEventListener("online", handleOnline);

  // Also check on initial load
  if (isOnline()) {
    getPendingItems().then(({ deliveries, novedades }) => {
      if (deliveries.length > 0 || novedades.length > 0) {
        handleOnline();
      }
    });
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
};

// Get count of pending items
export const getPendingCount = async (): Promise<number> => {
  const { deliveries, novedades } = await getPendingItems();
  return deliveries.length + novedades.length;
};
