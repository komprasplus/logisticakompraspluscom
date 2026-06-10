import { Award, Crown, Gem, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLevelByScore, MotorizadoLevel } from "@/lib/motorizado-score";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const LEVEL_ICONS: Record<MotorizadoLevel, typeof Award> = {
  bronce: Medal,
  plata: Award,
  oro: Trophy,
  platino: Crown,
  diamante: Gem,
};

const SIZE_CLASSES = {
  sm: {
    wrapper: "h-7 px-2 gap-1",
    icon: "h-3 w-3",
    score: "text-[10px]",
    label: "text-[11px]",
  },
  md: {
    wrapper: "h-8 px-2.5 gap-1.5",
    icon: "h-3.5 w-3.5",
    score: "text-[11px]",
    label: "text-xs",
  },
  lg: {
    wrapper: "h-10 px-3 gap-2",
    icon: "h-4 w-4",
    score: "text-xs",
    label: "text-sm",
  },
};

const ScoreBadge = ({ score, size = "md", showLabel = true, className }: ScoreBadgeProps) => {
  const level = getLevelByScore(score);
  const Icon = LEVEL_ICONS[level.level];
  const sizes = SIZE_CLASSES[size];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-semibold shadow-sm",
        level.copColors.bg,
        level.copColors.text,
        level.copColors.border,
        sizes.wrapper,
        className,
      )}
      title={`Nivel ${level.label} · Score ${score}`}
    >
      <Icon className={cn(sizes.icon, "flex-shrink-0")} strokeWidth={2.25} />
      {showLabel && <span className={sizes.label}>{level.label}</span>}
      <span className={cn(sizes.score, "tabular-nums opacity-70 font-bold")}>
        {score}
      </span>
    </div>
  );
};

export default ScoreBadge;
