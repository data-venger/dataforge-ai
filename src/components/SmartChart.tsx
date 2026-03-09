import {
    BarChart, Bar,
    LineChart, Line,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { ChartConfig } from '../utils/chartDetector';

interface SmartChartProps {
    data: any[];
    config: ChartConfig;
}

const COLORS = [
    'var(--accent-primary)',
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#EC4899', // Pink
    '#06B6D4', // Cyan
];

export function SmartChart({ data, config }: SmartChartProps) {
    if (!data || !config || data.length === 0) return null;

    const { type, xAxisKey, yAxisKeys } = config;

    // Convert bigints to numbers for recharts compatibility
    const normalizedData = data.map(row => {
        const newRow = { ...row };
        for (const key of yAxisKeys) {
            if (typeof newRow[key] === 'bigint') {
                newRow[key] = Number(newRow[key]);
            }
        }
        return newRow;
    });

    // Formatting helpers
    const formatXAxis = (tickItem: any) => {
        if (typeof tickItem === 'string' && tickItem.length > 15) {
            return tickItem.substring(0, 15) + '...';
        }
        return tickItem;
    };

    const renderChart = () => {
        switch (type) {
            case 'bar':
                return (
                    <BarChart data={normalizedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke="var(--text-muted)"
                            tickFormatter={formatXAxis}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis stroke="var(--text-muted)" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {yAxisKeys.map((key, index) => (
                            <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                    </BarChart>
                );

            case 'line':
                return (
                    <LineChart data={normalizedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis
                            dataKey={xAxisKey}
                            stroke="var(--text-muted)"
                            tickFormatter={formatXAxis}
                        />
                        <YAxis stroke="var(--text-muted)" />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                        />
                        <Legend />
                        {yAxisKeys.map((key, index) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={3}
                                dot={{ r: 4, fill: COLORS[index % COLORS.length] }}
                                activeDot={{ r: 6 }}
                            />
                        ))}
                    </LineChart>
                );

            case 'pie':
                const pieDataKey = yAxisKeys[0]; // Pie charts only use the first measure
                return (
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Pie
                            data={normalizedData}
                            nameKey={xAxisKey}
                            dataKey={pieDataKey}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            label={({ name, percent }) => `${formatXAxis(name)} (${((percent || 0) * 100).toFixed(0)}%)`}
                            labelLine={false}
                        >
                            {normalizedData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--bg-surface)" strokeWidth={2} />
                            ))}
                        </Pie>
                    </PieChart>
                );

            default:
                return null;
        }
    };

    return (
        <div className="smart-chart-container" style={{ width: '100%', height: 400, marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
                {renderChart() as React.ReactElement}
            </ResponsiveContainer>
        </div>
    );
}
