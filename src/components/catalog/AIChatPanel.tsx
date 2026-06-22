import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Bot,
  User as UserIcon,
  Package,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface SuggestedProduct {
  id: string;
  short_id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  stock: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedProducts?: SuggestedProduct[];
}

interface AIChatPanelProps {
  slug: string;
  listaSlug?: string | null;
  codigoAcceso?: string | null;
  colorPrimary: string;
  colorSecondary: string;
  storeName: string;
}

const SUGGESTED_PROMPTS = [
  "¿Qué tienen para regalar?",
  "Recomiéndame los más vendidos",
  "Busco algo bueno por menos de $50.000",
];

const STORAGE_KEY_PREFIX = "ai-chat:v1:";

const AIChatPanel = ({
  slug,
  listaSlug,
  codigoAcceso,
  colorPrimary,
  colorSecondary,
  storeName,
}: AIChatPanelProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageKey = STORAGE_KEY_PREFIX + slug + ":" + (listaSlug || "default");

  // Cargar historial al abrir
  useEffect(() => {
    if (!open) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  // Persistir al cambiar
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [messages, storageKey]);

  // Autoscroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-catalog-chat", {
        body: {
          slug,
          lista_slug: listaSlug ?? null,
          codigo_acceso: codigoAcceso ?? null,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        },
      });
      if (error) throw error;
      const r = data as { ok: boolean; error?: string; text?: string; suggested_products?: SuggestedProduct[] };
      if (!r?.ok || !r.text) {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: r?.error || "Hubo un problema. Intenta de nuevo.",
        };
        setMessages([...nextMessages, errMsg]);
        return;
      }
      // Limpiar las marcas [REF: XXXXXX] del texto para que se muestre limpio
      const cleanText = r.text.replace(/\[REF:\s*[A-Z0-9]{6}\]/g, "").replace(/\s+\./g, ".").trim();
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: cleanText,
        suggestedProducts: r.suggested_products ?? [],
      };
      setMessages([...nextMessages, aiMsg]);
    } catch (e: any) {
      const msg = e?.context?.body?.error ?? e?.message ?? "No pude responder. Intenta de nuevo.";
      toast.error(msg);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Lo siento, hubo un error de conexión. ¿Puedes intentar de nuevo?" },
      ]);
    } finally {
      setSending(false);
    }
  };

  const goToProduct = (productId: string) => {
    setOpen(false);
    setTimeout(() => navigate("/" + slug + "/catalogo/" + productId), 200);
  };

  const reset = () => {
    setMessages([]);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-4 z-40 h-14 rounded-full shadow-xl px-4 flex items-center gap-2 text-white font-bold hover:scale-105 active:scale-95 transition-transform"
          style={{ background: "linear-gradient(135deg, " + colorPrimary + ", " + colorSecondary + ")" }}
          aria-label="Abrir asistente IA"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm hidden sm:inline">Pregúntale a la IA</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader
            className="px-5 pt-5 pb-3 border-b border-border"
            style={{ background: "linear-gradient(135deg, " + colorPrimary + "10, transparent)" }}
          >
            <SheetTitle className="flex items-center gap-2 text-base">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-white shadow"
                style={{ background: "linear-gradient(135deg, " + colorPrimary + ", " + colorSecondary + ")" }}
              >
                <Bot className="h-4 w-4" />
              </div>
              Asistente IA de {storeName}
            </SheetTitle>
            <p className="text-[11px] text-muted-foreground">
              Te ayudo a encontrar productos y resolver dudas 24/7.
            </p>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div
                  className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-foreground max-w-[85%]"
                >
                  Hola, soy el asistente de <strong>{storeName}</strong>. Dime qué andas buscando
                  y te ayudo a encontrarlo en segundos.
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-1">
                    Prueba con
                  </p>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-2 items-start", m.role === "user" ? "flex-row-reverse" : "")}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-white",
                    m.role === "user" ? "bg-slate-700" : "",
                  )}
                  style={
                    m.role === "assistant"
                      ? { background: "linear-gradient(135deg, " + colorPrimary + ", " + colorSecondary + ")" }
                      : undefined
                  }
                >
                  {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn("flex-1 max-w-[85%]", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm prose prose-sm max-w-none",
                      m.role === "user"
                        ? "bg-slate-700 text-white rounded-tr-sm prose-invert"
                        : "bg-muted text-foreground rounded-tl-sm",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    ) : (
                      <p className="m-0 whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.suggestedProducts && m.suggestedProducts.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {m.suggestedProducts.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => goToProduct(sp.id)}
                          className="w-full flex items-center gap-2 rounded-lg border border-border bg-card p-2 hover:shadow-sm hover:border-primary/40 transition-all text-left"
                        >
                          <div className="h-12 w-12 rounded bg-muted flex-shrink-0 overflow-hidden">
                            {sp.image_url ? (
                              <img src={sp.image_url} alt={sp.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground line-clamp-1">{sp.name}</p>
                            <p className="text-[10px] text-muted-foreground">REF: {sp.short_id}</p>
                            {sp.price !== null && (
                              <p
                                className="text-xs font-bold mt-0.5"
                                style={{ color: colorPrimary }}
                              >
                                {formatCOP(sp.price)}
                              </p>
                            )}
                          </div>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: colorPrimary }}
                          >
                            Ver →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-2 items-start">
                <div
                  className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-white"
                  style={{ background: "linear-gradient(135deg, " + colorPrimary + ", " + colorSecondary + ")" }}
                >
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="h-1.5 w-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregúntame lo que sea..."
                disabled={sending}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                autoFocus
                maxLength={500}
              />
              <Button
                type="submit"
                disabled={!input.trim() || sending}
                size="icon"
                style={{ backgroundColor: colorPrimary, color: "white" }}
                className="hover:opacity-90"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="mt-2 text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Nueva conversación
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AIChatPanel;
