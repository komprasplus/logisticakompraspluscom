import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { playGlobalNotificationPing } from "@/hooks/useNotificationSound";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Message {
  id: string;
  pedido_id: number;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface PedidoChatProps {
  pedidoId: number;
  isOpen: boolean;
  onClose: () => void;
  onNewMessage?: () => void;
}

const PedidoChat = ({ pedidoId, isOpen, onClose, onNewMessage }: PedidoChatProps) => {
  const { user, profile, role } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch existing messages
  useEffect(() => {
    if (!isOpen || !pedidoId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("pedido_messages")
        .select("*")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages((data as Message[]) || []);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [isOpen, pedidoId]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!isOpen || !pedidoId) return;

    const channel = supabase
      .channel(`pedido-chat-${pedidoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pedido_messages",
          filter: `pedido_id=eq.${pedidoId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Don't duplicate if we already have it (from our own insert)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Play sound if message is from someone else
          if (newMsg.sender_id !== user?.id) {
            playGlobalNotificationPing();
            onNewMessage?.();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, pedidoId, user?.id, onNewMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !profile || sending) return;

    const trimmed = newMessage.trim();
    if (trimmed.length > 500) {
      toast.error("Máximo 500 caracteres");
      return;
    }

    setSending(true);
    setNewMessage("");

    const msgData = {
      pedido_id: pedidoId,
      sender_id: user.id,
      sender_name: profile.full_name,
      sender_role: role || "cliente",
      message: trimmed,
    };

    const { error } = await supabase.from("pedido_messages").insert(msgData);

    if (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar mensaje");
      setNewMessage(trimmed); // Restore message
    }
    setSending(false);
  };

  const getRoleBadge = (senderRole: string) => {
    switch (senderRole) {
      case "motorizado":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "cliente":
        return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
      case "admin":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRoleLabel = (senderRole: string) => {
    switch (senderRole) {
      case "motorizado": return "Mensajero";
      case "cliente": return "Tienda";
      case "admin": return "Admin";
      case "despachador": return "Despacho";
      default: return senderRole;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="mt-4 rounded-2xl border border-border bg-card shadow-card overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Chat del Pedido</span>
            <span className="text-xs text-muted-foreground">({messages.length})</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-48 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No hay mensajes aún. Escribe el primero.
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getRoleBadge(msg.sender_role)}`}>
                      {getRoleLabel(msg.sender_role)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{msg.sender_name}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    {new Date(msg.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
            maxLength={500}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="h-9 w-9 p-0 rounded-lg"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PedidoChat;
