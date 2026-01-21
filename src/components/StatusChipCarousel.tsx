import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getStatusConfig, ALL_STATUSES } from "@/lib/orderStatuses";
import { cn } from "@/lib/utils";

interface StatusCount {
  status: string | null;
  count: number;
}

interface StatusChipCarouselProps {
  statusCounts: StatusCount[];
  selectedStatus: string | null;
  onStatusSelect: (status: string | null) => void;
  totalCount?: number;
}

const StatusChipCarousel = ({
  statusCounts,
  selectedStatus,
  onStatusSelect,
  totalCount = 0,
}: StatusChipCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollPosition = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 150;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScrollPosition, 300);
    }
  };

  const allStatus = { status: null, count: totalCount, label: "Todos", icon: "📋" };

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity md:hidden"
          style={{ opacity: 1 }}
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        onScroll={checkScrollPosition}
        className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* All Status Chip */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onStatusSelect(null)}
          className={cn(
            "flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm",
            selectedStatus === null
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
              : "bg-card border border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-base">{allStatus.icon}</span>
          <span>Todos</span>
          <span className={cn(
            "min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold",
            selectedStatus === null
              ? "bg-white/20 text-primary-foreground"
              : "bg-muted text-foreground"
          )}>
            {totalCount}
          </span>
        </motion.button>

        {/* Status Chips */}
        {statusCounts.map(({ status, count }) => {
          if (!status || count === 0) return null;
          const config = getStatusConfig(status);
          const isSelected = selectedStatus?.toLowerCase() === status.toLowerCase();

          return (
            <motion.button
              key={status}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStatusSelect(status)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 shadow-sm",
                isSelected
                  ? `${config.bgColor} text-white shadow-md`
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              )}
              style={isSelected ? { boxShadow: `0 4px 14px -2px ${config.color}40` } : {}}
            >
              <span className="text-base">{config.icon}</span>
              <span className="whitespace-nowrap">{config.label}</span>
              <span className={cn(
                "min-w-[24px] h-6 flex items-center justify-center rounded-full text-xs font-bold",
                isSelected
                  ? "bg-white/20 text-white"
                  : "bg-muted text-foreground"
              )}>
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 flex items-center justify-center bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity md:hidden"
          style={{ opacity: 1 }}
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      )}

      {/* Gradient fade indicators */}
      {showLeftArrow && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none md:hidden" />
      )}
      {showRightArrow && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
      )}
    </div>
  );
};

export default StatusChipCarousel;
