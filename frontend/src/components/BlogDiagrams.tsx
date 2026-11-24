import React from 'react';
import {
  ArrowRight,
  Ban,
  Bot,
  Check,
  Clock,
  EyeOff,
  FileWarning,
  HardDrive,
  Infinity as InfinityIcon,
  Layers,
  Lock,
  QrCode,
  RefreshCw,
  Server,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export type BlogDiagramId =
  | 'popular-sites-matrix'
  | 'size-comparison'
  | 'everyday-ways'
  | 'forever-timeline'
  | 'privacy-comparison'
  | 'multipart-pipeline';

export const BlogDiagram: React.FC<{ id: BlogDiagramId }> = ({ id }) => {
  switch (id) {
    case 'popular-sites-matrix':
      return <PopularSitesDiagram />;
    case 'size-comparison':
      return <SizeComparisonDiagram />;
    case 'everyday-ways':
      return <EverydayWaysDiagram />;
    case 'forever-timeline':
      return <ForeverTimelineDiagram />;
    case 'privacy-comparison':
      return <PrivacyComparisonDiagram />;
    case 'multipart-pipeline':
      return <MultipartPipelineDiagram />;
  }
};

function PopularSitesDiagram() {
  const competitors = [
    {
      name: 'WeTransfer (Free)',
      tag: '3 GB / 30 days',
      catchText: 'Send one 3 GB file and you hit the monthly data ceiling; links vanish in 3 days.',
    },
    {
      name: 'MEGA (Free)',
      tag: 'Quota throttling',
      catchText: 'Requires login and pauses recipients mid-download when free transfer quota runs out.',
    },
    {
      name: 'MediaFire (Free)',
      tag: '4 GB · Pop-up links',
      catchText: 'Capped at 4 GB per file; recipients click through pop-ups and redirect clutter.',
    },
    {
      name: 'Google Drive / Dropbox',
      tag: '15 GB pooled / 2 GB',
      catchText: 'Eats account quota, links your profile identity, and Dropbox locks to 3 devices.',
    },
    {
      name: 'SendGB / Gofile',
      tag: 'Fixed 7d / 100 GB cap',
      catchText: 'SendGB drops >250 MB files after 7 days unless extended; Gofile caps anon at 100 GB/30d without Burn on Read.',
    },
    {
      name: 'SwissTransfer',
      tag: '50 GB · Fixed 30d',
      catchText: 'Great for huge static sends, but every link dies within 30 days—no sliding Forever retention.',
    },
  ];

  return (
    <figure className="panel rounded-xl p-5 sm:p-6 my-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
          Where Popular Free Tiers Catch You Off Guard
        </figcaption>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Free-tier constraints vs. Tulusy
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {competitors.map((item) => (
          <div
            key={item.name}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                {item.name}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                {item.tag}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {item.catchText}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-xs font-semibold text-slate-900 dark:text-white">
            Tulusy File Share
          </span>
          <p className="text-[11px] text-slate-700 dark:text-slate-300">
            5 GB per file, zero signup, direct downloads without countdown waits, Burn on Read, salted scrypt passwords, or Forever (7d idle).
          </p>
        </div>
        <span className="self-start sm:self-center text-[11px] font-mono font-semibold px-2 py-1 rounded bg-blue-600 text-white shrink-0">
          5 GB · Zero catch
        </span>
      </div>
    </figure>
  );
}

function SizeComparisonDiagram() {
  const rows = [
    {
      label: 'Free chat & email tiers',
      spec: '10 – 25 MB',
      widthClass: 'w-[4%] min-w-[10px]',
      barClass: 'bg-slate-400 dark:bg-slate-600',
      note: 'Bounces large PDFs, renders, or ZIP archives',
    },
    {
      label: 'Messaging media mode',
      spec: 'Re-encoded',
      widthClass: 'w-[18%]',
      barClass: 'bg-slate-400 dark:bg-slate-600',
      note: 'Shrinks resolution & strips photo/video bitrate',
    },
    {
      label: 'Typical free transfer hosts',
      spec: '1 – 2 GB',
      widthClass: 'w-[40%]',
      barClass: 'bg-slate-500 dark:bg-slate-500',
      note: 'Email verification, download queues, rigid 3–7d wipe',
    },
    {
      label: 'Tulusy File Share',
      spec: '5 GB (5,120 MB)',
      widthClass: 'w-full',
      barClass: 'bg-blue-600 dark:bg-blue-500',
      note: 'Zero signup · Original bytes · Forever (7d idle) or Burn',
      highlight: true,
    },
  ];

  return (
    <figure className="panel rounded-xl p-5 sm:p-6 my-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
          Single-Transfer Capacity Without an Account
        </figcaption>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Max upload size per drop
        </span>
      </div>

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span
                className={
                  row.highlight
                    ? 'font-semibold text-slate-900 dark:text-white'
                    : 'font-medium text-slate-700 dark:text-slate-300'
                }
              >
                {row.label}
              </span>
              <span
                className={`font-mono text-[11px] shrink-0 ${
                  row.highlight
                    ? 'font-semibold text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {row.spec}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
              <div className={`h-full rounded-full ${row.widthClass} ${row.barClass}`} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.note}</p>
          </div>
        ))}
      </div>
    </figure>
  );
}

function EverydayWaysDiagram() {
  const cards = [
    {
      title: 'Email Attachments',
      status: 'Blocked > 25 MB',
      statusBad: true,
      icon: <Ban className="w-4 h-4 text-rose-500" />,
      detail: 'Files bounce back or leave sensitive copies trapped in both mailboxes.',
    },
    {
      title: 'WhatsApp / Discord / Telegram',
      status: 'Re-compressed',
      statusBad: true,
      icon: <FileWarning className="w-4 h-4 text-amber-500" />,
      detail: 'Default photo & video pipelines blur screenshots and muddy audio.',
    },
    {
      title: 'AirDrop & USB Flash Drives',
      status: 'OS & cable friction',
      statusBad: true,
      icon: <HardDrive className="w-4 h-4 text-slate-500" />,
      detail: 'AirDrop fails on Windows/Android; USB sticks risk lost hardware or dongles.',
    },
    {
      title: 'Tulusy Link + Local QR',
      status: '5 GB · Exact bytes',
      statusBad: false,
      icon: <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      detail: 'Works across iPhone, Android, Windows, macOS, and Linux with zero login.',
    },
  ];

  return (
    <figure className="panel rounded-xl p-5 sm:p-6 my-4 space-y-4">
      <figcaption className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
        What Happens When You Send a 1.5 GB Video + Design Folder
      </figcaption>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-lg p-3.5 border space-y-1.5 ${
              card.statusBad
                ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40'
                : 'border-blue-500/40 dark:border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {card.icon}
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  card.statusBad
                    ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {card.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {card.detail}
            </p>
          </div>
        ))}
      </div>
    </figure>
  );
}

function ForeverTimelineDiagram() {
  const events = [
    {
      source: 'Human opens /f/[id] in a browser',
      effect: 'Resets 7-day countdown',
      counted: true,
      icon: <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      note: 'Client view beacon fires after mount; live countdown jumps back to 7 days.',
    },
    {
      source: 'Recipient downloads the file',
      effect: 'Resets 7-day countdown',
      counted: true,
      icon: <InfinityIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      note: 'Both local streams and R2 signed downloads count as real link activity.',
    },
    {
      source: 'Discord, WhatsApp, Telegram, or Slack preview crawler',
      effect: 'Ignored (no extension)',
      counted: false,
      icon: <Bot className="w-4 h-4 text-slate-500" />,
      note: 'Pasting a link in group chat won’t accidentally keep dead files alive.',
    },
    {
      source: 'Browser prefetch or server metadata read',
      effect: 'Ignored (read-only)',
      counted: false,
      icon: <Clock className="w-4 h-4 text-slate-500" />,
      note: 'Sec-Purpose prefetch headers and uploader dashboard checks don’t touch TTL.',
    },
  ];

  return (
    <figure className="panel rounded-xl p-5 sm:p-6 my-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
          What Resets the 7-Day Idle Timer (and What Doesn’t)
        </figcaption>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Signal filtering rules
        </span>
      </div>

      <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        {events.map((ev) => (
          <div
            key={ev.source}
            className="p-3.5 bg-white dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5 shrink-0">{ev.icon}</div>
              <div>
                <p className="text-xs font-medium text-slate-900 dark:text-white">{ev.source}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{ev.note}</p>
              </div>
            </div>
            <span
              className={`self-start sm:self-center shrink-0 text-[11px] font-mono px-2 py-0.5 rounded ${
                ev.counted
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/70'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {ev.effect}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function PrivacyComparisonDiagram() {
  return (
    <figure className="panel rounded-xl p-5 sm:p-6 my-4 space-y-4">
      <figcaption className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
        Cloud Drive Public Links vs. Ephemeral Tulusy Drops
      </figcaption>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <UserCheck className="w-4 h-4 text-slate-500" />
            <span>Cloud Drive (&ldquo;Anyone with the link&rdquo;)</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Link stays live indefinitely until you remember to revoke it</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Displays your Google/Microsoft account name and avatar</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 mt-0.5">•</span>
              <span>Counts permanently against your storage plan quota</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Tulusy Anonymous File Share</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Zero uploader or viewer IP logs + Disallow: /f/ search blocking</span>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>Optional salted scrypt password + Burn on Read single-use lock</span>
            </li>
            <li className="flex items-start gap-2">
              <EyeOff className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>30-minute signed download URLs + instant browser delete token</span>
            </li>
          </ul>
        </div>
      </div>
    </figure>
  );
}

function MultipartPipelineDiagram() {
  return (
    <figure className="panel rounded-xl p-5 sm:p-6 my-4 space-y-4">
      <figcaption className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
        Upload Path: Proxy Bottleneck vs. Tulusy Direct-to-R2
      </figcaption>
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <span>Standard Web Host (Double-Hop Relay)</span>
            <span className="font-mono text-rose-500">Timeouts &amp; proxy caps</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
            <span className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              Browser
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5">
              <Server className="w-3 h-3 text-slate-500" />
              App Server RAM/Disk
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              Storage Bucket
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-blue-700 dark:text-blue-400">
            <span>Tulusy File Share (&gt; 64 MB Multipart Mode)</span>
            <span className="font-mono">3x parallel 32 MB chunks</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-900 dark:text-white">
            <span className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800">
              Browser
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
            <span className="px-2.5 py-1 rounded bg-blue-600 text-white inline-flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              3x Parallel Signed PUTs
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-500" />
            <span className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-blue-500" />
              Cloudflare R2 Edge
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
