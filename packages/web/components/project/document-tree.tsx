"use client";

import { useState } from "react";
import { FileText, FolderOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { useDeleteDocument } from "@/lib/hooks/use-documents";
import { CreateDocumentDialog } from "./create-document-dialog";
import { EditDocumentDialog } from "./edit-document-dialog";

interface DocNode {
  id: string;
  title: string;
  contentType?: string;
  bodyMd?: string;
  children?: DocNode[];
}

interface DocumentTreeProps {
  documents: Record<string, unknown>[];
  projectId?: string;
}

function TreeNode({
  node,
  depth,
  projectId,
  onEdit,
  onDelete,
}: {
  node: DocNode;
  depth: number;
  projectId?: string;
  onEdit: (doc: DocNode) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-none px-2 py-1.5 hover:bg-white/5 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-teal-300 shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-white/40 shrink-0" />
        )}
        <span className="text-sm text-white truncate flex-1">{node.title}</span>
        {node.contentType && (
          <Badge variant="navy" className="text-[10px] shrink-0">
            {node.contentType}
          </Badge>
        )}
        {projectId && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/50 hover:bg-white/10"
              onClick={() => onEdit(node)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-strong border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">
                    {t.common.confirm}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-white/50">
                    {t.document.deleteConfirm}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-white/60">
                    {t.common.cancel}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(node.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {t.common.delete}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      {hasChildren &&
        node.children!.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            projectId={projectId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

export function DocumentTree({ documents: initialDocuments, projectId }: DocumentTreeProps) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DocNode | null>(null);
  const { deleteDocument } = useDeleteDocument();
  const [items, setItems] = useState(initialDocuments);

  const handleRefresh = async () => {
    if (!projectId) return;
    try {
      const { api } = await import("@/lib/api/client");
      const data = await api.get<Record<string, unknown>[]>(
        `/api/projects/${projectId}/documents/tree`,
      );
      setItems(data);
    } catch {
      // silently handle
    }
  };

  const handleDelete = async (id: string) => {
    if (!projectId) return;
    await deleteDocument(projectId, id);
    handleRefresh();
  };

  return (
    <div className="space-y-4">
      {projectId && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t.document.create}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-white/50">{t.common.noData}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="py-4">
            {items.map((doc) => (
              <TreeNode
                key={doc.id as string}
                node={doc as unknown as DocNode}
                depth={0}
                projectId={projectId}
                onEdit={(node) => setEditTarget(node)}
                onDelete={handleDelete}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {projectId && (
        <>
          <CreateDocumentDialog
            projectId={projectId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={handleRefresh}
          />
          {editTarget && (
            <EditDocumentDialog
              projectId={projectId}
              document={editTarget as unknown as Record<string, unknown>}
              open={!!editTarget}
              onOpenChange={(open) => {
                if (!open) setEditTarget(null);
              }}
              onUpdated={handleRefresh}
            />
          )}
        </>
      )}
    </div>
  );
}
