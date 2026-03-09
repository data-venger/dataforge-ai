export type ChartType = 'bar' | 'line' | 'pie' | null;

export interface ChartConfig {
    type: ChartType;
    xAxisKey: string;
    yAxisKeys: string[];
}

/**
 * Automatically detects if a SQL result set is suitable for charting.
 * Returns a ChartConfig if suitable, or null if it's better left as a table.
 */
export function detectChartConfig(data: any[]): ChartConfig | null {
    if (!data || data.length === 0 || data.length > 100) {
        // Too much data or no data -> stick to table
        return null;
    }

    const columns = Object.keys(data[0]);
    if (columns.length < 2 || columns.length > 5) {
        // Needs at least 1 dimension and 1 measure, but shouldn't be too wide
        return null;
    }

    // Classify columns
    const numericCols: string[] = [];
    const stringCols: string[] = [];
    const dateCols: string[] = []; // Potential future enhancement

    for (const col of columns) {
        const val = data[0][col];
        if (typeof val === 'number' || typeof val === 'bigint') {
            numericCols.push(col);
        } else if (typeof val === 'string') {
            // Very rudimentary date check
            if (!isNaN(Date.parse(val)) && val.includes('-')) {
                dateCols.push(col);
            } else {
                stringCols.push(col);
            }
        }
    }

    // Rule 1: We need at least one numeric column to chart
    if (numericCols.length === 0) return null;

    // Rule 2: Line chart check (Time series)
    if (dateCols.length === 1 && numericCols.length >= 1) {
        return {
            type: 'line',
            xAxisKey: dateCols[0],
            yAxisKeys: numericCols
        };
    }

    // Rule 3: Bar / Pie chart check (Categorical aggregation)
    if (stringCols.length === 1 && numericCols.length >= 1) {
        // If there's only 1 numeric measure and < 10 rows, Pie chart looks good
        if (numericCols.length === 1 && data.length <= 8) {
            return {
                type: 'pie',
                xAxisKey: stringCols[0],
                yAxisKeys: numericCols
            };
        }

        // Otherwise Bar chart
        return {
            type: 'bar',
            xAxisKey: stringCols[0],
            yAxisKeys: numericCols
        };
    }

    return null;
}
