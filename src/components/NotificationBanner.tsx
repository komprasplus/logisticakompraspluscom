import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NotificationBanner = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["user-notifications-unread", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .eq("type", "warning")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const dismissMutation = useMutation({
    mutationFn: async (notifId: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ is_read: true })
        .eq("id", notifId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-notifications-unread"] }),
  });

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="w-full space-y-1 mb-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm",
            "bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300"
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1">{n.message}</p>
          <button
            onClick={() => dismissMutation.mutate(n.id)}
            className="shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationBanner;
