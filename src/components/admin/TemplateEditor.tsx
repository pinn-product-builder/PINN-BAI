import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { DashboardTemplate, TemplateWidget } from '@/hooks/useTemplates';
import { planNames } from '@/lib/mock-data';

const widgetTypes = [
  { value: 'metric_card', label: 'Métrica' },
  { value: 'line_chart', label: 'Gráfico de Linha' },
  { value: 'area_chart', label: 'Gráfico de Área' },
  { value: 'bar_chart', label: 'Gráfico de Barras' },
  { value: 'pie_chart', label: 'Gráfico de Pizza' },
  { value: 'funnel', label: 'Funil' },
  { value: 'table', label: 'Tabela' },
  { value: 'insight_card', label: 'Insights IA' },
];

const widgetSizes = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Médio' },
  { value: 'large', label: 'Grande' },
  { value: 'full', label: 'Largura Total' },
];

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: DashboardTemplate | null;
  onSave: (template: Omit<DashboardTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => void;
  isLoading?: boolean;
}

const TemplateEditor = ({ open, onOpenChange, template, onSave, isLoading }: TemplateEditorProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState<number>(1);
  const [category, setCategory] = useState('sales');
  const [isActive, setIsActive] = useState(true);
  const [widgets, setWidgets] = useState<TemplateWidget[]>([]);

  // New widget form
  const [newWidgetType, setNewWidgetType] = useState('metric_card');
  const [newWidgetTitle, setNewWidgetTitle] = useState('');
  const [newWidgetSize, setNewWidgetSize] = useState<'small' | 'medium' | 'large' | 'full'>('medium');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setPlan(template.plan);
      setCategory(template.category);
      setIsActive(template.is_active);
      setWidgets(template.widgets || []);
    } else {
      setName('');
      setDescription('');
      setPlan(1);
      setCategory('sales');
      setIsActive(true);
      setWidgets([]);
    }
  }, [template, open]);

  const handleAddWidget = () => {
    if (!newWidgetTitle.trim()) return;

    const newWidget: TemplateWidget = {
      type: newWidgetType,
      title: newWidgetTitle,
      size: newWidgetSize,
      position: widgets.length + 1,
      config: {},
    };

    setWidgets([...widgets, newWidget]);
    setNewWidgetTitle('');
    setNewWidgetType('metric_card');
    setNewWidgetSize('medium');
  };

  const handleRemoveWidget = (index: number) => {
    const updated = widgets.filter((_, i) => i !== index);
    // Reorder positions
    const reordered = updated.map((w, i) => ({ ...w, position: i + 1 }));
    setWidgets(reordered);
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      plan,
      category,
      widgets,
      preview_image_url: null,
      is_active: isActive,
      created_by: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes e widgets do template de dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Template</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Dashboard Starter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plano Mínimo</Label>
              <Select value={String(plan)} onValueChange={(v) => setPlan(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(planNames).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito e conteúdo deste template..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Vendas</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="finance">Financeiro</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="is-active">Template ativo</Label>
            </div>
          </div>

          {/* Widgets Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Widgets ({widgets.length})</Label>

            {/* Current Widgets */}
            {widgets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {widgets.map((widget, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2"
                  >
                    <span className="text-xs">{widget.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-destructive/20"
                      onClick={() => handleRemoveWidget(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add Widget Form */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">Adicionar Widget</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newWidgetType} onValueChange={setNewWidgetType}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {widgetTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input
                    className="h-9"
                    value={newWidgetTitle}
                    onChange={(e) => setNewWidgetTitle(e.target.value)}
                    placeholder="Título do widget"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddWidget();
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tamanho</Label>
                  <Select value={newWidgetSize} onValueChange={(v) => setNewWidgetSize(v as typeof newWidgetSize)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {widgetSizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddWidget}
                disabled={!newWidgetTitle.trim()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || widgets.length === 0 || isLoading}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isLoading ? 'Salvando...' : template ? 'Salvar Alterações' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateEditor;
