export type JobStatus =
  | "pending_approval"
  | "review"
  | "revision"
  | "in_progress"
  | "completed";

export type JobKind =
  | "plan"
  | "website"
  | "video"
  | "ads"
  | "blog"
  | "report"
  | "photo"
  | "content"
  | "design";

export type ApprovalKind = "video" | "plan";

export type BrandAssetKind = "logo" | "brief";

export type NotificationCategory =
  | "plan"
  | "report"
  | "approval"
  | "revision"
  | "request"
  | "status";

export type PeriodMonths = 1 | 3 | 6 | 12;

export type JobSource = "asana" | "mock";

export type DashboardMetrics = {
  pendingApproval: number;
  activeJobs: number;
  completedThisMonth: number;
};

export type Brand = {
  id: string;
  name: string;
};

export type UserProfile = {
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
};

export type JobTag = {
  id: string;
  name: string;
  color?: string;
};

export type ApprovalItem = {
  id: string;
  title: string;
  kind: JobKind;
  status: Extract<JobStatus, "pending_approval" | "review">;
  dueDate: string;
  href: string;
  tags?: JobTag[];
};

export type Job = {
  id: string;
  title: string;
  status: JobStatus;
  kind: JobKind;
  dueDate: string;
  completedAt?: string;
  href: string;
  resourceUrl?: string;
  tags?: JobTag[];
};

export type ContentPlan = {
  id: string;
  month: string;
  title: string;
  slidesUrl?: string;
  status: JobStatus;
  isCurrent?: boolean;
};

export type MonthlyReport = {
  id: string;
  month: string;
  title: string;
  driveUrl: string;
  isNew?: boolean;
};

export type JobLists = {
  source: JobSource;
  jobs: Job[];
  activeJobs: Job[];
  pendingJobs: Job[];
  completedJobs: Job[];
  approvalItems: ApprovalItem[];
  metrics: DashboardMetrics;
  contentPlans: ContentPlan[];
  monthlyReports: MonthlyReport[];
  referenceNowIso: string;
};

export type BrandAsset = {
  id: string;
  nameKey: "brandCenter.logo" | "brandCenter.brief";
  descriptionKey: "brandCenter.logoFormats" | "brandCenter.briefDescription";
  kind: BrandAssetKind;
  url: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
  category: NotificationCategory;
};

export type QuickLinkId = "request" | "plans" | "reports" | "brand";

export type QuickLink = {
  id: QuickLinkId;
  href: string;
};

export type RequestType = "video" | "design" | "content" | "ads" | "other";
export type RequestPriority = "standard" | "urgent";
