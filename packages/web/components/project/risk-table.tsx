"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  formatDate,
  riskProbabilityColor,
  riskImpactColor,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useDeleteRisk } from "@/lib/hooks/use-risks";
import { CreateRiskDialog } from "./create-risk-dialog";
import { EditRiskDialog } from "./edit-risk-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface RiskTableProps {
  risks: Record<string, unknown>[];
  projectId?: string;
}

export function RiskTable({ risks: initialRisks, projectId }: RiskTableProps) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);
  const { deleteRisk } = useDeleteRisk();
  const [items, setItems] = useState(initialRisks);

  const handleRefresh = async () => {
    if (!projectId) return;
    try {
      const { api, buildQuery } = await import("@/lib/api/client");
      const data = await api.get<{ items: Record<string, unknown>[] }>(
        `/api/risks${buildQuery({ projectId, limit: 100 })}`,
      );
      setItems(data.items);
    } catch {
      // silently handle
    }
  };

  const handleDelete = async (id: string) => {
    await deleteRisk(id);
    handleRefresh();
  };

  if (items.length === 0 && !projectId) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-white/50">{t.risk.noRisks}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projectId && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t.risk.create}
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-white/50">{t.risk.noRisks}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/50">{t.risk.title}</TableHead>
                <TableHead className="text-white/50">{t.risk.probability}</TableHead>
                <TableHead className="text-white/50">{t.risk.impact}</TableHead>
                <TableHead className="text-white/50">{t.risk.status}</TableHead>
                <TableHead className="text-white/50">{t.common.dueAt}</TableHead>
                {projectId && (
                  <TableHead className="text-white/50 w-20"></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((risk) => {
                const id = risk.id as string;
                const title = risk.title as string;
                const probability = risk.probability as string | undefined;
                const impact = risk.impact as string | undefined;
                const status = risk.status as string | undefined;
                const dueAt = risk.dueAt as number | undefined;

                return (
                  <TableRow key={id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-sm text-white">{title}</TableCell>
                    <TableCell>
                      {probability && (
                        <span className={`text-sm font-medium ${riskProbabilityColor(probability)}`}>
                          {(t.riskProb as Record<string, string>)[probability] ?? probability}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {impact && (
                        <span className={`text-sm font-medium ${riskImpactColor(impact)}`}>
                          {(t.riskImpact as Record<string, string>)[impact] ?? impact}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {status && (
                        <Badge variant="navy">
                          {(t.riskStatus as Record<string, string>)[status] ?? status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-white/60">
                      {formatDate(dueAt)}
                    </TableCell>
                    {projectId && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-white/50 hover:bg-white/10"
                            onClick={() => setEditTarget(risk)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="glass-strong border-white/10">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  {t.common.confirm}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/50">
                                  {t.risk.deleteConfirm}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-white/60">
                                  {t.common.cancel}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {t.common.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {projectId && (
        <>
          <CreateRiskDialog
            projectId={projectId}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={handleRefresh}
          />
          {editTarget && (
            <EditRiskDialog
              risk={editTarget}
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
