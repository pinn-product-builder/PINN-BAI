import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Calculator, Database, ListTree, Lightbulb, Target, Clock,
} from 'lucide-react';
import type { MetricExplanation } from '@/data/arguto-demo';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  explanation: MetricExplanation | null;
}

export default function MetricExplanationDialog({ open, onOpenChange, explanation }: Props) {
  if (!explanation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wider border-primary/30 text-primary bg-primary/5">
            BAI · Detalhamento da métrica
          </Badge>
          <DialogTitle className="text-xl tracking-tight">{explanation.title}</DialogTitle>
          <DialogDescription className="text-sm">{explanation.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Definição */}
          <Section icon={BookOpen} label="O que é">
            <p className="text-sm text-foreground/90 leading-relaxed">{explanation.definition}</p>
          </Section>

          {/* Cálculo */}
          <Section icon={Calculator} label="Como é calculada">
            <pre className="text-[11px] font-mono bg-muted/40 border border-border/50 rounded-md p-3 whitespace-pre-wrap leading-relaxed text-foreground/90">
              {explanation.calculation}
            </pre>
          </Section>

          {/* Fontes de dado */}
          <Section icon={Database} label="Fontes de dado">
            <ul className="space-y-1.5">
              {explanation.dataSources.map((source, i) => (
                <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                  <span className="text-primary mt-1.5">•</span>
                  <span className="leading-relaxed">{source}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Breakdown numérico */}
          <Section icon={ListTree} label="Detalhamento numérico">
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {explanation.breakdown.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/30 last:border-b-0 ${
                        row.emphasis ? 'bg-primary/[0.04]' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-muted-foreground text-[12px]">
                        {row.label}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${
                        row.emphasis ? 'font-bold text-primary' : 'font-medium text-foreground'
                      }`}>
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Interpretação */}
          <Section icon={Lightbulb} label="Como ler este número">
            <p className="text-sm text-foreground/85 leading-relaxed italic">
              {explanation.interpretation}
            </p>
          </Section>

          {/* Ação */}
          <Section icon={Target} label="Próxima ação sugerida pelo BAI">
            <div className="p-3 rounded-md bg-primary/[0.05] border border-primary/20">
              <p className="text-sm text-foreground/90 leading-relaxed">{explanation.action}</p>
            </div>
          </Section>

          {/* Refresh */}
          <div className="flex items-center gap-2 pt-3 border-t border-border/30 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{explanation.refresh}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h4>
      </div>
      {children}
    </div>
  );
}
