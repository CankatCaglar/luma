import { CheckCircle2 } from "lucide-react";
import type { JobStatus } from "@/types";

export function StatusBadge({
  status,
  label,
}: {
  status: JobStatus;
  label: string;
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-luma-green">
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit rounded-full bg-luma-soft px-2.5 py-0.5 text-[11px] font-semibold text-luma">
      {label}
    </span>
  );
}
