import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Shell from "@/components/Shell";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SEO_KEYWORDS,
  ADSENSE_CLIENT,
} from "@/lib/site";

// Loaded here rather than through an @import in globals.css: the build strips
// remote @import rules, so remote faces silently fall back to system fonts.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MERN Stack Interview Prep Book — JavaScript, React, Node.js, Express & MongoDB",
    template: "%s · MERN Prep",
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  keywords: SEO_KEYWORDS,
  authors: [{ name: "Soumyaranjan" }],
  category: "education",
  robots: { index: true, follow: true },
  // Site verification for AdSense. Next renders this into <head> as
  // <meta name="google-adsense-account" content="...">.
  other: { "google-adsense-account": ADSENSE_CLIENT },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "MERN Stack Interview Prep Book",
    description: SITE_TAGLINE,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "MERN Stack Interview Prep Book",
    description: SITE_TAGLINE,
  },
};

// Runs synchronously in <head> before React hydrates → no flash of wrong theme
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <Shell>{children}</Shell>

        {/* AdSense loader. next/script rather than a raw tag so Next controls
            when it loads: afterInteractive keeps it off the critical path, so
            it cannot delay first paint or hurt Core Web Vitals. */}
        <Script
          id="adsbygoogle-init"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        />
      </body>
    </html>
  );
}
