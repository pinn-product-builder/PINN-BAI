import { WidgetType, WidgetConfig } from './types';

export interface ProfiledColumn {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'category';
    relevance: number; // 0 to 1
}

export interface RecommendedWidget {
    type: WidgetType;
    title: string;
    description: string;
    config: WidgetConfig;
    width: number;
    height: number;
}

export class DataProfiler {
    static profile(data: any[]): ProfiledColumn[] {
        if (!data || data.length === 0) return [];

        const columns = Object.keys(data[0]);
        return columns.map(col => {
            const values = data.map(row => row[col]).filter(v => v !== null && v !== undefined);
            const type = this.detectType(values);

            return {
                name: col,
                type,
                relevance: this.calculateRelevance(col, type)
            };
        });
    }

    /**
     * Profiles a remote schema based on metadata (e.g. Supabase table structure)
     */
    static profileRemoteSchema(schema: { name: string; type: string }[]): ProfiledColumn[] {
        return schema.map(col => ({
            name: col.name,
            type: this.mapRemoteType(col.type),
            relevance: this.calculateRelevance(col.name, this.mapRemoteType(col.type))
        }));
    }

    private static mapRemoteType(remoteType: string): ProfiledColumn['type'] {
        const type = remoteType.toLowerCase();
        if (type.includes('int') || type.includes('float') || type.includes('numeric') || type.includes('double')) return 'number';
        if (type.includes('date') || type.includes('timestamp') || type.includes('time')) return 'date';
        if (type.includes('bool')) return 'boolean';
        if (type.includes('varchar') || type.includes('text') || type.includes('char')) return 'string';
        return 'string';
    }

    private static detectType(values: any[]): ProfiledColumn['type'] {
        if (values.length === 0) return 'string';

        const first = values[0];
        if (typeof first === 'number') return 'number';
        if (typeof first === 'boolean') return 'boolean';

        // Check for date
        if (!isNaN(Date.parse(first)) && isNaN(Number(first))) return 'date';

        // Check for email
        if (typeof first === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first)) return 'email';

        // Check if it's a category (low cardinality string)
        const uniqueValues = new Set(values);
        if (typeof first === 'string' && uniqueValues.size < values.length * 0.2) return 'category';

        return 'string';
    }

    private static calculateRelevance(name: string, type: string): number {
        const highRelevanceKeywords = ['valor', 'receita', 'venda', 'date', 'data', 'lead', 'status', 'revenue', 'price', 'total', 'mrr', 'churn', 'cac', 'ltv'];
        const lowerName = name.toLowerCase();

        for (const keyword of highRelevanceKeywords) {
            if (lowerName.includes(keyword)) return 0.95;
        }

        if (type === 'number') return 0.85;
        if (type === 'date') return 0.80;

        return 0.4;
    }

    static recommendWidgets(profiledColumns: ProfiledColumn[], plan: number = 1): RecommendedWidget[] {
        const recommendations: RecommendedWidget[] = [];
        const sorted = [...profiledColumns].sort((a, b) => b.relevance - a.relevance);

        // 1. Metric Cards (Available for all plans, but more for higher tiers)
        const metricsCount = plan === 5 ? 6 : plan >= 3 ? 4 : 2;
        const metrics = sorted.filter(c => c.type === 'number');
        metrics.slice(0, metricsCount).forEach(metric => {
            recommendations.push({
                type: 'metric_card',
                title: `Total de ${metric.name}`,
                description: `Visão consolidada baseada na coluna ${metric.name}.`,
                config: { metric: metric.name, aggregation: 'sum' },
                width: plan >= 3 ? 2 : 3,
                height: 1
            });
        });

        // 2. Charts (Plan-based complexity)
        const dateCol = sorted.find(c => c.type === 'date');
        const valueCol = sorted.find(c => c.type === 'number');

        if (dateCol && valueCol) {
            recommendations.push({
                type: plan >= 4 ? 'area_chart' : 'line_chart',
                title: `Tendência de ${valueCol.name}`,
                description: `Evolução temporal de ${valueCol.name}.`,
                config: { metric: valueCol.name, dataSource: dateCol.name },
                width: 6,
                height: 2
            });
        }

        // 3. Category distribution (Plan filter)
        if (plan >= 2) {
            const categoryCol = sorted.find(c => c.type === 'category' || c.type === 'string');
            if (categoryCol) {
                recommendations.push({
                    type: plan >= 4 ? 'bar_chart' : 'pie_chart',
                    title: `Distribuição por ${categoryCol.name}`,
                    description: `Análise de segmentos por ${categoryCol.name}.`,
                    config: { metric: 'count', dataSource: categoryCol.name },
                    width: plan === 5 ? 4 : 6,
                    height: 2
                });
            }
        }

        // 4. Premium AI Insights (Plan >= 3)
        if (plan >= 3) {
            recommendations.push({
                type: 'insight_card',
                title: 'Análise de Inteligência',
                description: 'Insights automáticos gerados pelo cérebro da plataforma.',
                config: { model: 'gpt-4-turbo' },
                width: 12,
                height: 2
            });
        }

        return recommendations;
    }
}
