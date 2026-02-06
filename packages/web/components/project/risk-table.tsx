import { Badge } from "@/components/ui/badge";
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
  formatDate,
  riskProbabilityColor,
  riskImpactColor,
} from "@/lib/format";
import { ja } from "@/lib/i18n/ja";

interface RiskTableProps {
  risks: Record<string, unknown>[];
}

export function RiskTable({ risks }: RiskTableProps) {
  if (risks.length === 0) {
    return (
      <Card className="glass">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-white/50">{ja.risk.noRisks}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-white/50">{ja.risk.title}</TableHead>
            <TableHead className="text-white/50">{ja.risk.probability}</TableHead>
            <TableHead className="text-white/50">{ja.risk.impact}</TableHead>
            <TableHead className="text-white/50">{ja.risk.status}</TableHead>
            <TableHead className="text-white/50">{ja.common.dueAt}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risks.map((risk) => {
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
                      {(ja.riskProb as Record<string, string>)[probability] ?? probability}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {impact && (
                    <span className={`text-sm font-medium ${riskImpactColor(impact)}`}>
                      {(ja.riskImpact as Record<string, string>)[impact] ?? impact}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {status && (
                    <Badge variant="navy">
                      {(ja.riskStatus as Record<string, string>)[status] ?? status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-white/60">
                  {formatDate(dueAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
