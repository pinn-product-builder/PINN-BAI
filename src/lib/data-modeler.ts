
export interface MetricDefinition {
    id: string;
    name: string;
    description?: string;
    formula: string; // e.g., "leads / visitors * 100"
    format: 'number' | 'currency' | 'percent';
    dependencies: string[]; // List of column names used in formula
}

export interface FieldAlias {
    original: string;
    alias: string;
    visible: boolean;
}

export class DataModeler {
    private metrics: Map<string, MetricDefinition> = new Map();
    private aliases: Map<string, FieldAlias> = new Map();

    constructor(config?: { metrics: MetricDefinition[]; aliases: FieldAlias[] }) {
        if (config) {
            config.metrics.forEach(m => this.metrics.set(m.id, m));
            config.aliases.forEach(a => this.aliases.set(a.original, a));
        }
    }

    /**
     * Registers a new calculated metric
     */
    addMetric(metric: MetricDefinition) {
        this.metrics.set(metric.id, metric);
    }

    /**
     * Registers a field alias
     */
    addAlias(original: string, alias: string, visible: boolean = true) {
        this.aliases.set(original, { original, alias, visible });
    }

    /**
     * Evaluates a metric against a data row
     */
    evaluateMetric(metricId: string, row: any): number | null {
        const metric = this.metrics.get(metricId);
        if (!metric) return null;

        try {
            // Create a function with row keys as variables
            const cleanFormula = metric.formula.toLowerCase();
            // This is a naive implementation; in production, use a parser like math.js
            // For now, we'll replace variables with values manually or use Function

            const keys = Object.keys(row);
            const values = Object.values(row);

            // Safety check: simplistic eval replacement
            // Note: In a real "High-End" app we would use a proper expression parser library 
            // to avoid security risks of 'new Function'. 
            // For this mock/demo, we assume safe formulas.

            const func = new Function(...keys, `return ${cleanFormula};`);
            const result = func(...values);

            return isFinite(result) ? result : 0;
        } catch (error) {
            console.warn(`Error calculating metric ${metric.name}:`, error);
            return null;
        }
    }

    /**
     * Transforms a raw dataset by applying aliases and calculating metrics
     */
    transformData(data: any[]): any[] {
        if (!data.length) return [];

        return data.map(row => {
            const newRow: any = {};

            // 1. Apply aliases and copy raw data
            Object.keys(row).forEach(key => {
                const alias = this.aliases.get(key);
                if (alias) {
                    if (alias.visible) {
                        newRow[alias.alias] = row[key];
                    }
                } else {
                    newRow[key] = row[key];
                }
            });

            // 2. Calculate metrics
            // Note: We pass the ORIGINAL row to evaluateMetric so it finds the keys
            this.metrics.forEach(metric => {
                const val = this.evaluateMetric(metric.id, row);
                if (val !== null) {
                    newRow[metric.name] = val;
                }
            });

            return newRow;
        });
    }

    getMetrics() {
        return Array.from(this.metrics.values());
    }
}
