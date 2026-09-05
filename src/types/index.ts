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

export type BrandAssetKind = "box" | "logo" | "brief" | "competitor";

export type BrandFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  width?: number;
  height?: number;
  modifiedTime?: string;
  viewUrl: string;
  downloadUrl?: string;
};

export type NotificationCategory =
  | "plan"
  | "report"
  | "approval"
  | "revision"
  | "request"
  | "status";

export type PeriodMonths = 1 | 3 | 6 | 12;

export type JobSource = "asana" | "mock";

export type TenantSummary = {
  tenantId: string;
  brandName: string;
  brandCode: string;
  email: string;
};

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

export type PlanYear = {
  year: string;
  title?: string;
  url?: string;
};

export type ContentPlan = {
  id: string;
  month: string;
  title: string;
  slidesUrl?: string;
  dueDate?: string;
  status: JobStatus;
  isCurrent?: boolean;
};

export type MonthlyReport = {
  id: string;
  month: string;
  title: string;
  driveUrl: string;
  updatedAt?: string;
  isNew?: boolean;
};

export type JobLists = {
  tenant: TenantSummary;
  source: JobSource;
  jobs: Job[];
  activeJobs: Job[];
  pendingJobs: Job[];
  completedJobs: Job[];
  approvalItems: ApprovalItem[];
  metrics: DashboardMetrics;
  contentPlans: ContentPlan[];
  monthlyReports: MonthlyReport[];
  brandAssets?: BrandAsset[];
  driveBoxUrl?: string;
  plansFolderUrl?: string;
  plansFolderTitle?: string;
  planYears?: PlanYear[];
  referenceNowIso: string;
  partial?: boolean;
};

export type BrandAsset = {
  id: string;
  nameKey:
    | "brandCenter.box"
    | "brandCenter.logo"
    | "brandCenter.brief"
    | "brandCenter.competitor";
  descriptionKey:
    | "brandCenter.boxDescription"
    | "brandCenter.logoFormats"
    | "brandCenter.logoDescription"
    | "brandCenter.briefDescription"
    | "brandCenter.competitorDescription";
  kind: BrandAssetKind;
  url: string;
  files?: BrandFile[];
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

export type RequestPriority = "standard" | "urgent";
export type {
  AsanaPriorityLevel,
  RequestCategory,
  RequestSubtype,
} from "@/lib/requests/catalog";
