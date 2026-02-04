import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  LayoutTemplate,
  Plus,
  Edit2,
  Copy,
  Trash2,
  BarChart,
  PieChart,
  TrendingUp,
  Table,
  Lightbulb,
  LineChart,
  AreaChart,
} from 'lucide-react';
import { planNames } from '@/lib/mock-data';
import {
  useAllTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  DashboardTemplate,
} from '@/hooks/useTemplates';
import TemplateEditor from '@/components/admin/TemplateEditor';

const widgetIcons: Record<string, React.ReactNode> = {
  metric_card: <TrendingUp className="w-3 h-3" />,
  line_chart: <LineChart className="w-3 h-3" />,
  area_chart: <AreaChart className="w-3 h-3" />,
  bar_chart: <BarChart className="w-3 h-3" />,
  pie_chart: <PieChart className="w-3 h-3" />,
  funnel: <PieChart className="w-3 h-3" />,
  table: <Table className="w-3 h-3" />,
  insight_card: <Lightbulb className="w-3 h-3" />,
};

const Templates = () => {
  const { data: templates, isLoading, error } = useAllTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DashboardTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: DashboardTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleDuplicate = (id: string) => {
    duplicateTemplate.mutate(id);
  };

  const handleDeleteClick = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (templateToDelete) {
      deleteTemplate.mutate(templateToDelete);
      setTemplateToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleSave = (templateData: Omit<DashboardTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => {
    if (editingTemplate) {
      updateTemplate.mutate(
        { id: editingTemplate.id, ...templateData },
        { onSuccess: () => setEditorOpen(false) }
      );
    } else {
      createTemplate.mutate(templateData, {
        onSuccess: () => setEditorOpen(false),
      });
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-destructive">Erro ao carregar templates: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates de Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os templates disponíveis para cada plano
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-6 w-3/4" />
              </CardContent>
            </Card>
          ))
        ) : templates && templates.length > 0 ? (
          templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <LayoutTemplate className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          {planNames[template.plan as keyof typeof planNames]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {template.usage_count} org. usando
                        </span>
                        {!template.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDuplicate(template.id)}
                      disabled={duplicateTemplate.isPending}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteClick(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {template.description}
                </CardDescription>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {template.widgets?.length || 0} widgets incluídos:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {template.widgets?.map((widget, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs font-normal flex items-center gap-1"
                      >
                        {widgetIcons[widget.type] || <LayoutTemplate className="w-3 h-3" />}
                        {widget.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 text-center py-12">
            <LayoutTemplate className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum template encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro template de dashboard para começar
            </p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Template
            </Button>
          </div>
        )}
      </div>

      {/* Template Editor Modal */}
      <TemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
        onSave={handleSave}
        isLoading={createTemplate.isPending || updateTemplate.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O template será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Templates;
