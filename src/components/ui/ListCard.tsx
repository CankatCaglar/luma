import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function ListCard({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  const classes = cn(
    "flex items-center gap-3 rounded-2xl bg-luma-card p-3.5 ring-1 ring-luma-border/80",
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          classes,
          "select-none transition-transform duration-150 ease-out active:scale-[0.97]",
        )}
      >
        {children}
      </a>
    );
  }

  return <div className={classes}>{children}</div>;
}
