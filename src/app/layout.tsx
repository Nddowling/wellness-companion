import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Nunito, Fraunces } from "next/font/google";
import "./globals.css";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/ui";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Rounded geometric face for the ClearBed wordmark / logo lockup.
const nunito = Nunito({
  variable: "--font-logo",
  weight: ["700", "800"],
  subsets: ["latin"],
});

// Warm high-contrast serif for display headlines (e.g. the /match hero).
const fraunces = Fraunces({
  variable: "--font-serif",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "health",
  // Google Search Console — renders <meta name="google-site-verification" ...>.
  // Lets you verify a URL-prefix property (https://clearbedrecovery.com) via the
  // HTML-tag method, no DNS needed.
  verification: { google: "rGxIUlkBRdVotDfVzVoWTtxKQnynTXhmXPi_aeqn91w" },
  formatDetection: { telephone: true, email: true, address: true },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    locale: "en_US",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

// Explicit so mobile rendering never depends on framework defaults. viewportFit
// 'cover' is what makes the env(safe-area-inset-*) usage in /match reliable on
// notched phones — the primary device for our seekers.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2a544f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Site-wide toast host — any client component can call useToast().toast(…) */}
        <ToastProvider>{children}</ToastProvider>
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
