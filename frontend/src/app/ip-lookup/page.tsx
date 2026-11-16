import { MyIpTool } from '@/components/MyIpTool';
import { ToolPageShell } from '@/components/ToolPageShell';
import { buildToolMetadata } from '@/lib/toolsConfig';

export const metadata = buildToolMetadata('my-ip');

export default function IpLookupPage() {
  return (
    <ToolPageShell toolId="my-ip">
      <MyIpTool />
    </ToolPageShell>
  );
}
