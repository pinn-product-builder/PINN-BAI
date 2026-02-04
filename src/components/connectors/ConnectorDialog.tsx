import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, FileSpreadsheet, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConnectorDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (config: any) => void;
}

export type SourceType = 'supabase' | 'google_sheets' | 'api';

const ConnectorDialog = ({ isOpen, onOpenChange, onSuccess }: ConnectorDialogProps) => {
    const { toast } = useToast();
    const [sourceType, setSourceType] = useState<SourceType>('supabase');
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [config, setConfig] = useState({
        name: '',
        url: '',
        key: '',
        spreadsheetId: '',
        endpoint: '',
    });

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestStatus('idle');

        // Simulate connection testing based on source type
        await new Promise(resolve => setTimeout(resolve, 2000));

        const isSuccess = Math.random() > 0.1; // 90% success rate for simulation

        if (isSuccess) {
            setTestStatus('success');
            toast({
                title: "Conexão Estabelecida",
                description: `Conseguimos acessar seu ${sourceType} com sucesso.`,
            });
        } else {
            setTestStatus('error');
            toast({
                variant: "destructive",
                title: "Falha na Conexão",
                description: "Verifique as credenciais e tente novamente.",
            });
        }
        setIsTesting(false);
    };

    const handleSave = () => {
        onSuccess({ type: sourceType, ...config });
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-sidebar-border bg-sidebar shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="text-accent h-6 w-6" />
                        Novo Conector de Dados
                    </DialogTitle>
                    <DialogDescription>
                        Escolha uma fonte externa para alimentar seu centro de comando.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4 text-sidebar-foreground">
                    <div className="space-y-2">
                        <Label>Tipo de Fonte</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant={sourceType === 'supabase' ? 'default' : 'outline'}
                                className="flex flex-col gap-1 h-20 bg-accent/10 border-accent/20 hover:bg-accent/20"
                                onClick={() => setSourceType('supabase')}
                            >
                                <Database className="h-5 w-5" />
                                <span className="text-xs">Supabase</span>
                            </Button>
                            <Button
                                variant={sourceType === 'google_sheets' ? 'default' : 'outline'}
                                className="flex flex-col gap-1 h-20 bg-accent/10 border-accent/20 hover:bg-accent/20"
                                onClick={() => setSourceType('google_sheets')}
                            >
                                <FileSpreadsheet className="h-5 w-5" />
                                <span className="text-xs">G Sheets</span>
                            </Button>
                            <Button
                                variant={sourceType === 'api' ? 'default' : 'outline'}
                                className="flex flex-col gap-1 h-20 bg-accent/10 border-accent/20 hover:bg-accent/20"
                                onClick={() => setSourceType('api')}
                            >
                                <Globe className="h-5 w-5" />
                                <span className="text-xs">REST API</span>
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-sidebar-border">
                        <div className="space-y-2">
                            <Label htmlFor="conn-name">Nome da Conexão</Label>
                            <Input
                                id="conn-name"
                                placeholder="Ex: Banco de Produção"
                                className="bg-sidebar-accent/50 border-sidebar-border"
                                value={config.name}
                                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                            />
                        </div>

                        {sourceType === 'supabase' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Project URL</Label>
                                    <Input
                                        placeholder="https://xyz.supabase.co"
                                        className="bg-sidebar-accent/50 border-sidebar-border"
                                        value={config.url}
                                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Anon Key</Label>
                                    <Input
                                        type="password"
                                        placeholder="eyJh..."
                                        className="bg-sidebar-accent/50 border-sidebar-border"
                                        value={config.key}
                                        onChange={(e) => setConfig({ ...config, key: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {sourceType === 'google_sheets' && (
                            <div className="space-y-2">
                                <Label>Spreadsheet ID</Label>
                                <Input
                                    placeholder="1BxiMVs0XRA5nZm4..."
                                    className="bg-sidebar-accent/50 border-sidebar-border"
                                    value={config.spreadsheetId}
                                    onChange={(e) => setConfig({ ...config, spreadsheetId: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground">O ID está na URL da sua planilha.</p>
                            </div>
                        )}

                        {sourceType === 'api' && (
                            <div className="space-y-2">
                                <Label>Endpoint URL</Label>
                                <Input
                                    placeholder="https://api.empresa.com/v1/data"
                                    className="bg-sidebar-accent/50 border-sidebar-border"
                                    value={config.endpoint}
                                    onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="flex-1"
                    >
                        {isTesting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : testStatus === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-success mr-2" />
                        ) : testStatus === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-destructive mr-2" />
                        ) : null}
                        Testar Conexão
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={testStatus !== 'success'}
                        className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                        Salvar Conector
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConnectorDialog;
