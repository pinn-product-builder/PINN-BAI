import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import {
  useAllTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  DashboardTemplate,
} from '@/hooks/useTemplates';
import TemplateEditor from '@/components/admin/TemplateEditor';
import TemplatePreviewCard from '@/components/admin/TemplatePreviewCard';

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
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border bg-card">
              <div className="p-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))
        ) : templates && templates.length > 0 ? (
          templates.map((template) => (
            <TemplatePreviewCard
              key={template.id}
              template={template}
              showActions
              onEdit={() => handleEdit(template)}
              onDuplicate={() => handleDuplicate(template.id)}
              onDelete={() => handleDeleteClick(template.id)}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
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
