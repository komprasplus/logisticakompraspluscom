import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const PedidoCardSkeleton = ({ index }: { index: number }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: index * 0.05 }}
    className="neu-flat overflow-hidden"
  >
    {/* Card Header */}
    <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-muted/30">
      <Skeleton className="h-5 w-24 neu-pressed" />
      <Skeleton className="h-6 w-20 rounded-full neu-pressed" />
    </div>

    {/* Card Body */}
    <div className="p-4 space-y-3">
      {/* Recipient */}
      <div>
        <Skeleton className="h-5 w-40 mb-2 neu-pressed" />
        <div className="flex items-start gap-1.5">
          <Skeleton className="h-4 w-4 rounded-full neu-pressed" />
          <Skeleton className="h-4 w-48 neu-pressed" />
        </div>
      </div>

      {/* Info Row */}
      <div className="flex items-center gap-4 py-2 px-3 rounded-xl neu-pressed">
        <div className="flex-1 flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Product */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full neu-pressed" />
        <Skeleton className="h-4 w-32 neu-pressed" />
      </div>

      {/* Values Row */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16 neu-pressed" />
          <Skeleton className="h-5 w-24 neu-pressed" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-12 neu-pressed" />
          <Skeleton className="h-5 w-20 neu-pressed" />
        </div>
      </div>
    </div>

    {/* Card Footer */}
    <div className="px-4 py-3 border-t border-border/50 flex gap-2">
      <Skeleton className="h-9 flex-1 rounded-lg neu-pressed" />
      <Skeleton className="h-9 w-9 rounded-lg neu-pressed" />
    </div>
  </motion.div>
);

const PedidosSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <PedidoCardSkeleton key={i} index={i} />
    ))}
  </div>
);

export default PedidosSkeleton;
