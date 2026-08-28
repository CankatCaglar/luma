"use client";

import { useParams } from "next/navigation";
import { JobDetail } from "@/components/jobs/JobDetail";
import { useJobs } from "@/components/jobs/JobsProvider";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, status } = useJobs();

  if (status === "loading" || !data) return <PageSkeleton cards={3} />;
  const job = data.jobs.find((item) => item.id === id);
  if (!job) return <PageSkeleton cards={2} />;

  return <JobDetail job={job} />;
}
