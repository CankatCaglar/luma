import type { NextConfig } from "next";

function pickEnv(primary: string, legacy?: string) {
  if (process.env[primary]) return process.env[primary];
  if (legacy && process.env[legacy]) return process.env[legacy];
  return undefined;
}

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    staleTimes: {
      // Jobs live in JobsProvider; keep route shells cached so card taps
      // don't flash a skeleton on every navigation.
      dynamic: 60,
      static: 180,
    },
  },
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],
  headers: async () => [
    {
      source: "/favicon.png",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      ],
    },
    {
      source: "/favicon.ico",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      ],
    },
    {
      source: "/icons/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
  rewrites: async () => [
    {
      source: "/favicon.ico",
      destination: "/icons/nera-luma-32.png",
    },
  ],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    contentSecurityPolicy:
      "default-src 'self'; script-src 'none'; sandbox;",
  },
  env: {
    FIREBASE_API_KEY: pickEnv("FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"),
    FIREBASE_AUTH_DOMAIN: pickEnv(
      "FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    ),
    FIREBASE_PROJECT_ID: pickEnv(
      "FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    ),
    FIREBASE_STORAGE_BUCKET: pickEnv(
      "FIREBASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    ),
    FIREBASE_MESSAGING_SENDER_ID: pickEnv(
      "FIREBASE_MESSAGING_SENDER_ID",
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    ),
    FIREBASE_APP_ID: pickEnv("FIREBASE_APP_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"),
    FIREBASE_MEASUREMENT_ID: pickEnv(
      "FIREBASE_MEASUREMENT_ID",
      "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
    ),
  },
};

export default nextConfig;
