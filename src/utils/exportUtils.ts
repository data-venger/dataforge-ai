/**
 * Converts an array of objects to a CSV string and triggers a browser download.
 */
export function exportToCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;

    const columns = Object.keys(data[0]);

    // Create CSV Header
    let csvContent = columns.map(col => `"${String(col).replace(/"/g, '""')}"`).join(',') + '\n';

    // Create CSV Rows
    data.forEach(row => {
        csvContent += columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',') + '\n';
    });

    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
