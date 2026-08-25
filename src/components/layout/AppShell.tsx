import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#FBF9F5]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <Header />
        <main className="flex-1 px-4 pb-32 pt-2">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
