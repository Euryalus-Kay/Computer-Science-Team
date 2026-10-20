import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";
import { themeScript, THEME_COOKIE } from "@/components/shell/theme";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { template: "%s · Lab CS", default: "Lab CS" },
  description: "Practice, tests and problems for the UCLS Math & Computer Science Team.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f12" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pref = (await cookies()).get(THEME_COOKIE)?.value;
  const explicit = pref === "dark" || pref === "light" ? pref : undefined;
  return (
    <html lang="en" data-theme={explicit ?? "light"} suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
