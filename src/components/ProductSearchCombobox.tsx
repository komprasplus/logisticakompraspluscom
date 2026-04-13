import { useState, useEffect, useRef } from "react";
import { Package, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface InventoryResult {
  id: string;
  product_name: string;
  sku: string;
  price: number | null;
  stock_available: number;
}

interface ProductSearchComboboxProps {
  value: string;
  onSelect: (product: {
    productName: string;
    sku: string;
    unitPrice: number;
    inventoryItemId: string | null;
  }) => void;
  onChange: (value: string) => void;
  placeholder?: string;
  orgId?: string | null;
}

const ProductSearchCombobox = ({
  value,
  onSelect,
  onChange,
  placeholder = "Buscar producto del inventario...",
  orgId,
}: ProductSearchComboboxProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      let q = supabase
        .from("inventory")
        .select("id, product_name, sku, price, stock_available")
        .ilike("product_name", `%${term}%`)
        .gt("stock_available", 0)
        .order("product_name")
        .limit(10);

      if (orgId) q = q.eq("organizacion_id", orgId);

      const { data, error } = await q;
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error("Product search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (item: InventoryResult) => {
    setQuery(item.product_name);
    setOpen(false);
    onSelect({
      productName: item.product_name,
      sku: item.sku,
      unitPrice: item.price ?? 0,
      inventoryItemId: item.id,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (query.length >= 2) setOpen(true); }}
        className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}

      {open && (results.length > 0 || (query.length >= 2 && !loading)) && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.length === 0 && !loading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No se encontraron productos. Puedes escribir el nombre manualmente.
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                )}
              >
                <Package className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {item.sku} · Stock: {item.stock_available}
                    {item.price ? ` · $${item.price.toLocaleString()}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSearchCombobox;
