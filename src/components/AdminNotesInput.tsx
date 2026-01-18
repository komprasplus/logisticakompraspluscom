import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AdminNote {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

const AdminNotesInput = () => {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_notes")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data as AdminNote[]) || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!newMessage.trim()) {
      toast.error("El mensaje no puede estar vacío");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("admin_notes").insert({
        message: newMessage.trim(),
        is_active: true,
      });

      if (error) throw error;

      toast.success("Nota publicada para todos los motorizados");
      setNewMessage("");
      fetchNotes();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Error al guardar la nota");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from("admin_notes")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast.success("Nota eliminada");
      fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Error al eliminar la nota");
    }
  };

  return (
    <div className="rounded-xl bg-card border border-border p-4 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Notas para Motorizados</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Escribe un mensaje que todos los motorizados verán en su pantalla principal.
      </p>

      <div className="space-y-4">
        <Textarea
          placeholder="Ej: Cuidado con cierres viales en el centro..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          rows={3}
          className="resize-none"
        />
        
        <Button
          onClick={saveNote}
          disabled={saving || !newMessage.trim()}
          className="w-full gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Publicar Nota
        </Button>
      </div>

      {/* Active Notes */}
      {notes.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Notas Activas</h4>
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200"
              >
                <p className="flex-1 text-sm text-amber-900">{note.message}</p>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="p-1 hover:bg-amber-200 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-amber-700" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotesInput;
