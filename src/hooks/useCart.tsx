import { useCallback, useEffect, useMemo, useState } from "react";

export interface CartItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  unitPrice: number;
  qty: number;
  imageUrl: string | null;
  stockAtAdd: number;
  minQuantity: number;
}

interface StoredCart {
  v: 1;
  items: CartItem[];
  updatedAt: string;
}

const buildKey = (slug: string, listaSlug?: string | null) =>
  `cart:v1:${slug}:${listaSlug || "default"}`;

const readCart = (key: string): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCart;
    if (parsed?.v !== 1 || !Array.isArray(parsed.items)) return [];
    return parsed.items;
  } catch {
    return [];
  }
};

const writeCart = (key: string, items: CartItem[]) => {
  if (typeof window === "undefined") return;
  const payload: StoredCart = { v: 1, items, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(key, JSON.stringify(payload));
};

const sameLine = (a: CartItem, b: Pick<CartItem, "productId" | "variantId">) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);

export const useCart = (slug: string | undefined, listaSlug?: string | null) => {
  const key = slug ? buildKey(slug, listaSlug) : null;
  const [items, setItems] = useState<CartItem[]>([]);

  // Cargar al montar y cuando cambia la lista activa o el slug
  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    setItems(readCart(key));
  }, [key]);

  // Sincronización entre pestañas
  useEffect(() => {
    if (!key) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setItems(readCart(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const persist = useCallback(
    (next: CartItem[]) => {
      if (!key) return;
      writeCart(key, next);
      setItems(next);
    },
    [key],
  );

  const add = useCallback(
    (item: Omit<CartItem, "qty"> & { qty?: number }) => {
      const qty = Math.max(1, item.qty ?? 1);
      const existingIdx = items.findIndex((it) => sameLine(it, item));
      if (existingIdx >= 0) {
        const next = [...items];
        const cur = next[existingIdx];
        const newQty = Math.min(cur.stockAtAdd, cur.qty + qty);
        next[existingIdx] = { ...cur, qty: newQty };
        persist(next);
      } else {
        const cleanQty = Math.min(item.stockAtAdd, qty);
        persist([...items, { ...item, qty: cleanQty }]);
      }
    },
    [items, persist],
  );

  const updateQty = useCallback(
    (productId: string, variantId: string | null, qty: number) => {
      const next = items
        .map((it) =>
          sameLine(it, { productId, variantId })
            ? { ...it, qty: Math.max(0, Math.min(it.stockAtAdd, qty)) }
            : it,
        )
        .filter((it) => it.qty > 0);
      persist(next);
    },
    [items, persist],
  );

  const remove = useCallback(
    (productId: string, variantId: string | null) => {
      persist(items.filter((it) => !sameLine(it, { productId, variantId })));
    },
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0),
    [items],
  );
  const count = useMemo(
    () => items.reduce((sum, it) => sum + it.qty, 0),
    [items],
  );

  return { items, add, updateQty, remove, clear, total, count };
};
