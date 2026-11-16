import { LoadTester } from '@/components/LoadTester';
import { ToolPageShell } from '@/components/ToolPageShell';
import { buildToolMetadata } from '@/lib/toolsConfig';

export const metadata = buildToolMetadata('load-tester');

export default function HttpBenchmarkPage() {
  return (
    <ToolPageShell toolId="load-tester">
      <LoadTester />
    </ToolPageShell>
  );
}
