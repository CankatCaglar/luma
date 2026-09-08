import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppShell } from "@/components/layout/AppShell";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext"],
});

// İkon dosya adları sabit kaldığı için tarayıcılar eski ikonu önbellekte tutabiliyor.
// İkonlar her değiştiğinde bu sürümü artır.
const ICON_VERSION = "3";

export const metadata: Metadata = {
  title: {
    default: "Nera Luma",
    template: "%s · Nera Luma",
  },
  description: "Nera Luma müşteri portalı",
  applicationName: "Nera Luma",
  manifest: `/manifest.json?v=${ICON_VERSION}`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nera Luma",
  },
  icons: {
    icon: [
      {
        url: `/icons/nera-luma-180.png?v=${ICON_VERSION}`,
        sizes: "180x180",
        type: "image/png",
      },
      {
        url: `/icons/nera-luma-512.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: `/icons/nera-luma-180.png?v=${ICON_VERSION}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Nera Luma",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF9F5" },
    { media: "(prefers-color-scheme: dark)", color: "#FBF9F5" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${montserrat.variable} antialiased bg-[#FBF9F5]`}>
      <head>
        <link
          rel="preload"
          as="image"
          href="/brand/luma-wordmark.png"
          fetchPriority="high"
        />
      </head>
      <body className="font-sans">
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
