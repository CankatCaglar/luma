import type {
  ApprovalItem,
  Brand,
  BrandAsset,
  ContentPlan,
  DashboardMetrics,
  Job,
  MonthlyReport,
  NotificationItem,
  QuickLink,
  TenantSummary,
  UserProfile,
} from "@/types";
import { isWithinLastMonths } from "@/lib/period";

export const currentBrand: Brand = {
  id: "swatchloop",
  name: "Swatchloop",
};

export const currentUser: UserProfile = {
  name: "Can Ata",
  email: "can@swatchloop.com",
  phone: "+90 532 000 00 00",
  avatarUrl: "/images/avatar.svg",
};

export const mockTenant: TenantSummary = {
  tenantId: currentBrand.id,
  brandName: currentBrand.name,
  brandCode: "SWH101",
  email: currentUser.email,
};

export const jobs: Job[] = [
  {
    id: "job-website",
    title: "Web Site Güncellemesi",
    status: "in_progress",
    kind: "website",
    dueDate: "2026-08-28",
    href: "/isler/aktif",
  },
  {
    id: "job-ads",
    title: "Google Ads Kampanyası",
    status: "in_progress",
    kind: "ads",
    dueDate: "2026-08-27",
    href: "/isler/aktif",
  },
  {
    id: "job-blog",
    title: "Blog Yazısı",
    status: "in_progress",
    kind: "blog",
    dueDate: "2026-08-23",
    href: "/isler/aktif",
  },
  {
    id: "job-plan-sep",
    title: "Eylül İçerik Planı",
    status: "in_progress",
    kind: "plan",
    dueDate: "2026-08-21",
    href: "/planlar/plan-2026-09",
  },
  {
    id: "job-video-revision",
    title: "30 Ağustos Videosu",
    status: "revision",
    kind: "video",
    dueDate: "2026-08-25",
    href: "/isler/aktif",
  },
  {
    id: "job-video-approval",
    title: "30 Ağustos Videosu",
    status: "pending_approval",
    kind: "video",
    dueDate: "2026-08-25",
    href: "/isler/onay",
  },
  {
    id: "job-plan-review",
    title: "Eylül İçerik Planı",
    status: "review",
    kind: "plan",
    dueDate: "2026-08-20",
    href: "/planlar/plan-2026-09",
  },
  {
    id: "job-done-aug-plan",
    title: "Ağustos İçerik Planı",
    status: "completed",
    kind: "plan",
    dueDate: "2026-08-20",
    completedAt: "2026-08-20",
    href: "/planlar/plan-2026-08",
  },
  {
    id: "job-done-aug-report",
    title: "Ağustos Performans Raporu",
    status: "completed",
    kind: "report",
    dueDate: "2026-08-18",
    completedAt: "2026-08-18",
    href: "/raporlar/report-2026-08",
  },
  {
    id: "job-done-aug-cover",
    title: "Ağustos rapor kapağı",
    status: "completed",
    kind: "design",
    dueDate: "2026-08-15",
    completedAt: "2026-08-15",
    href: "/raporlar/report-2026-08",
  },
  {
    id: "job-done-aug-photo",
    title: "Ürün çekimi",
    status: "completed",
    kind: "photo",
    dueDate: "2026-08-12",
    completedAt: "2026-08-12",
    href: "/isler/tamamlanan",
  },
  {
    id: "job-done-aug-content",
    title: "Ağustos içerik üretimi",
    status: "completed",
    kind: "content",
    dueDate: "2026-08-10",
    completedAt: "2026-08-10",
    href: "/isler/tamamlanan",
  },
  {
    id: "job-done-jul-plan",
    title: "Temmuz İçerik Planı",
    status: "completed",
    kind: "plan",
    dueDate: "2026-07-20",
    completedAt: "2026-07-20",
    href: "/planlar/plan-2026-07",
  },
  {
    id: "job-done-jul-campaign",
    title: "Temmuz kampanya kapanışı",
    status: "completed",
    kind: "ads",
    dueDate: "2026-07-31",
    completedAt: "2026-07-31",
    href: "/isler/tamamlanan",
  },
  {
    id: "job-done-jun-report",
    title: "Haziran Performans Raporu",
    status: "completed",
    kind: "report",
    dueDate: "2026-06-30",
    completedAt: "2026-06-28",
    href: "/raporlar/report-2026-06",
  },
  {
    id: "job-done-apr-site",
    title: "Nisan site revizyonu",
    status: "completed",
    kind: "website",
    dueDate: "2026-04-18",
    completedAt: "2026-04-18",
    href: "/isler/tamamlanan",
  },
  {
    id: "job-done-nov-brand",
    title: "Kasım marka filmsi",
    status: "completed",
    kind: "video",
    dueDate: "2025-11-12",
    completedAt: "2025-11-12",
    href: "/isler/tamamlanan",
  },
];

export const approvalItems: ApprovalItem[] = [
  {
    id: "approval-video-aug-30",
    title: "30 Ağustos Videosu",
    kind: "video",
    status: "pending_approval",
    dueDate: "2026-08-25",
    href: "/isler/onay",
  },
  {
    id: "approval-plan-sep",
    title: "Eylül İçerik Planı",
    kind: "plan",
    status: "review",
    dueDate: "2026-08-20",
    href: "/planlar/plan-2026-09",
  },
];

const now = new Date("2026-08-25T12:00:00");

export const dashboardMetrics: DashboardMetrics = {
  pendingApproval: jobs.filter(
    (job) => job.status === "pending_approval" || job.status === "review",
  ).length,
  activeJobs: jobs.filter(
    (job) => job.status === "in_progress" || job.status === "revision",
  ).length,
  completedThisMonth: jobs.filter(
    (job) =>
      job.status === "completed" &&
      job.completedAt &&
      isWithinLastMonths(job.completedAt, 1, now),
  ).length,
};

export const contentPlans: ContentPlan[] = [
  {
    id: "plan-2026-09",
    month: "2026-09",
    title: "Eylül İçerik Planı",
    slidesUrl: "https://docs.google.com/presentation/d/example-sep",
    dueDate: "2026-08-28",
    status: "review",
    isCurrent: true,
  },
  {
    id: "plan-2026-08",
    month: "2026-08",
    title: "Ağustos İçerik Planı",
    slidesUrl: "https://docs.google.com/presentation/d/example-aug",
    dueDate: "2026-08-20",
    status: "completed",
  },
  {
    id: "plan-2026-07",
    month: "2026-07",
    title: "Temmuz İçerik Planı",
    slidesUrl: "https://docs.google.com/presentation/d/example-jul",
    dueDate: "2026-07-20",
    status: "completed",
  },
];

export const monthlyReports: MonthlyReport[] = [
  {
    id: "report-2026-08",
    month: "2026-08",
    title: "Ağustos Performans Raporu",
    driveUrl: "https://drive.google.com/drive/folders/example-aug",
    updatedAt: "2026-08-28",
    isNew: true,
  },
  {
    id: "report-2026-07",
    month: "2026-07",
    title: "Temmuz Performans Raporu",
    driveUrl: "https://drive.google.com/drive/folders/example-jul",
    updatedAt: "2026-07-31",
  },
  {
    id: "report-2026-06",
    month: "2026-06",
    title: "Haziran Performans Raporu",
    driveUrl: "https://drive.google.com/drive/folders/example-jun",
    updatedAt: "2026-06-30",
  },
];

export const brandAssets: BrandAsset[] = [
  {
    id: "asset-box",
    nameKey: "brandCenter.box",
    descriptionKey: "brandCenter.boxDescription",
    kind: "box",
    url: "https://drive.google.com/drive/folders/example-box",
  },
  {
    id: "asset-logo",
    nameKey: "brandCenter.logo",
    descriptionKey: "brandCenter.logoDescription",
    kind: "logo",
    url: "https://drive.google.com/drive/folders/example-logo",
    files: [
      {
        id: "logo-png",
        name: "Logo.png",
        mimeType: "image/png",
        size: "2400000",
        width: 1600,
        height: 1600,
        viewUrl: "https://drive.google.com/file/d/example-logo-png/view",
        downloadUrl: "https://drive.google.com/uc?export=download&id=example-logo-png",
      },
      {
        id: "logo-svg",
        name: "Logo.svg",
        mimeType: "image/svg+xml",
        size: "48000",
        viewUrl: "https://drive.google.com/file/d/example-logo-svg/view",
        downloadUrl: "https://drive.google.com/uc?export=download&id=example-logo-svg",
      },
      {
        id: "logo-pdf",
        name: "Logo.pdf",
        mimeType: "application/pdf",
        size: "1200000",
        viewUrl: "https://drive.google.com/file/d/example-logo-pdf/view",
        downloadUrl: "https://drive.google.com/uc?export=download&id=example-logo-pdf",
      },
    ],
  },
  {
    id: "asset-brief",
    nameKey: "brandCenter.brief",
    descriptionKey: "brandCenter.briefDescription",
    kind: "brief",
    url: "https://drive.google.com/file/d/example-brief/view",
    files: [
      {
        id: "brief-pdf",
        name: "Brand Brief.pdf",
        mimeType: "application/pdf",
        size: "1800000",
        modifiedTime: "2026-08-28T10:00:00.000Z",
        viewUrl: "https://drive.google.com/file/d/example-brief/view",
      },
    ],
  },
  {
    id: "asset-competitor",
    nameKey: "brandCenter.competitor",
    descriptionKey: "brandCenter.competitorDescription",
    kind: "competitor",
    url: "https://drive.google.com/drive/folders/example-competitor",
  },
];

export const notifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Eylül içerik planınız hazır.",
    body: "Aylık planı inceleyip onaylayabilirsiniz.",
    href: "/planlar/plan-2026-09",
    read: false,
    createdAt: "2026-08-25T08:45:00",
    category: "plan",
  },
  {
    id: "notif-2",
    title: "Ağustos raporu yüklendi.",
    body: "Sosyal medya raporunu görüntüleyebilirsiniz.",
    href: "/raporlar",
    read: false,
    createdAt: "2026-08-24T14:20:00",
    category: "report",
  },
  {
    id: "notif-3",
    title: "Video onayınızı bekliyor.",
    body: "30 Ağustos Videosu incelemenizi bekliyor.",
    href: "/isler/onay",
    read: false,
    createdAt: "2026-08-24T09:00:00",
    category: "approval",
  },
  {
    id: "notif-4",
    title: "Revize notu eklendi.",
    body: "Blog yazısı için yeni bir revize talebi var.",
    href: "/isler/aktif",
    read: true,
    createdAt: "2026-08-23T16:10:00",
    category: "revision",
  },
  {
    id: "notif-5",
    title: "Talebiniz alındı.",
    body: "Yeni talebiniz kuyruğa eklendi.",
    href: "/talep",
    read: true,
    createdAt: "2026-08-22T11:30:00",
    category: "request",
  },
  {
    id: "notif-6",
    title: "İş teslim edildi.",
    body: "Ağustos İçerik Planı tamamlandı olarak işaretlendi.",
    href: "/isler/tamamlanan",
    read: true,
    createdAt: "2026-08-20T18:05:00",
    category: "status",
  },
];

export const quickLinks: QuickLink[] = [
  { id: "request", href: "/talep" },
  { id: "plans", href: "/planlar" },
  { id: "reports", href: "/raporlar" },
  { id: "brand", href: "/marka" },
];

export const unreadNotificationCount = notifications.filter(
  (item) => !item.read,
).length;

export const activeJobs = jobs.filter(
  (job) => job.status === "in_progress" || job.status === "revision",
);

export const pendingJobs = jobs.filter(
  (job) => job.status === "pending_approval" || job.status === "review",
);

export const completedJobs = jobs
  .filter((job) => job.status === "completed" && job.completedAt)
  .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
