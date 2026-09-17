import type { NotificationCategory } from "@/types";
import type {
  DeliveryEventType,
  MailSettings,
  MailTemplate,
} from "@/lib/delivery/types";

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export const EVENT_LABELS: Record<DeliveryEventType, string> = {
  plan_ready: "İçerik planı hazır",
  report_ready: "Rapor hazır",
  work_ready: "Çalışma hazır",
  approval_requested: "Onay bekliyor",
  revision_done: "Revize tamamlandı",
};

const DEFAULT_TEMPLATES: Record<DeliveryEventType, MailTemplate> = {
  plan_ready: {
    subject: "{month} İçerik Planınız hazırdır",
    body: "Merhaba,\n\n{month} içerik planınız hazırdır. Aşağıdaki bağlantıdan inceleyebilirsiniz:\n\n{link}\n\nİyi çalışmalar,\nLuma by Nera",
    autoEmail: true,
    autoInApp: true,
  },
  report_ready: {
    subject: "{month} Raporunuz hazırdır",
    body: "Merhaba,\n\n{month} raporunuz hazırdır. Aşağıdaki bağlantıdan inceleyebilirsiniz:\n\n{link}\n\nİyi çalışmalar,\nLuma by Nera",
    autoEmail: true,
    autoInApp: true,
  },
  work_ready: {
    subject: "{title} çalışmanız hazırdır",
    body: "Merhaba,\n\n{title} çalışmanız hazırdır. Aşağıdaki bağlantıdan inceleyebilirsiniz:\n\n{link}\n\nİyi çalışmalar,\nLuma by Nera",
    autoEmail: true,
    autoInApp: true,
  },
  approval_requested: {
    subject: "Onayınızı bekleyen bir çalışmanız var: {title}",
    body: "Merhaba,\n\n{title} çalışması onayınızı bekliyor. İncelemek için aşağıdaki bağlantıyı kullanabilir veya Luma içindeki onay ekranına gidebilirsiniz.\n\n{link}\n\nİyi çalışmalar,\nLuma by Nera",
    autoEmail: true,
    autoInApp: true,
  },
  revision_done: {
    subject: "Revizeniz tamamlandı: {title}",
    body: "Merhaba,\n\n{title} çalışmasının revizesi tamamlandı. Aşağıdaki bağlantıdan inceleyebilirsiniz:\n\n{link}\n\nİyi çalışmalar,\nLuma by Nera",
    autoEmail: true,
    autoInApp: true,
  },
};

export function defaultMailSettings(): MailSettings {
  return {
    templates: {
      plan_ready: { ...DEFAULT_TEMPLATES.plan_ready },
      report_ready: { ...DEFAULT_TEMPLATES.report_ready },
      work_ready: { ...DEFAULT_TEMPLATES.work_ready },
      approval_requested: { ...DEFAULT_TEMPLATES.approval_requested },
      revision_done: { ...DEFAULT_TEMPLATES.revision_done },
    },
  };
}

export function formatMonthPhrase(monthKey: string | undefined): string {
  if (!monthKey) return "Bu ay";
  const month = Number(monthKey.slice(5, 7));
  const name = TR_MONTHS[month - 1];
  return name ? `${name} Ayı` : monthKey;
}

export function fillTemplate(
  template: string,
  vars: { title: string; link: string; month: string },
): string {
  return template
    .replaceAll("{title}", vars.title)
    .replaceAll("{link}", vars.link)
    .replaceAll("{month}", vars.month);
}

export function eventCategory(eventType: DeliveryEventType): NotificationCategory {
  if (eventType === "plan_ready") return "plan";
  if (eventType === "report_ready") return "report";
  if (eventType === "approval_requested") return "approval";
  if (eventType === "revision_done") return "revision";
  return "status";
}

export function notificationCopy(
  eventType: DeliveryEventType,
  title: string,
): { title: string; body: string } {
  if (eventType === "plan_ready") {
    return {
      title: "İçerik planınız hazır",
      body: title,
    };
  }
  if (eventType === "report_ready") {
    return {
      title: "Raporunuz hazır",
      body: title,
    };
  }
  if (eventType === "approval_requested") {
    return {
      title: "Onayınızı bekliyor",
      body: title,
    };
  }
  if (eventType === "revision_done") {
    return {
      title: "Revizeniz tamamlandı",
      body: title,
    };
  }
  return {
    title: "Yeni çalışmanız hazır",
    body: title,
  };
}

export function notificationHref(
  eventType: DeliveryEventType,
  taskHref: string,
): string {
  if (eventType === "approval_requested") return "/isler/onay";
  return taskHref || "/";
}
