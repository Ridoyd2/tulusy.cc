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
