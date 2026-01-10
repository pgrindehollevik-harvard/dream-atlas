import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dream Atlas",
  description:
    "A living atlas of your dreams: log Midjourney renderings, track patterns, and let AI surface meanings over time."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-night-900">
      <body className="min-h-screen bg-gradient-to-b from-night-900 via-night-800 to-night-900 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}


