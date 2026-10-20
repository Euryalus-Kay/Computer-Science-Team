import { cn } from "@/lib/cn";

const PALETTE = [
  "bg-[#e8eefc] text-[#2a4fa8]",
  "bg-[#e4f2ea] text-[#16663f]",
  "bg-[#fbeee0] text-[#8a4b05]",
  "bg-[#f3e8f5] text-[#7a3488]",
  "bg-[#e6f1f4] text-[#1f6475]",
  "bg-[#f8e9e8] text-[#9a2f27]",
  "bg-[#eeeee6] text-[#5a5a2f]",
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none",
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
