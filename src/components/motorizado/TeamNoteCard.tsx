import { Pin } from "lucide-react";

interface TeamNoteCardProps {
  text: string;
  authorName?: string | null;
  timeAgo?: string | null;
}

const TeamNoteCard = ({ text, authorName, timeAgo }: TeamNoteCardProps) => {
  return (
    <div className="rounded-xl border border-gold/35 bg-gold/[0.06] p-3 flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center flex-shrink-0">
        <Pin className="h-3.5 w-3.5 text-gold-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gold-dark">
            {authorName ? `Nota de ${authorName}` : "Nota del equipo"}
          </span>
          {timeAgo && (
            <span className="text-[10px] text-gold-dark/60">{timeAgo}</span>
          )}
        </div>
        <div className="text-[12px] text-foreground leading-snug">{text}</div>
      </div>
    </div>
  );
};

export default TeamNoteCard;
