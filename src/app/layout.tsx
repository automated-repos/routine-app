import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "روتيني - تتبع العادات",
  description: "تابع عاداتك اليومية والأسبوعية والشهرية، اجمع نجوم، وشارك في التحديات",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: { icon: `${basePath}/icon.svg`, apple: `${basePath}/apple-icon.png` },
  appleWebApp: { capable: true, title: "روتيني", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f7a5c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} antialiased`}>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
