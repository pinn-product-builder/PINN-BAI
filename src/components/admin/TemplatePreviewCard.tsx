import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutTemplate,
  Edit2,
  Copy,
  Trash2,
  Check,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { planNames } from '@/lib/mock-data';
import type { DashboardTemplate, TemplateWidget } from '@/hooks/useTemplates';

// Colors for each widget type in the miniature preview
const widgetColors: Record<string, string> = {
  metric_card: 'bg-emerald-500',
  line_chart: 'bg-blue-500',
  area_chart: 'bg-cyan-500',
  bar_chart: 'bg-amber-500',
  pie_chart: 'bg-purple-500',
  funnel: 'bg-pink-500',
  table: 'bg-slate-500',
  insight_card: 'bg-indigo-500',
};

// Grid span based on widget size (12-column grid scaled down)
const sizeToGridSpan: Record<string, number> = {
  small: 3,
  medium: 4,
  large: 6,
  full: 12,
};

interface TemplatePreviewCardProps {
  template: DashboardTemplate;
  isSelected?: boolean;
  onSelect?: () => void;
  showActions?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

const TemplatePreviewCard = ({
  template,
  isSelected = false,
  onSelect,
  showActions = false,
  onEdit,
  onDuplicate,
  onDelete,
  compact = false,
}: TemplatePreviewCardProps) => {
  const widgets = (template.widgets || []) as TemplateWidget[];

  // Calculate widget counts by type
  const widgetCounts = widgets.reduce((acc, w) => {
    acc[w.type] = (acc[w.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Render miniature grid preview of widgets
  const renderMiniaturePreview = () => {
    // Create rows based on widget positions
    const rows: TemplateWidget[][] = [];
    let currentRow: TemplateWidget[] = [];
    let currentRowSpan = 0;

    widgets.forEach((widget) => {
      const span = sizeToGridSpan[widget.size || 'medium'] || 4;
      
      if (currentRowSpan + span > 12) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [widget];
        currentRowSpan = span;
      } else {
        currentRow.push(widget);
        currentRowSpan += span;
      }
    });
    
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return (
      <div className={cn("space-y-1", compact ? "p-2" : "p-3")}>
        {rows.slice(0, compact ? 2 : 3).map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
            {row.map((widget, widgetIdx) => {
              const span = sizeToGridSpan[widget.size || 'medium'] || 4;
              const widthPercent = (span / 12) * 100;
              
              return (
                <TooltipProvider key={widgetIdx}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        style={{ width: `${widthPercent}%` }}
                        className={cn(
                          "rounded transition-all",
                          widgetColors[widget.type] || 'bg-muted',
                          compact ? "h-3" : "h-4",
                          "opacity-70 hover:opacity-100 cursor-default"
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {widget.title}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        ))}
        {rows.length > (compact ? 2 : 3) && (
          <p className="text-[10px] text-muted-foreground text-center">
            +{rows.length - (compact ? 2 : 3)} linha(s)
          </p>
        )}
      </div>
    );
  };

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all cursor-pointer group",
        isSelected && "ring-2 ring-accent border-accent",
        onSelect && "hover:border-accent/50",
        !compact && "hover:shadow-md"
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className={cn("border-b bg-muted/30", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "rounded-lg bg-primary/10 flex items-center justify-center shrink-0",
              compact ? "w-8 h-8" : "w-10 h-10"
            )}>
              <LayoutTemplate className={cn("text-primary", compact ? "w-4 h-4" : "w-5 h-5")} />
            </div>
            <div className="min-w-0">
              <h3 className={cn(
                "font-semibold text-foreground truncate",
                compact ? "text-sm" : "text-base"
              )}>
                {template.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-xs shrink-0">
                  {planNames[template.plan as keyof typeof planNames]}
                </Badge>
                {!template.is_active && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Inativo
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {isSelected && (
            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-accent-foreground" />
            </div>
          )}

          {showActions && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.();
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Miniature Preview */}
      <div className="bg-muted/20">
        {renderMiniaturePreview()}
      </div>

      {/* Footer */}
      <div className={cn(
        "border-t flex items-center justify-between",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">{widgets.length}</span>
          <span>widgets</span>
        </div>
        
        {!compact && template.usage_count !== undefined && template.usage_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{template.usage_count} orgs</span>
          </div>
        )}

        {!compact && (
          <div className="flex gap-1 flex-wrap justify-end">
            {Object.entries(widgetCounts).slice(0, 3).map(([type, count]) => (
              <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0">
                {count}x {type.replace('_', ' ')}
              </Badge>
            ))}
            {Object.keys(widgetCounts).length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{Object.keys(widgetCounts).length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TemplatePreviewCard;
