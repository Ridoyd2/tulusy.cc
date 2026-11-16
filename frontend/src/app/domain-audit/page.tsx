import { DaChecker } from '@/components/DaChecker';
import { ToolPageShell } from '@/components/ToolPageShell';
import { buildToolMetadata } from '@/lib/toolsConfig';

export const metadata = buildToolMetadata('da-checker');

export default function DomainAuditPage() {
  return (
    <ToolPageShell toolId="da-checker">
      <DaChecker />
    </ToolPageShell>
  );
}
