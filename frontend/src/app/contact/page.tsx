import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, ShieldAlert, Bug } from 'lucide-react';
import { LegalPageShell } from '@/components/LegalPageShell';
import { CONTACT_EMAIL, SITE_DOMAIN, SITE_URL } from '@/lib/site';

const title = 'Contact & DMCA Support';
const description = `Reach the ${SITE_DOMAIN} team via ${CONTACT_EMAIL} for support, privacy questions, security disclosures, or urgent DMCA / abuse takedowns.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: `${title} | Tulusy`,
    description,
    url: `${SITE_URL}/contact`,
    siteName: 'Tulusy',
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <LegalPageShell
      title="Contact & DMCA Support"
      subtitle={`Direct communication channel for ${SITE_DOMAIN} support, abuse reports, and security inquiries.`}
      path="/contact"
      breadcrumbName="Contact"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel rounded-xl p-5 space-y-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">General &amp; Privacy</h2>
          <p className="text-xs">
            Questions about conversions, feature requests, or privacy policy inquiries:
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Tulusy%20Support%20Inquiry`}
            className="inline-block font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="panel rounded-xl p-5 space-y-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">DMCA &amp; Abuse</h2>
          <p className="text-xs">
            Report infringing or malicious hosted files using the link&apos;s Report Abuse button or email us the exact `/f/...` share ID:
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=DMCA%20%2F%20Abuse%20Report`}
            className="inline-block font-mono text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="panel rounded-xl p-5 space-y-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            <Bug className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Security &amp; Bugs</h2>
          <p className="text-xs">
            Responsible vulnerability disclosures or broken file format edge cases can be sent directly with reproduction details.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Security%20%2F%20Bug%20Report`}
            className="inline-block font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <section className="panel rounded-xl p-5 sm:p-6 space-y-2">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
          Helpful Policies
        </h2>
        <p className="text-xs sm:text-sm">
          Review how temporary uploads and edge relays operate in our{' '}
          <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
