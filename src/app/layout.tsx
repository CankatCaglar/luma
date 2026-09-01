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

export const metadata: Metadata = {
  title: {
    default: "LUMA",
    template: "%s · LUMA",
  },
  description: "LUMA müşteri portalı",
  applicationName: "LUMA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LUMA",
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#FBF9F5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${montserrat.variable} antialiased`}>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
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
