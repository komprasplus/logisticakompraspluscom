import { motion } from "framer-motion";
import { User, Bike, Phone, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MotorizadoInfoProps {
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  vehiclePlate?: string | null;
}

const MotorizadoInfo = ({
  name,
  phone,
  avatarUrl,
  vehiclePlate,
}: MotorizadoInfoProps) => {
  const getInitials = (fullName: string) => {
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const openWhatsApp = () => {
    if (!phone) return;
    const phoneNumber = phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      "Hola, tengo una consulta sobre mi pedido."
    );
    window.open(`https://wa.me/57${phoneNumber}?text=${message}`, "_blank");
  };

  const callDriver = () => {
    if (!phone) return;
    const phoneNumber = phone.replace(/\D/g, "");
    window.open(`tel:+57${phoneNumber}`, "_self");
  };

  return (
    <motion.div
      className="rounded-2xl bg-white p-4 shadow-sm border border-primary/10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-sm font-medium text-muted-foreground mb-3">
        🏍️ Tu motorizado
      </p>
      
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-md">
          <AvatarImage src={avatarUrl || undefined} alt={name} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground text-lg truncate">{name}</h4>
          {vehiclePlate && (
            <div className="flex items-center gap-1 mt-1">
              <Bike className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-mono">
                {vehiclePlate}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {phone && (
          <div className="flex gap-2">
            <button
              onClick={callDriver}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title="Llamar"
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              onClick={openWhatsApp}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
              title="WhatsApp"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MotorizadoInfo;
