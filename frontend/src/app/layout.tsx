import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CONTACT_EMAIL, OG_IMAGE, SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tulusy - Free Universal File Converter & 5GB Anonymous Drop",
    template: "%s | Tulusy",
  },
  description:
    "Free online converter for images, PDFs, documents, and spreadsheets, plus secure 5GB anonymous file sharing. Fast, privacy-first, zero tracking.",
  keywords: [
    "file converter",
    "image converter",
    "file share",
    "anonymous file upload",
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
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Tulusy",
    title: "Tulusy - Free Universal File Converter & 5GB Anonymous Drop",
    description:
      "Lightning-fast, privacy-first file conversion and anonymous 5GB file sharing. Convert images, PDFs, Word, PowerPoint, and Excel spreadsheets instantly.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tulusy - Universal File Converter & 5GB Drop",
    description: "Fast, privacy-friendly online converter for images, PDFs, documents, and anonymous 5GB file sharing.",
    images: [OG_IMAGE.url],
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
        url: SITE_URL,
        description:
          "Free online file converter for images, PDFs, documents, and spreadsheets, plus 5GB anonymous file sharing.",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Tulusy",
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(globalSchema) }}
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
      </body>
    </html>
  );
}
