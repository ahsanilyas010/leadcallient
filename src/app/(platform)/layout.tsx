import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// The owner console. A platform admin has no workspace/profiles row, so this
// route group deliberately doesn't go through (app)/layout.tsx's
// requireProfile(). /platform/login is public; everything under
// platform/(console) is gated by requireOwner() in that group's layout.
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
