import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function IconTile({
  children,
  className,
  tone = "purple",
}: {
  children: ReactNode;
  className?: string;
  tone?: "purple" | "gold" | "green" | "red" | "blue";
}) {
  const tones = {
    purple: "bg-luma-soft text-luma",
    gold: "bg-luma-gold-soft text-luma-kahve",
    green: "bg-luma-green-soft text-luma-green",
    red: "bg-red-50 text-luma-red",
    blue: "bg-sky-50 text-sky-600",
  } as const;

  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
