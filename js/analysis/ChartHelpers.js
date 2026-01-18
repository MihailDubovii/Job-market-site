const ChartHelpers = {
    createChart: (canvas, config) => {
        if (!canvas) return null;
        // Destroy existing chart if present
        if (canvas.chart) {
            canvas.chart.destroy();
        }
        canvas.chart = new Chart(canvas, config);
        return canvas.chart;
    },
    destroyChart: (canvas) => {
        if (canvas && canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
    },
    formatTitle: (key) => {
        // Remove 'by_' prefix and format title
        return key.includes('by_') ? 
            key.replace('by_', '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) :
            key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    extractLabel: (item) => {
        // Use centralized field mapping for consistency
        return FieldMapping.extractLabel(item);
    },
    generateColors: (count) => {
        // Generate an array of distinct colors for charts with better visibility
        // Use a predefined palette for common cases, then generate more if needed
        const distinctColors = [
            'hsla(0, 70%, 60%, 0.8)',    // Red
            'hsla(210, 70%, 60%, 0.8)',  // Blue
            'hsla(120, 70%, 50%, 0.8)',  // Green
            'hsla(45, 85%, 60%, 0.8)',   // Orange/Yellow
            'hsla(280, 70%, 60%, 0.8)',  // Purple
            'hsla(180, 70%, 50%, 0.8)',  // Cyan
            'hsla(330, 70%, 60%, 0.8)',  // Pink
            'hsla(160, 70%, 50%, 0.8)',  // Teal
            'hsla(30, 80%, 60%, 0.8)',   // Orange
            'hsla(240, 70%, 60%, 0.8)',  // Indigo
            'hsla(90, 60%, 50%, 0.8)',   // Lime
            'hsla(300, 70%, 60%, 0.8)',  // Magenta
            'hsla(60, 70%, 60%, 0.8)',   // Yellow
            'hsla(195, 70%, 60%, 0.8)',  // Light Blue
            'hsla(15, 75%, 60%, 0.8)'    // Coral
        ];
        
        if (count <= distinctColors.length) {
            return distinctColors.slice(0, count);
        }
        
        // If we need more colors, generate them with good spacing
        return Array.from({ length: count }, (_, i) => {
            if (i < distinctColors.length) {
                return distinctColors[i];
            }
            const hue = ((i - distinctColors.length) * 360 / (count - distinctColors.length));
            return `hsla(${hue}, 70%, 60%, 0.8)`;
        });
    }
};

