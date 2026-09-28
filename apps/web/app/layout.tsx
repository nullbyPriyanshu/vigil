import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuthProvider } from "@/context/auth-context";
import { GlobalLoader } from "@/components/global-loader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vigil",
  description: "on-call incident management platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // next-themes sets the real class before React hydrates (a blocking
      // inline script, so there's no flash of the wrong theme) — that
      // intentionally makes the server-rendered class attribute not match
      // the client's on first paint, which suppressHydrationWarning exists
      // for exactly this case.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Providers>
            <GlobalLoader />
            <AuthProvider>{children}</AuthProvider>
          </Providers>
          {/* Forced dark regardless of the site theme: toasts also appear on
              the always-dark auth/landing pages, so they stay one look
              everywhere rather than following the app-shell's toggle. */}
          <div className="dark">
            <Toaster position="top-center" />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
