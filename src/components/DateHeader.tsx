import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";

interface DateHeaderProps {
  userName?: string;
}

const DateHeader = ({ userName }: DateHeaderProps) => {
  const today = new Date();
  const formattedDate = format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  
  // Capitalize first letter
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      {userName && (
        <h1 className="text-xl font-bold text-foreground mb-1">
          ¡Hola, {userName.split(" ")[0]}! 👋
        </h1>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="text-sm font-medium">{capitalizedDate}</span>
      </div>
    </motion.div>
  );
};

export default DateHeader;
