import { FileHostTool } from '@/components/FileHostTool';
import { ToolPageShell } from '@/components/ToolPageShell';
import { buildToolMetadata } from '@/lib/toolsConfig';

export const metadata = buildToolMetadata('file-host');

export default function SharePage() {
  return (
    <ToolPageShell toolId="file-host">
      <FileHostTool />
    </ToolPageShell>
  );
}
