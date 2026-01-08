const AnalysisPage = {
    oninit: () => {
        // Load saved queries from localStorage
        CustomAnalysisState.loadSavedQueries();
        
        // Initialize database
        DatabaseManager.init().catch(err => {
            console.error('Failed to initialize database:', err);
        });
    },
    
    renderChart: (vnode, data, chartType, customConfig = null, labelColumn = null, valueColumns = []) => {
        if (!data || data.length === 0) return null;
        
        const canvas = vnode.dom;
        if (!canvas) return;
        
        // Destroy existing chart
        if (CustomAnalysisState.chartInstance) {
            CustomAnalysisState.chartInstance.destroy();
        }
        
        // Use custom config if provided, otherwise auto-generate
        let config;
        if (customConfig) {
            try {
                config = typeof customConfig === 'string' 
                    ? JSON.parse(customConfig) 
                    : customConfig;
            } catch (e) {
                console.error('Invalid chart config:', e);
                config = null;
            }
        }
        
        if (!config) {
            const keys = Object.keys(data[0] || {});
            
            // Determine label column
            let labelKey = labelColumn;
            if (!labelKey) {
                // Auto-detect: first non-numeric column, or first column
                labelKey = keys.find(k => typeof data[0][k] === 'string') || keys[0];
            }
            
            // Determine value columns
            let valueKeys = valueColumns.length > 0 ? valueColumns : null;
            if (!valueKeys) {
                // Auto-detect: all numeric columns except 'id'
                valueKeys = keys.filter(k => {
                    const val = data[0][k];
                    return typeof val === 'number' && k !== 'id' && k !== labelKey;
                });
                // If no numeric columns found, use second column
                if (valueKeys.length === 0) {
                    valueKeys = [keys[1] || keys[0]];
                }
            }
            
            // Handle box plot (requires special data structure)
            if (chartType === 'boxplot') {
                const datasets = valueKeys.map((valueKey, idx) => {
                    const values = data.map(row => row[valueKey]).filter(v => typeof v === 'number' && !isNaN(v));
                    const sorted = [...values].sort((a, b) => a - b);
                    
                    const q1Index = Math.floor(sorted.length * 0.25);
                    const q2Index = Math.floor(sorted.length * 0.5);
                    const q3Index = Math.floor(sorted.length * 0.75);
                    
                    const q1 = sorted[q1Index];
                    const q2 = sorted[q2Index];
                    const q3 = sorted[q3Index];
                    const min = sorted[0];
                    const max = sorted[sorted.length - 1];
                    
                    return {
                        label: valueKey,
                        data: [{
                            x: valueKey,
                            min: min,
                            q1: q1,
                            median: q2,
                            q3: q3,
                            max: max,
                            outliers: []
                        }],
                        backgroundColor: ChartHelpers.generateColors(valueKeys.length)[idx]
                    };
                });
                
                config = {
                    type: 'boxplot',
                    data: {
                        labels: valueKeys,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: valueKeys.length > 1
                            }
                        }
                    }
                };
            } else {
                // Standard charts
                const labels = data.map(row => row[labelKey]);
                
                const datasets = valueKeys.map((valueKey, idx) => {
                    const values = data.map(row => row[valueKey] || 0);
                    const colors = ChartHelpers.generateColors(valueKeys.length);
                    
                    return {
                        label: valueKey,
                        data: values,
                        backgroundColor: ['line', 'radar'].includes(chartType) 
                            ? colors[idx].replace('0.7', '0.2')
                            : (valueKeys.length === 1 ? ChartHelpers.generateColors(values.length) : colors[idx]),
                        borderColor: colors[idx].replace('0.7', '1'),
                        borderWidth: 2,
                        fill: ['line', 'radar'].includes(chartType),
                        tension: 0,  // Changed to 0 to prevent curve interpolation
                        spanGaps: false  // Don't connect points with gaps
                    };
                });
                
                // Determine if X-axis data is categorical (strings) or numeric
                const isXAxisCategorical = typeof labels[0] === 'string';
                
                config = {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: ['doughnut', 'pie', 'polarArea'].includes(chartType) || valueKeys.length > 1
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false
                            }
                        },
                        scales: !['doughnut', 'pie', 'polarArea', 'radar'].includes(chartType) ? {
                            x: {
                                type: isXAxisCategorical ? 'category' : 'linear',
                                ticks: {
                                    // For categorical data, show all labels
                                    // For numeric data, only show integer values if data is discrete
                                    callback: function(value, index, ticks) {
                                        if (isXAxisCategorical) {
                                            return labels[index];
                                        }
                                        // For numeric x-axis, only show values that exist in data
                                        const label = labels[index];
                                        return label !== undefined ? label : '';
                                    },
                                    autoSkip: true,
                                    maxRotation: 45,
                                    minRotation: 0
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    // Only show integer ticks if all values are integers
                                    callback: function(value) {
                                        // Check if all data values are integers
                                        const allIntegers = datasets.every(ds => 
                                            ds.data.every(v => Number.isInteger(v) || v === 0)
                                        );
                                        if (allIntegers && Number.isInteger(value)) {
                                            return value;
                                        } else if (!allIntegers) {
                                            return value;
                                        }
                                        return null;
                                    }
                                }
                            }
                        } : undefined
                    }
                };
            }
        }
        
        CustomAnalysisState.chartInstance = new Chart(canvas, config);
    },
    
    view: () => m('div', { class: 'container mx-auto px-4 py-8' }, [
        m('h1', { class: 'text-3xl font-bold mb-6' }, 'Analysis'),
        
        // Main Layout: Sidebar + Content with independent scrolling
        m('div', { class: 'flex flex-col lg:flex-row gap-6', style: 'height: calc(100vh - 12rem);' }, [
            // Left Sidebar - Predefined & Saved Analyses (independently scrollable)
            m('div', { class: 'lg:w-80 flex-shrink-0 flex flex-col overflow-y-auto' }, [
                // Predefined Analyses (Expanded, Scrollable)
                m('div', { class: 'card bg-base-100 shadow-xl flex-1 flex flex-col' }, [
                    m('div', { class: 'card-body p-4 flex flex-col flex-1 min-h-0' }, [
                        m('h2', { class: 'card-title text-lg mb-2' }, 'Predefined Analyses'),
                        m('div', { class: 'overflow-y-auto flex-1' }, [
                            m('div', { class: 'space-y-1' },
                                PredefinedAnalyses.map(analysis => 
                                    m('div', { 
                                        class: `p-2 hover:bg-base-200 rounded cursor-pointer ${
                                            CustomAnalysisState.selectedAnalysisName === analysis.name 
                                                ? 'bg-primary text-primary-content' 
                                                : ''
                                        }`,
                                        onclick: () => {
                                            CustomAnalysisState.currentQuery = { ...analysis };
                                            CustomAnalysisState.selectedAnalysisName = analysis.name;
                                            CustomAnalysisState.executeQuery(analysis.sql);
                                        }
                                    }, [
                                        m('div', { class: 'font-medium text-sm' }, analysis.name),
                                        m('div', { class: 'flex gap-1 mt-1' }, [
                                            m('span', { class: 'badge badge-outline badge-xs' }, analysis.chartType),
                                            m('span', { class: 'badge badge-secondary badge-xs' }, analysis.category)
                                        ])
                                    ])
                                )
                            )
                        ])
                    ])
                ]),
                
                // Saved Queries
                CustomAnalysisState.savedQueries.length > 0 && m('div', { class: 'card bg-base-100 shadow-xl mt-6' }, [
                    m('div', { class: 'card-body p-4' }, [
                        m('h2', { class: 'card-title text-lg mb-2' }, 'Saved Queries'),
                        m('div', { class: 'overflow-y-auto max-h-96' }, [
                            m('div', { class: 'space-y-1' },
                                CustomAnalysisState.savedQueries.map(query => 
                                    m('div', { 
                                        class: `p-2 hover:bg-base-200 rounded ${
                                            CustomAnalysisState.selectedAnalysisName === query.name 
                                                ? 'bg-primary text-primary-content' 
                                                : ''
                                        }`
                                    }, [
                                        m('div', { class: 'font-medium text-sm' }, query.name),
                                        m('div', { class: 'text-xs opacity-70 mt-1' }, query.description),
                                        m('div', { class: 'flex gap-1 mt-2' }, [
                                            m('button', {
                                                class: 'btn btn-xs btn-ghost',
                                                onclick: () => {
                                                    CustomAnalysisState.currentQuery = { ...query };
                                                    CustomAnalysisState.selectedAnalysisName = query.name;
                                                    CustomAnalysisState.executeQuery(query.sql);
                                                }
                                            }, 'Load'),
                                            m('button', {
                                                class: 'btn btn-xs btn-ghost text-error',
                                                onclick: () => {
                                                    if (confirm(`Delete query "${query.name}"?`)) {
                                                        CustomAnalysisState.deleteQuery(query.id);
                                                        m.redraw();
                                                    }
                                                }
                                            }, 'Delete')
                                        ])
                                    ])
                                )
                            )
                        ])
                    ])
                ])
            ]),
            
            // Main Content Area (independently scrollable)
            m('div', { class: 'flex-1 overflow-y-auto' }, [
                // Query Results (Plot First!)
                CustomAnalysisState.queryResult && m('div', { class: 'card bg-base-100 shadow-xl mb-6' }, [
                    m('div', { class: 'card-body' }, [
                        
                        CustomAnalysisState.queryResult.success ? [
                            // Chart visualization (NO SUCCESS MESSAGE - just show chart)
                            CustomAnalysisState.queryResult.data.length > 0 && !CustomAnalysisState.queryResult.savedMessage && m('div', { class: 'mb-6' }, [
                                m('div', { class: 'chart-container' }, [
                                    m('canvas', {
                                        oncreate: (vnode) => {
                                            AnalysisPage.renderChart(
                                                vnode, 
                                                CustomAnalysisState.queryResult.data, 
                                                CustomAnalysisState.currentQuery.chartType,
                                                CustomAnalysisState.currentQuery.chartConfig,
                                                CustomAnalysisState.currentQuery.labelColumn,
                                                CustomAnalysisState.currentQuery.valueColumns
                                            );
                                        },
                                        onupdate: (vnode) => {
                                            AnalysisPage.renderChart(
                                                vnode, 
                                                CustomAnalysisState.queryResult.data, 
                                                CustomAnalysisState.currentQuery.chartType,
                                                CustomAnalysisState.currentQuery.chartConfig,
                                                CustomAnalysisState.currentQuery.labelColumn,
                                                CustomAnalysisState.currentQuery.valueColumns
                                            );
                                        }
                                    })
                                ])
                            ]),
                            
                            // SQL Query Display (removed statistical analysis)
                            CustomAnalysisState.currentQuery.sql && m('details', { class: 'collapse collapse-arrow bg-base-200 mb-4' }, [
                                m('summary', { class: 'collapse-title font-medium' }, '📝 SQL Query'),
                                m('div', { class: 'collapse-content' }, [
                                    m('pre', { class: 'bg-base-300 p-4 rounded text-xs overflow-x-auto' }, CustomAnalysisState.currentQuery.sql)
                                ])
                            ]),
                            
                            // Data table
                            CustomAnalysisState.queryResult.data.length > 0 && !CustomAnalysisState.queryResult.savedMessage && m('details', { class: 'collapse collapse-arrow bg-base-200' }, [
                                m('summary', { class: 'collapse-title font-medium' }, 'View Data Table'),
                                m('div', { class: 'collapse-content' }, [
                                    m('div', { class: 'overflow-x-auto' }, [
                                        m('table', { class: 'table table-zebra table-sm' }, [
                                            m('thead', [
                                                m('tr', 
                                                    Object.keys(CustomAnalysisState.queryResult.data[0] || {}).map(key => 
                                                        m('th', key)
                                                    )
                                                )
                                            ]),
                                            m('tbody',
                                                CustomAnalysisState.queryResult.data.slice(0, 100).map(row => 
                                                    m('tr',
                                                        Object.values(row).map(val => 
                                                            m('td', val)
                                                        )
                                                    )
                                                )
                                            )
                                        ])
                                    ]),
                                    CustomAnalysisState.queryResult.data.length > 100 && 
                                        m('div', { class: 'text-sm opacity-70 mt-2' }, 
                                            `Showing first 100 rows of ${CustomAnalysisState.queryResult.data.length}`
                                        )
                                ])
                            ])
                        ] : [
                            // Error message
                            m('div', { class: 'alert alert-error' }, [
                                m('svg', { xmlns: 'http://www.w3.org/2000/svg', class: 'stroke-current shrink-0 h-6 w-6', fill: 'none', viewBox: '0 0 24 24' }, [
                                    m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' })
                                ]),
                                m('span', CustomAnalysisState.queryResult.error)
                            ])
                        ]
                    ])
                ]),
                
                // Database Help Section (Collapsible)
                m('details', { class: 'collapse collapse-arrow bg-base-200 mb-6' }, [
                    m('summary', { class: 'collapse-title font-bold text-lg' }, '📖 Database Structure & Query Help'),
                    m('div', { class: 'collapse-content' }, [
                m('div', { class: 'prose max-w-none' }, [
                    m('h3', 'Main Tables'),
                    m('ul', [
                        m('li', [
                            m('strong', 'job_details'), ' - Main job postings table',
                            m('ul', [
                                m('li', 'Columns: id, posting_date, job_title, company_name, job_description, job_url, site'),
                                m('li', 'Salary: min_salary, max_salary, salary_currency_id, salary_period_id'),
                                m('li', 'Experience: experience_years'),
                                m('li', 'Foreign keys to lookup tables (see below)')
                            ])
                        ]),
                        m('li', [
                            m('strong', 'Lookup Tables'), ' - Normalized reference data',
                            m('ul', [
                                m('li', 'titles, companies, cities, regions, countries'),
                                m('li', 'job_functions, seniority_levels, industries, departments'),
                                m('li', 'employment_types, contract_types, work_schedules'),
                                m('li', 'remote_work_options, company_sizes, education_levels')
                            ])
                        ]),
                        m('li', [
                            m('strong', 'Skills & Benefits'), ' - Many-to-many relationships',
                            m('ul', [
                                m('li', 'hard_skills, soft_skills → job_details_hard_skills, job_details_soft_skills'),
                                m('li', 'benefits → job_details_benefits'),
                                m('li', 'certifications, licenses → job_details_certifications, job_details_licenses')
                            ])
                        ])
                    ]),
                    m('h3', 'Example Query Patterns'),
                    m('pre', { class: 'bg-base-300 p-4 rounded text-xs overflow-x-auto' }, `-- Count jobs by city
SELECT c.name, COUNT(*) as count
FROM job_details jd
JOIN cities c ON jd.city_id = c.id
GROUP BY c.name
ORDER BY count DESC

-- Average salary by seniority
SELECT sl.name, AVG(jd.min_salary) as avg_salary
FROM job_details jd
JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
WHERE jd.min_salary IS NOT NULL
GROUP BY sl.name

-- Top skills with job counts
SELECT hs.name, COUNT(DISTINCT jd.id) as jobs
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
GROUP BY hs.name
ORDER BY jobs DESC
LIMIT 20`),
                    m('h3', 'Tips'),
                    m('ul', [
                        m('li', 'Always use JOINs to get readable names from lookup tables'),
                        m('li', 'Use COUNT(DISTINCT jd.id) when joining many-to-many tables to avoid duplicates'),
                        m('li', 'Filter NULL values for salary/experience analysis'),
                        m('li', 'Use CASE statements to create salary ranges or experience buckets'),
                        m('li', 'LIMIT results for better chart readability (usually 10-20 items)')
                    ])
                ])
            ])
        ]),
                
                // Custom Query Builder
                m('div', { id: 'query-builder', class: 'card bg-base-100 shadow-xl mb-6' }, [
            m('div', { class: 'card-body' }, [
                m('div', { class: 'flex justify-between items-center mb-4' }, [
                    m('h2', { class: 'card-title' }, 'Custom Query Builder'),
                    m('button', {
                        class: 'btn btn-sm btn-outline',
                        onclick: () => {
                            navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
                            // Show temporary success message
                            const btn = event.target;
                            const originalText = btn.textContent;
                            btn.textContent = '✓ Copied!';
                            setTimeout(() => { btn.textContent = originalText; }, 2000);
                        }
                    }, '📋 Copy AI Prompt')
                ]),
                
                // Query Name
                m('div', { class: 'form-control' }, [
                    m('label', { class: 'label' }, m('span', { class: 'label-text' }, 'Query Name')),
                    m('input', {
                        type: 'text',
                        class: 'input input-bordered',
                        placeholder: 'My Custom Analysis',
                        value: CustomAnalysisState.currentQuery.name,
                        oninput: (e) => {
                            CustomAnalysisState.currentQuery.name = e.target.value;
                        }
                    })
                ]),
                
                // Query Description
                m('div', { class: 'form-control' }, [
                    m('label', { class: 'label' }, m('span', { class: 'label-text' }, 'Description')),
                    m('input', {
                        type: 'text',
                        class: 'input input-bordered',
                        placeholder: 'What does this query analyze?',
                        value: CustomAnalysisState.currentQuery.description,
                        oninput: (e) => {
                            CustomAnalysisState.currentQuery.description = e.target.value;
                        }
                    })
                ]),
                
                // SQL Query
                m('div', { class: 'form-control' }, [
                    m('label', { class: 'label' }, m('span', { class: 'label-text' }, 'SQL Query')),
                    m('textarea', {
                        class: 'textarea textarea-bordered font-mono text-sm h-40',
                        placeholder: 'SELECT ...',
                        value: CustomAnalysisState.currentQuery.sql,
                        oninput: (e) => {
                            CustomAnalysisState.currentQuery.sql = e.target.value;
                        }
                    })
                ]),
                
                // Chart Type
                m('div', { class: 'form-control' }, [
                    m('label', { class: 'label' }, m('span', { class: 'label-text' }, 'Chart Type')),
                    m('select', {
                        class: 'select select-bordered',
                        value: CustomAnalysisState.currentQuery.chartType,
                        onchange: (e) => {
                            CustomAnalysisState.currentQuery.chartType = e.target.value;
                        }
                    }, [
                        m('option', { value: 'bar' }, 'Bar Chart'),
                        m('option', { value: 'line' }, 'Line Chart'),
                        m('option', { value: 'doughnut' }, 'Doughnut Chart'),
                        m('option', { value: 'pie' }, 'Pie Chart'),
                        m('option', { value: 'scatter' }, 'Scatter Plot'),
                        m('option', { value: 'bubble' }, 'Bubble Chart'),
                        m('option', { value: 'radar' }, 'Radar Chart'),
                        m('option', { value: 'polarArea' }, 'Polar Area Chart'),
                        m('option', { value: 'boxplot' }, 'Box & Whisker Plot (Statistical)')
                    ])
                ]),
                
                // Column Selection (appears after query execution)
                CustomAnalysisState.queryResult && CustomAnalysisState.queryResult.data && CustomAnalysisState.queryResult.data.length > 0 && 
                    m('div', { class: 'form-control' }, [
                        m('label', { class: 'label' }, [
                            m('span', { class: 'label-text' }, 'Column Selection'),
                            m('span', { class: 'label-text-alt' }, 'Choose which columns to plot')
                        ]),
                        m('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-2' }, [
                            // Label Column Selector
                            m('div', { class: 'form-control' }, [
                                m('label', { class: 'label' }, m('span', { class: 'label-text text-xs' }, 'Label Column (X-axis)')),
                                m('select', {
                                    class: 'select select-bordered select-sm',
                                    value: CustomAnalysisState.currentQuery.labelColumn || '',
                                    onchange: (e) => {
                                        CustomAnalysisState.currentQuery.labelColumn = e.target.value || null;
                                        m.redraw();
                                    }
                                }, [
                                    m('option', { value: '' }, 'Auto-detect'),
                                    ...Object.keys(CustomAnalysisState.queryResult.data[0]).map(col => 
                                        m('option', { value: col }, col)
                                    )
                                ])
                            ]),
                            // Value Columns Selector
                            m('div', { class: 'form-control' }, [
                                m('label', { class: 'label' }, m('span', { class: 'label-text text-xs' }, 'Value Column(s) (Y-axis)')),
                                m('select', {
                                    class: 'select select-bordered select-sm',
                                    multiple: true,
                                    size: 3,
                                    value: CustomAnalysisState.currentQuery.valueColumns,
                                    onchange: (e) => {
                                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                                        CustomAnalysisState.currentQuery.valueColumns = selected;
                                        m.redraw();
                                    }
                                }, 
                                    Object.keys(CustomAnalysisState.queryResult.data[0]).map(col => 
                                        m('option', { value: col }, col)
                                    )
                                ),
                                m('div', { class: 'label' }, [
                                    m('span', { class: 'label-text-alt text-xs' }, 'Hold Ctrl/Cmd to select multiple. Leave empty for auto-detect.')
                                ])
                            ])
                        ])
                    ]),
                
                // Action Buttons
                m('div', { class: 'card-actions justify-end gap-2 mt-4' }, [
                    m('button', {
                        class: 'btn btn-primary',
                        onclick: () => {
                            if (!CustomAnalysisState.currentQuery.sql) {
                                // Will show error in query result section
                                CustomAnalysisState.queryResult = {
                                    success: false,
                                    error: 'Please enter a SQL query'
                                };
                                m.redraw();
                                return;
                            }
                            CustomAnalysisState.executeQuery(CustomAnalysisState.currentQuery.sql);
                        }
                    }, 'Execute Query'),
                    m('button', {
                        class: 'btn btn-secondary',
                        disabled: !CustomAnalysisState.currentQuery.name || !CustomAnalysisState.currentQuery.sql,
                        onclick: () => {
                            if (CustomAnalysisState.currentQuery.name && CustomAnalysisState.currentQuery.sql) {
                                CustomAnalysisState.addQuery(CustomAnalysisState.currentQuery);
                                // Show success message using alert component
                                CustomAnalysisState.queryResult = {
                                    success: true,
                                    data: [],
                                    rowCount: 0,
                                    savedMessage: 'Query saved successfully!'
                                };
                                m.redraw();
                            }
                        }
                    }, 'Save Query')
                ])
            ])
        ])
            ])
        ])
    ])
};
