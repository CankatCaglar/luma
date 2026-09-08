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
    purple: "text-luma",
    gold: "text-luma-kahve",
    green: "text-luma-green",
    red: "text-luma-red",
    blue: "text-sky-600",
  } as const;

  return (
    <span
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
