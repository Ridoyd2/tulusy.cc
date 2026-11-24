import Link from 'next/link';
import { LegalPageShell } from '@/components/LegalPageShell';
import { CONTACT_EMAIL, SITE_DOMAIN } from '@/lib/site';
import { buildSeoMetadata } from '@/lib/toolsConfig';

export const metadata = buildSeoMetadata({
  title: 'Privacy Policy - Zero File Retention',
  description: `Learn how ${SITE_DOMAIN} processes converted files, ephemeral 5GB file drops, IP lookups, and contact inquiries with zero retention.`,
  path: '/privacy',
  card: 'summary',
});

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle={`Effective date: November 16, 2026 · Privacy-first processing on ${SITE_DOMAIN}`}
      path="/privacy"
      breadcrumbName="Privacy Policy"
    >
      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          1. Ephemeral File Conversions
        </h2>
        <p>
          Uploaded images, PDFs, documents, and spreadsheets are written to temporary per-task directories only while conversion runs and are removed automatically once the output stream finishes. Tulusy does not sell, inspect, or index converted files.
        </p>
      </section>

      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          2. Anonymous 5GB File Share
        </h2>
        <p>
          Shared files are uploaded directly to private Cloudflare R2 object storage. Files remain accessible according to the chosen retention rule: a fixed timer (1 hour to 7 days), single-use burn-on-read, or Forever hosting (which remains active indefinitely and is automatically deleted only after 7 consecutive days with zero views or downloads). File Share stores zero account profiles and zero uploader or viewer IP addresses; uploaders receive a private delete token to remove files early at any time.
        </p>
      </section>

      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          3. Web & Network Utilities
        </h2>
        <p>
          When you use the IP Inspector, HTTP Benchmark, or Domain Audit tools, requests are processed only to return live diagnostic metrics to your session. Standard web server access logs and Cloudflare network edge protections may temporarily process request metadata to mitigate abuse and keep services reliable.
        </p>
      </section>

      <section className="panel rounded-xl p-5 sm:p-6 space-y-2.5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          4. Local Browser Preferences & Contact
        </h2>
        <p>
          Theme preference (light or dark) and local File Share history/delete tokens are stored solely in your browser&apos;s{' '}
          <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            localStorage
          </code>{' '}
          and can be cleared anytime. For privacy requests or takedown inquiries, contact{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            {CONTACT_EMAIL}
          </a>{' '}
          or visit our{' '}
          <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Contact &amp; DMCA page
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
