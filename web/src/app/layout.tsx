import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { ReauthModal } from "@/features/auth/reauth-modal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProLance",
  description: "Freelancer marketplace frontend",
};

// Root layout hosts fonts, the silent re-auth modal, and global providers.
// Theme is handled via CSS (prefers-color-scheme) for the initial paint,
// then ThemeProvider's useEffect applies the user's stored preference.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <ReauthModal />
          {children}
        </Providers>
      </body>
    </html>
  );
}
