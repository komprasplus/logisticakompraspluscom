import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  CreditCard,
  Edit3,
  Loader2,
  Smartphone,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  user_id: string;
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  bre_b_key: string | null;
  key_type: string | null;
  is_primary: boolean;
  method_type: string | null;
  recipient_doc_type: string | null;
  recipient_doc_number: string | null;
  recipient_name: string | null;
  payment_mode: string | null;
}

interface MotorizadoBankAccountFormProps {
  motorizadoId: string;
}

const COLOMBIAN_BANKS = [
  "Bancolombia",
  "Davivienda",
  "BBVA",
  "Banco de Bogotá",
  "Banco Popular",
  "Banco Caja Social",
  "Banco AV Villas",
  "Banco Falabella",
  "Banco GNB Sudameris",
  "Banco Pichincha",
  "Banco Itaú",
  "Banco Cooperativo Coopcentral",
  "Bancoldex",
  "Banco Mundo Mujer",
  "Banco Serfinanza",
  "Banco Agrario",
  "Banco Finandina",
  "Banco Procredit",
  "Banco W",
  "Bancamía",
  "Citibank",
  "Scotiabank Colpatria",
  "Confiar",
  "Lulo Bank",
  "Nu Bank",
  "Rappipay",
  "Nequi",
  "Daviplata",
];

const MotorizadoBankAccountForm = ({ motorizadoId }: MotorizadoBankAccountFormProps) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadMethods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_payment_methods")
      .select("*")
      .eq("user_id", motorizadoId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) {
      setMethods(data as PaymentMethod[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motorizadoId]);

  const handleSetPrimary = async (id: string) => {
    // Quitar primary de todos los demás
    await supabase
      .from("user_payment_methods")
      .update({ is_primary: false })
      .eq("user_id", motorizadoId);
    // Marcar este como primary
    const { error } = await supabase
      .from("user_payment_methods")
      .update({ is_primary: true })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo cambiar el método principal");
    } else {
      toast.success("Método principal actualizado");
      loadMethods();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este método de pago?")) return;
    const { error } = await supabase.from("user_payment_methods").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar");
    } else {
      toast.success("Método eliminado");
      loadMethods();
    }
  };

  const startAdd = () => {
    setEditing({
      id: "",
      user_id: motorizadoId,
      bank_name: null,
      account_type: "Ahorros",
      account_number: null,
      bre_b_key: null,
      key_type: null,
      is_primary: methods.length === 0,
      method_type: "BANK_ACCOUNT",
      recipient_doc_type: "CC",
      recipient_doc_number: null,
      recipient_name: null,
      payment_mode: "TRANSFER",
    });
    setShowForm(true);
  };

  const startEdit = (method: PaymentMethod) => {
    setEditing(method);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editing) return;

    // Validación
    if (editing.method_type === "BANK_ACCOUNT") {
      if (!editing.bank_name || !editing.account_number) {
        toast.error("Banco y número de cuenta son obligatorios");
        return;
      }
    } else if (editing.method_type === "BRE_B") {
      if (!editing.bre_b_key || !editing.key_type) {
        toast.error("Llave y tipo de llave son obligatorios");
        return;
      }
    }
    if (!editing.recipient_name || !editing.recipient_doc_number) {
      toast.error("Nombre y documento del titular son obligatorios");
      return;
    }

    const payload = {
      user_id: motorizadoId,
      bank_name: editing.bank_name,
      account_type: editing.account_type,
      account_number: editing.account_number,
      bre_b_key: editing.bre_b_key,
      key_type: editing.key_type,
      is_primary: editing.is_primary,
      method_type: editing.method_type,
      recipient_doc_type: editing.recipient_doc_type,
      recipient_doc_number: editing.recipient_doc_number,
      recipient_name: editing.recipient_name,
      payment_mode: editing.payment_mode,
    };

    let error;
    if (editing.id) {
      ({ error } = await supabase
        .from("user_payment_methods")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("user_payment_methods").insert(payload));
    }

    if (error) {
      console.error(error);
      toast.error("No se pudo guardar: " + error.message);
    } else {
      toast.success(editing.id ? "Método actualizado" : "Método agregado");
      // Si es primary, desmarcar los demás
      if (editing.is_primary && !editing.id) {
        // Después de insertar, marcar este como único primary
        await supabase
          .from("user_payment_methods")
          .update({ is_primary: false })
          .eq("user_id", motorizadoId)
          .neq("account_number", editing.account_number || "");
      }
      setShowForm(false);
      setEditing(null);
      loadMethods();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // FORMULARIO
  if (showForm && editing) {
    const isBank = editing.method_type === "BANK_ACCOUNT";
    return (
      <div className="space-y-3">
        {/* Tipo de método */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Tipo de método
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditing({ ...editing, method_type: "BANK_ACCOUNT" })}
              className={cn(
                "h-12 rounded-lg border flex items-center gap-2 px-3 transition-all",
                isBank
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <Building2 className="h-4 w-4" />
              <span className="text-xs font-semibold">Cuenta bancaria</span>
            </button>
            <button
              type="button"
              onClick={() => setEditing({ ...editing, method_type: "BRE_B" })}
              className={cn(
                "h-12 rounded-lg border flex items-center gap-2 px-3 transition-all",
                !isBank
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <Smartphone className="h-4 w-4" />
              <span className="text-xs font-semibold">Bre-B / Nequi</span>
            </button>
          </div>
        </div>

        {isBank ? (
          <>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Banco
              </label>
              <select
                value={editing.bank_name || ""}
                onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })}
                className="w-full h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecciona un banco</option>
                {COLOMBIAN_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Tipo
                </label>
                <select
                  value={editing.account_type || "Ahorros"}
                  onChange={(e) => setEditing({ ...editing, account_type: e.target.value })}
                  className="w-full h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Número
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editing.account_number || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, account_number: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="0123456789"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Tipo de llave
              </label>
              <select
                value={editing.key_type || ""}
                onChange={(e) => setEditing({ ...editing, key_type: e.target.value })}
                className="w-full h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecciona</option>
                <option value="CELULAR">Celular</option>
                <option value="EMAIL">Email</option>
                <option value="DOCUMENTO">Documento</option>
                <option value="ALFANUMERICA">Alfanumérica</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Llave / Identificador
              </label>
              <input
                type="text"
                value={editing.bre_b_key || ""}
                onChange={(e) => setEditing({ ...editing, bre_b_key: e.target.value })}
                placeholder="3001234567 o correo@ejemplo.com"
                className="w-full h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Titular de la cuenta
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={editing.recipient_name || ""}
              onChange={(e) => setEditing({ ...editing, recipient_name: e.target.value })}
              placeholder="Nombre completo del titular"
              className="w-full h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={editing.recipient_doc_type || "CC"}
                onChange={(e) => setEditing({ ...editing, recipient_doc_type: e.target.value })}
                className="h-11 px-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PA">PA</option>
                <option value="NIT">NIT</option>
              </select>
              <input
                type="text"
                inputMode="numeric"
                value={editing.recipient_doc_number || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    recipient_doc_number: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Número documento"
                className="col-span-2 h-11 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={editing.is_primary}
            onChange={(e) => setEditing({ ...editing, is_primary: e.target.checked })}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="text-xs text-foreground">Usar como método principal</span>
        </label>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => {
              setShowForm(false);
              setEditing(null);
            }}
            className="h-11 rounded-lg border border-border bg-card text-foreground text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            Guardar
          </button>
        </div>
      </div>
    );
  }

  // LISTA
  return (
    <div className="space-y-3">
      {methods.length === 0 ? (
        <div className="text-center py-8">
          <CreditCard className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Sin cuenta registrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Registra una cuenta para recibir tus pagos
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => {
            const isBank = m.method_type === "BANK_ACCOUNT";
            const lastFour = m.account_number?.slice(-4) || "";
            return (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl border p-3 relative",
                  m.is_primary
                    ? "bg-primary/5 border-primary/30"
                    : "bg-card border-border",
                )}
              >
                {m.is_primary && (
                  <div className="absolute top-2 right-2 bg-gold text-gold-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                    PRINCIPAL
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      isBank ? "bg-primary/10" : "bg-pink/10",
                    )}
                  >
                    {isBank ? (
                      <Building2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Smartphone className="h-5 w-5 text-pink" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {isBank ? m.bank_name : `Bre-B · ${m.key_type}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isBank
                        ? `${m.account_type} •••• ${lastFour}`
                        : m.bre_b_key}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <UserIcon className="h-2.5 w-2.5" />
                      {m.recipient_name} · {m.recipient_doc_type} {m.recipient_doc_number}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t border-border">
                  {!m.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(m.id)}
                      className="flex-1 h-8 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-md transition-colors"
                    >
                      Hacer principal
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(m)}
                    className="h-8 px-3 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 rounded-md transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="h-8 px-3 text-[11px] font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={startAdd}
        className="w-full h-11 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-primary text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
      >
        + Agregar método de pago
      </button>
    </div>
  );
};

export default MotorizadoBankAccountForm;
