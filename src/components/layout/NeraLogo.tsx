import Image from "next/image";
import { cn } from "@/lib/cn";

const WORDMARK_WIDTH = 176;
const WORDMARK_HEIGHT = 56;

export function LumaLogo({
  className,
  height = 44,
}: {
  className?: string;
  height?: number;
}) {
  const width = Math.round((WORDMARK_WIDTH / WORDMARK_HEIGHT) * height);

  return (
    <Image
      src="/brand/luma-wordmark.png"
      alt="LUMA"
      width={width}
      height={height}
      priority
      sizes={`${width}px`}
      className={cn("select-none", className)}
    />
  );
}

export function LumaStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="20.8 2 78.4 78.4"
      className={cn("select-none", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="luma-star-arm" x1="12%" y1="88%" x2="88%" y2="12%">
          <stop offset="0%" stopColor="#3d3c9a" />
          <stop offset="48%" stopColor="#6f6edc" />
          <stop offset="100%" stopColor="#ece9ff" />
        </linearGradient>
      </defs>
      <path
        fill="url(#luma-star-arm)"
        d="M60 2c2.8 21.6 17.6 36.4 39.2 39.2C77.6 44 62.8 58.8 60 80.4 57.2 58.8 42.4 44 20.8 41.2 42.4 38.4 57.2 23.6 60 2Z"
      />
    </svg>
  );
}

export { LumaLogo as NeraLogo };
