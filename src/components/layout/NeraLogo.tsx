import Image from "next/image";
import { cn } from "@/lib/cn";

export function LumaLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/luma-wordmark.png"
      alt="LUMA"
      width={883}
      height={471}
      priority
      loading="eager"
      fetchPriority="high"
      sizes="96px"
      className={cn("h-11 w-auto select-none", className)}
    />
  );
}

export { LumaLogo as NeraLogo };
