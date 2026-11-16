import Link from 'next/link';
import { LegalPageShell } from '@/components/LegalPageShell';
import { CONTACT_EMAIL, SITE_DOMAIN } from '@/lib/site';
import { buildSeoMetadata } from '@/lib/toolsConfig';

export const metadata = buildSeoMetadata({
  title: 'Terms of Service - Acceptable Use & DMCA',
  description: `Review acceptable use policies, ephemeral 5GB file-sharing expiration terms, and fast DMCA abuse takedowns on ${SITE_DOMAIN}.`,
  path: '/terms',
  card: 'summary',
});

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      subtitle={`Effective date: November 16, 2026 · Governing use of ${SITE_DOMAIN}`}
      path="/terms"
      breadcrumbName="Terms of Service"
    >
      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          1. Acceptable Use
        </h2>
        <p>
          By using {SITE_DOMAIN}, you agree not to upload malware, illegal material, unauthorized copyrighted works, or private data you lack permission to process. Automated scraping, denial-of-service traffic, or using the HTTP Benchmark against systems without authorization is strictly prohibited.
        </p>
      </section>

      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          2. Ephemeral Availability Disclaimer
        </h2>
        <p>
          Files converted or hosted through Tulusy are ephemeral by design and expire automatically according to the configured window. Always retain your own local backup copy — Tulusy is provided &ldquo;as is&rdquo; without warranties regarding uninterrupted availability or recovery after expiration.
        </p>
      </section>

      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          3. Abuse &amp; DMCA Takedowns
        </h2>
        <p>
          We act promptly on verified abuse and copyright notifications. Any hosted file download page includes an immediate &ldquo;Report Abuse&rdquo; button, or you can email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            {CONTACT_EMAIL}
          </a>{' '}
          with the exact{' '}
          <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            /f/...
          </code>{' '}
          URL (see our{' '}
          <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Contact &amp; DMCA instructions
          </Link>
          ).
        </p>
      </section>
    </LegalPageShell>
  );
}
