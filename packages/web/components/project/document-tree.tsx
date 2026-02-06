import { FileText, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ja } from "@/lib/i18n/ja";

interface DocNode {
  id: string;
  title: string;
  contentType?: string;
  children?: DocNode[];
}

interface DocumentTreeProps {
  documents: Record<string, unknown>[];
}

function TreeNode({ node, depth }: { node: DocNode; depth: number }) {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-none px-2 py-1.5 hover:bg-white/5 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-teal-300 shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-white/40 shrink-0" />
        )}
        <span className="text-sm text-white truncate">{node.title}</span>
        {node.contentType && (
          <Badge variant="navy" className="ml-auto text-[10px] shrink-0">
            {node.contentType}
          </Badge>
        )}
      </div>
      {hasChildren &&
        node.children!.map((child) => (
          <TreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function DocumentTree({ documents }: DocumentTreeProps) {
  if (documents.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-white/50">{ja.common.noData}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardContent className="py-4">
        {documents.map((doc) => (
          <TreeNode
            key={doc.id as string}
            node={doc as unknown as DocNode}
            depth={0}
          />
        ))}
      </CardContent>
    </Card>
  );
}
