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
      dynamic: 0,
      static: 180,
    },
  },
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
  ],
  rewrites: async () => [
    {
      source: "/favicon.ico",
      destination: "/favicon.png",
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
