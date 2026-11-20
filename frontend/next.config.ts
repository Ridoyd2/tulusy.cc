import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8480";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      { source: "/convert/pdf-to-word", destination: "/convert/pdf-to-docx", permanent: true },
      { source: "/convert/word-to-pdf", destination: "/convert/docx-to-pdf", permanent: true },
      { source: "/convert/xlsx-to-pdf", destination: "/convert/excel-to-pdf", permanent: true },
      { source: "/convert/pdf-to-xlsx", destination: "/convert/pdf-to-excel", permanent: true },
      { source: "/convert/csv-to-xlsx", destination: "/convert/csv-to-excel", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/f/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Content-Type", value: "application/xml; charset=utf-8" },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
          { key: "X-Robots-Tag", value: "noindex, follow" },
        ],
      },
      {
        source: "/sitemaps/:path*",
        headers: [
          { key: "Content-Type", value: "application/xml; charset=utf-8" },
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
          },
          { key: "X-Robots-Tag", value: "noindex, follow" },
        ],
      },
      {
        source: "/sitemap.xsl",
        headers: [
          { key: "Content-Type", value: "application/xslt+xml; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
