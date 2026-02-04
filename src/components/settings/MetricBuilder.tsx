import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calculator, Play, Save, Plus, Trash2 } from 'lucide-react';
import { DataModeler, MetricDefinition } from '@/lib/data-modeler';
import { useToast } from '@/hooks/use-toast';

interface MetricBuilderProps {
    columns: string[];
    onSave: (metric: MetricDefinition) => void;
}

const MetricBuilder = ({ columns, onSave }: MetricBuilderProps) => {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [formula, setFormula] = useState('');
    const [format, setFormat] = useState<'number' | 'currency' | 'percent'>('number');
    const [testResult, setTestResult] = useState<number | null>(null);

    const handleTest = () => {
        // Create a mock row with random values for testing
        const mockRow: any = {};
        columns.forEach(col => mockRow[col] = Math.floor(Math.random() * 100) + 1);

        const modeler = new DataModeler();

        // Temp metric definition
        const tempMetric: MetricDefinition = {
            id: 'temp',
            name,
            formula,
            format,
            dependencies: [] // Simplification
        };

        modeler.addMetric(tempMetric);
        const result = modeler.evaluateMetric('temp', mockRow);
        setTestResult(result);

        toast({
            title: "Teste Executado",
            description: `Resultado para dados simulados: ${result?.toFixed(2)}`,
        });
    };

    const handleSave = () => {
        if (!name || !formula) {
            toast({
                variant: "destructive",
                title: "Campos obrigatórios",
                description: "Nome e fórmula são necessários.",
            });
            return;
        }

        onSave({
            id: `m-${Date.now()}`,
            name,
            formula,
            format,
            dependencies: [] // In a real app, parse this from formula string
        });

        setName('');
        setFormula('');
        setTestResult(null);
    };

    const insertToken = (token: string) => {
        setFormula(prev => prev + token + ' ');
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-accent" />
                    Construtor de Métricas
                </CardTitle>
                <CardDescription>
                    Crie campos calculados usando colunas existentes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nome da Métrica</Label>
                        <Input
                            placeholder="Ex: Taxa de Conversão"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Formato</Label>
                        <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="number">Numérico (1,234)</SelectItem>
                                <SelectItem value="currency">Moeda (R$ 1.234)</SelectItem>
                                <SelectItem value="percent">Porcentagem (12%)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Fórmula</Label>
                    <div className="bg-muted p-4 rounded-md space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {columns.map(col => (
                                <Badge
                                    key={col}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                                    onClick={() => insertToken(col)}
                                >
                                    {col}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                            {['+', '-', '*', '/', '(', ')'].map(op => (
                                <Button
                                    key={op}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8"
                                    onClick={() => insertToken(op)}
                                >
                                    {op}
                                </Button>
                            ))}
                        </div>
                        <Input
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            placeholder="Ex: ( leads / visitantes ) * 100"
                            className="font-mono"
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleTest}>
                            <Play className="w-4 h-4 mr-2" /> Testar
                        </Button>
                        {testResult !== null && (
                            <span className="text-sm font-mono bg-success/10 text-success px-2 py-1 rounded">
                                = {testResult.toFixed(2)}
                            </span>
                        )}
                    </div>
                    <Button className="bg-accent text-accent-foreground" onClick={handleSave}>
                        <Save className="w-4 h-4 mr-2" /> Salvar Métrica
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default MetricBuilder;
