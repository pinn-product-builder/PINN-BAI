import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Shield, User, Clock, FileText, Filter } from 'lucide-react';
import { mockActivityLogs } from '@/lib/mock-data';

const AuditLogs = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLogs = mockActivityLogs.filter(
        (log) =>
            log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.details.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionColor = (action: string) => {
        const lower = action.toLowerCase();
        if (lower.includes('criou') || lower.includes('created')) return 'bg-success/10 text-success';
        if (lower.includes('removeu') || lower.includes('deleted')) return 'bg-destructive/10 text-destructive';
        if (lower.includes('atualizou') || lower.includes('updated')) return 'bg-warning/10 text-warning';
        return 'bg-primary/10 text-primary';
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Shield className="w-8 h-8 text-accent" />
                        Audit Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Registro de todas as atividades e governança do sistema.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Histórico de Eventos</CardTitle>
                            <CardDescription>
                                Monitoramento de segurança e conformidade ({filteredLogs.length} registros)
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <div className="relative w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por usuário, ação ou detalhe..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-background"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data & Hora</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Ação</TableHead>
                                <TableHead>Entidade</TableHead>
                                <TableHead>Detalhes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(log.createdAt)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                                                <User className="w-3 h-3 text-accent" />
                                            </div>
                                            <span className="font-medium text-sm">{log.userName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${getActionColor(log.action)} border-0`}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-mono text-xs">
                                            {log.entityType.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-md truncate text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-3 h-3" />
                                            {log.details}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default AuditLogs;
