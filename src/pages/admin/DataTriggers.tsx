import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Zap, Bell, Webhook, Plus, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Trigger {
    id: string;
    name: string;
    metric: string;
    condition: 'gt' | 'lt' | 'eq';
    value: number;
    action: 'webhook' | 'email';
    destination: string;
    active: boolean;
}

const mockTriggers: Trigger[] = [
    {
        id: 't1',
        name: 'Alerta de Queda de Leads',
        metric: 'leads',
        condition: 'lt',
        value: 50,
        action: 'email',
        destination: 'sales@pinn.com',
        active: true,
    },
    {
        id: 't2',
        name: 'Meta Batida (Slack)',
        metric: 'revenue',
        condition: 'gt',
        value: 100000,
        action: 'webhook',
        destination: 'https://hooks.slack.com/services/xxx',
        active: true,
    }
];

const DataTriggers = () => {
    const { toast } = useToast();
    const [triggers, setTriggers] = useState<Trigger[]>(mockTriggers);
    const [isEditing, setIsEditing] = useState(false);
    const [newTrigger, setNewTrigger] = useState<Partial<Trigger>>({
        condition: 'gt',
        action: 'webhook',
        active: true
    });

    const handleSave = () => {
        if (!newTrigger.name || !newTrigger.metric || !newTrigger.value || !newTrigger.destination) {
            toast({
                variant: "destructive",
                title: "Campos Incompletos",
                description: "Preencha todos os campos para criar o gatilho.",
            });
            return;
        }

        const trigger: Trigger = {
            id: `t-${Date.now()}`,
            name: newTrigger.name,
            metric: newTrigger.metric,
            condition: newTrigger.condition as 'gt' | 'lt' | 'eq',
            value: Number(newTrigger.value),
            action: newTrigger.action as 'webhook' | 'email',
            destination: newTrigger.destination,
            active: true,
        };

        setTriggers([...triggers, trigger]);
        setIsEditing(false);
        setNewTrigger({ condition: 'gt', action: 'webhook', active: true });

        toast({
            title: "Gatilho Ativado",
            description: `O monitor para ${trigger.name} está rodando.`,
        });
    };

    const deleteTrigger = (id: string) => {
        setTriggers(triggers.filter(t => t.id !== id));
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Zap className="w-8 h-8 text-warning" />
                        Data Triggers & Webhooks
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Transforme dados em ação. Dispare eventos quando métricas atingirem limites.
                    </p>
                </div>
                <Button onClick={() => setIsEditing(true)} className="bg-accent text-accent-foreground">
                    <Plus className="w-4 h-4 mr-2" /> Novo Gatilho
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List of Active Triggers */}
                <div className="lg:col-span-2 space-y-4">
                    {triggers.map(trigger => (
                        <Card key={trigger.id} className="group hover:shadow-lg transition-all border-l-4 border-l-accent">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl ${trigger.action === 'webhook' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {trigger.action === 'webhook' ? <Webhook size={24} /> : <Bell size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{trigger.name}</h3>
                                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                                            Quando <span className="font-mono bg-muted px-1 rounded">{trigger.metric}</span> for
                                            <span className="font-bold text-foreground">
                                                {trigger.condition === 'gt' ? ' maior que ' : ' menor que '}
                                                {trigger.value}
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-2 truncate max-w-md">
                                            → {trigger.destination}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Switch checked={trigger.active} />
                                    <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteTrigger(trigger.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Creator Panel */}
                {isEditing && (
                    <Card className="lg:col-span-1 border-accent bg-accent/5 h-fit sticky top-8">
                        <CardHeader>
                            <CardTitle>Configurar Automação</CardTitle>
                            <CardDescription>Defina a regra lógica do disparo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome do Gatilho</Label>
                                <Input
                                    placeholder="Ex: Alerta de Crise"
                                    value={newTrigger.name || ''}
                                    onChange={e => setNewTrigger({ ...newTrigger, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label>Métrica</Label>
                                    <Select onValueChange={v => setNewTrigger({ ...newTrigger, metric: v })}>
                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="leads">Leads</SelectItem>
                                            <SelectItem value="revenue">Receita</SelectItem>
                                            <SelectItem value="churn">Churn Rate</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Condição</Label>
                                    <Select defaultValue="gt" onValueChange={v => setNewTrigger({ ...newTrigger, condition: v as any })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gt">Maior que</SelectItem>
                                            <SelectItem value="lt">Menor que</SelectItem>
                                            <SelectItem value="eq">Igual a</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Valor Limite</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newTrigger.value || ''}
                                    onChange={e => setNewTrigger({ ...newTrigger, value: Number(e.target.value) })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Ação</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant={newTrigger.action === 'webhook' ? 'default' : 'outline'}
                                        onClick={() => setNewTrigger({ ...newTrigger, action: 'webhook' })}
                                        className="justify-start"
                                    >
                                        <Webhook className="w-4 h-4 mr-2" /> Webhook
                                    </Button>
                                    <Button
                                        variant={newTrigger.action === 'email' ? 'default' : 'outline'}
                                        onClick={() => setNewTrigger({ ...newTrigger, action: 'email' })}
                                        className="justify-start"
                                    >
                                        <Bell className="w-4 h-4 mr-2" /> Email
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Destino ({newTrigger.action === 'webhook' ? 'URL' : 'Email'})</Label>
                                <Input
                                    placeholder={newTrigger.action === 'webhook' ? 'https://api.zapier.com/...' : 'admin@company.com'}
                                    value={newTrigger.destination || ''}
                                    onChange={e => setNewTrigger({ ...newTrigger, destination: e.target.value })}
                                />
                            </div>

                            <Button className="w-full mt-4 bg-accent text-accent-foreground" onClick={handleSave}>
                                <Save className="w-4 h-4 mr-2" /> Ativar Robô
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default DataTriggers;
