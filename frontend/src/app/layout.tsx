import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import {
  CONTACT_EMAIL,
  safeJsonLd,
  SITE_ROOT_URL,
  SITE_URL,
} from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tulusy - Free Universal File Converter & 5GB Anonymous Drop",
    template: "%s | Tulusy",
  },
  description:
    "Free online converter for modern images, Camera RAW, PDFs, Office docs, e-books & data (40 formats), plus 5GB anonymous file sharing. Zero tracking.",
  keywords: [
    "file converter",
    "image converter",
    "file share",
    "anonymous file upload",
    "camera raw converter",
    "jxl to webp",
    "markdown to pdf",
    "epub converter",
    "json to yaml",
    "pdf to word",
    "png to webp",
    "heic to jpg",
    "excel to pdf",
    "pdf to docx",
    "free online converter",
    "pdf tools",
  ],
  authors: [{ name: "Tulusy" }],
  creator: "Tulusy",
  publisher: "Tulusy",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_ROOT_URL,
    siteName: "Tulusy",
    title: "Tulusy - Free Universal File Converter & 5GB Anonymous Drop",
    description:
      "Privacy-first 40-format converter (JXL, AVIF, WebP, Camera RAW, PDF, DOCX, EPUB, JSON, YAML) and anonymous 5GB file sharing.",
  },
  twitter: {
    card: "summary",
    title: "Tulusy - Universal File Converter & 5GB Drop",
    description: "Fast, privacy-first 40-format converter for images, Camera RAW, PDFs, docs & data, plus 5GB anonymous sharing.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const globalSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Tulusy",
        url: SITE_ROOT_URL,
        description:
          "Free online 40-format converter for modern images, Camera RAW, PDFs, documents, e-books, and structured data, plus 5GB anonymous file sharing.",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Tulusy",
        url: SITE_ROOT_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
        email: CONTACT_EMAIL,
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(globalSchema) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = saved || (prefersDark ? 'dark' : 'light');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        {children}
        <Script
          src="https://www.googletagmanager.com/gtm.js?id=GTM-PPZ74F2R"
          strategy="afterInteractive"
        />
        <Script id="gtm-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          `}
        </Script>
      </body>
    </html>
  );
}
