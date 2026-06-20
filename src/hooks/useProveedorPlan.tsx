import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CatalogPlan = "free" | "pro" | "premium" | "business";

export interface PlanLimits {
  /** -1 = ilimitado */
  max_price_lists: number;
  allow_private: boolean;
}

export interface PlanUsage {
  price_lists_activas: number;
}

export interface ProveedorPlanInfo {
  plan: CatalogPlan;
  limits: PlanLimits;
  usage: PlanUsage;
}

const PLAN_LABELS: Record<CatalogPlan, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  business: "Business",
};

export const planLabel = (p: CatalogPlan): string => PLAN_LABELS[p] ?? p;

const rpc = supabase.rpc as any;

export const PROVEEDOR_PLAN_QK = ["proveedor-plan"] as const;

export const useProveedorPlan = () => {
  return useQuery({
    queryKey: PROVEEDOR_PLAN_QK,
    queryFn: async (): Promise<ProveedorPlanInfo> => {
      const { data, error } = await rpc("proveedor_get_plan");
      if (error) throw error;
      const payload = data as ProveedorPlanInfo;
      return {
        plan: (payload?.plan ?? "free") as CatalogPlan,
        limits: {
          max_price_lists: Number(payload?.limits?.max_price_lists ?? 1),
          allow_private: !!payload?.limits?.allow_private,
        },
        usage: {
          price_lists_activas: Number(payload?.usage?.price_lists_activas ?? 0),
        },
      };
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const canCreateMore = (info: ProveedorPlanInfo): boolean => {
  if (info.limits.max_price_lists === -1) return true;
  return info.usage.price_lists_activas < info.limits.max_price_lists;
};
