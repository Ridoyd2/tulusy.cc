import React, { cache } from 'react';
import { Metadata } from 'next';
import { FileDownloadClient } from './FileDownloadClient';
import { SITE_URL } from '@/lib/site';

interface PageProps {
  params: Promise<{ id: string }>;
}

const getFileInfo = cache(async (id: string) => {
  try {
    const apiUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8480').replace(/\/+$/, '');
    const resp = await fetch(`${apiUrl}/api/hosting/info/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.file || null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const file = await getFileInfo(id);

  if (!file) {
    return {
      title: 'File Unavailable',
      description: 'The requested file has expired or does not exist.',
      robots: { index: false, follow: false },
      openGraph: {
        title: 'File Unavailable | Tulusy',
        description: 'This shared file has expired or has been removed.',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: 'File Unavailable | Tulusy',
        description: 'This shared file has expired or has been removed.',
      },
    };
  }

  const pageTitle = `Download ${file.filename}`;
  const socialTitle = `${pageTitle} | Tulusy File Share`;
  const retentionNote = file.is_forever
    ? 'Hosted while active and auto-deleted after 7 days without views.'
    : 'Anonymous file hosting powered by Cloudflare R2 with automatic expiration.';
  const desc = `Download ${file.filename} (${(file.file_size / (1024 * 1024)).toFixed(2)} MB). ${retentionNote}`;

  return {
    title: pageTitle,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: {
      title: socialTitle,
      description: desc,
      type: 'website',
      locale: 'en_US',
      url: `${SITE_URL}/f/${encodeURIComponent(id)}`,
      siteName: 'Tulusy File Share',
    },
    twitter: {
      card: 'summary',
      title: socialTitle,
      description: desc,
    },
  };
}

export default async function DownloadPage({ params }: PageProps) {
  const { id } = await params;
  const file = await getFileInfo(id);

  return <FileDownloadClient initialFile={file} fileId={id} />;
}
