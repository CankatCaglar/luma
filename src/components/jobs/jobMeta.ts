import {
  BarChart3,
  Calendar,
  Camera,
  FileText,
  Megaphone,
  MessageCircle,
  Monitor,
  Pencil,
  Play,
  type LucideIcon,
} from "lucide-react";
import type { JobKind, JobStatus } from "@/types";
import type { MessageKey } from "@/i18n";

export const jobIcons: Record<JobKind, LucideIcon> = {
  plan: Calendar,
  website: Monitor,
  video: Play,
  ads: Megaphone,
  blog: Pencil,
  report: BarChart3,
  photo: Camera,
  content: MessageCircle,
  design: FileText,
};

export const jobKindKeys: Record<JobKind, MessageKey> = {
  plan: "jobs.kinds.plan",
  website: "jobs.kinds.website",
  video: "jobs.kinds.video",
  ads: "jobs.kinds.ads",
  blog: "jobs.kinds.blog",
  report: "jobs.kinds.report",
  photo: "jobs.kinds.photo",
  content: "jobs.kinds.content",
  design: "jobs.kinds.design",
};

export const statusKeys: Record<JobStatus, MessageKey> = {
  pending_approval: "status.pending_approval",
  review: "status.review",
  revision: "status.revision",
  in_progress: "status.in_progress",
  completed: "status.completed",
};
