import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AdminNote {
  id: string;
  message: string;
  created_at: string;
}

const AdminNotesDisplay = () => {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();

    // Subscribe to real-time changes
    const channel = supabase
      .channel("admin-notes-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admin_notes",
        },
        () => {
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_notes")
        .select("id, message, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setNotes((data as AdminNote[]) || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (notes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div className="rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-amber-900">Información Relevante</h3>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-start gap-2 p-3 bg-white/60 rounded-lg border border-amber-200"
              >
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-900 leading-relaxed">{note.message}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminNotesDisplay;
