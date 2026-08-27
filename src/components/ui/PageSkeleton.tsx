export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-36 rounded-full bg-luma-border/80" />
      <div className="mt-3 h-8 w-48 rounded-xl bg-luma-border/80" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="h-[4.75rem] rounded-2xl bg-luma-card ring-1 ring-luma-border/80"
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-40 rounded-full bg-luma-border/80" />
      <div className="mt-2 h-8 w-44 rounded-xl bg-luma-border/80" />
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[7.5rem] rounded-2xl bg-luma-card" />
        ))}
      </div>
      <div className="mt-6 h-5 w-52 rounded-full bg-luma-border/80" />
      <div className="mt-3 space-y-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[4.75rem] rounded-2xl bg-luma-card ring-1 ring-luma-border/80"
          />
        ))}
      </div>
    </div>
  );
}
