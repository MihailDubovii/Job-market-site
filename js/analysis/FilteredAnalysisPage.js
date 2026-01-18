// Filtered Analysis Page - Uses OR logic for filters
const FilteredAnalysisPage = {
    // Tab state: 'analysis' or 'jobs'
    activeTab: 'analysis',
    
    oninit: () => {
        // Initialize database
        DatabaseManager.init().catch(err => {
            console.error('Failed to initialize database:', err);
        });
        
        // Load metadata for filter options
        if (!state.jobsIndex) {
            dbApi.getMetadata().then(metadata => {
                state.jobsIndex = metadata;
                m.redraw();
            });
        }
        
        // Reset to analysis tab
        FilteredAnalysisPage.activeTab = 'analysis';
    },
    
    view: () => m('div', { class: 'container mx-auto px-4 py-8' }, [
        m('h1', { class: 'text-3xl font-bold mb-2' }, 'Filtered Analysis'),
        m('p', { class: 'text-sm opacity-70 mb-6' }, 
            'Apply filters using OR logic - jobs matching ANY selected filter will be analyzed'
        ),
        
        // Main Layout: Filter Sidebar + Analysis Content
        m('div', { class: 'flex flex-col lg:flex-row gap-6' }, [
            // Left Sidebar - Filter Builder (no counts shown)
            m('div', { class: 'lg:w-80 flex-shrink-0' }, [
                m(FilteredAnalysisFilterPanel)
            ]),
            
            // Main Content Area - Tabs + Content
            m('div', { class: 'flex-1' }, [
                // Active Filters Display (as namespace tags)
                m(ActiveFiltersDisplay),
                
                // Tab Navigation (only show if filters are active)
                FilteredAnalysisState.getActiveFilterCount() > 0 && m('div', { class: 'tabs tabs-boxed mb-4' }, [
                    m('a', { 
                        class: `tab ${FilteredAnalysisPage.activeTab === 'analysis' ? 'tab-active' : ''}`,
                        onclick: () => {
                            FilteredAnalysisPage.activeTab = 'analysis';
                            m.redraw();
                        }
                    }, '📊 Analysis'),
                    m('a', { 
                        class: `tab ${FilteredAnalysisPage.activeTab === 'jobs' ? 'tab-active' : ''}`,
                        onclick: () => {
                            FilteredAnalysisPage.activeTab = 'jobs';
                            // Load filtered jobs when switching to jobs tab
                            FilteredAnalysisState.loadFilteredJobs();
                            m.redraw();
                        }
                    }, '📋 Job List')
                ]),
                
                // Tab Content
                FilteredAnalysisPage.activeTab === 'analysis' ? [
                    // Query Results (Analysis Tab)
                FilteredAnalysisState.queryResult && m('div', { class: 'card bg-base-100 shadow-xl mb-6' }, [
                    m('div', { class: 'card-body' }, [
                        FilteredAnalysisState.queryResult.success ? [
                            // Chart visualization
                            FilteredAnalysisState.queryResult.data.length > 0 && m('div', { class: 'mb-6' }, [
                                m('div', { class: 'chart-container' }, [
                                    m('canvas', {
                                        oncreate: (vnode) => {
                                            FilteredAnalysisPage.renderChart(
                                                vnode, 
                                                FilteredAnalysisState.queryResult.data, 
                                                FilteredAnalysisState.currentQuery.chartType
                                            );
                                        },
                                        onupdate: (vnode) => {
                                            FilteredAnalysisPage.renderChart(
                                                vnode, 
                                                FilteredAnalysisState.queryResult.data, 
                                                FilteredAnalysisState.currentQuery.chartType
                                            );
                                        }
                                    })
                                ])
                            ]),
                            
                            // SQL Query Display
                            FilteredAnalysisState.currentQuery.sql && m('details', { class: 'collapse collapse-arrow bg-base-200 mb-4' }, [
                                m('summary', { class: 'collapse-title font-medium' }, '📝 SQL Query'),
                                m('div', { class: 'collapse-content' }, [
                                    m('pre', { class: 'bg-base-300 p-4 rounded text-xs overflow-x-auto' }, 
                                        FilteredAnalysisState.currentQuery.sql
                                    )
                                ])
                            ]),
                            
                            // Data table
                            FilteredAnalysisState.queryResult.data.length > 0 && m('details', { class: 'collapse collapse-arrow bg-base-200' }, [
                                m('summary', { class: 'collapse-title font-medium' }, 'View Data Table'),
                                m('div', { class: 'collapse-content' }, [
                                    m('div', { class: 'overflow-x-auto' }, [
                                        m('table', { class: 'table table-zebra table-sm' }, [
                                            m('thead', [
                                                m('tr', 
                                                    Object.keys(FilteredAnalysisState.queryResult.data[0] || {}).map(key => 
                                                        m('th', key)
                                                    )
                                                )
                                            ]),
                                            m('tbody',
                                                FilteredAnalysisState.queryResult.data.slice(0, 100).map(row => 
                                                    m('tr',
                                                        Object.values(row).map(val => 
                                                            m('td', val)
                                                        )
                                                    )
                                                )
                                            )
                                        ])
                                    ]),
                                    FilteredAnalysisState.queryResult.data.length > 100 && 
                                        m('div', { class: 'text-sm opacity-70 mt-2' }, 
                                            `Showing first 100 rows of ${FilteredAnalysisState.queryResult.data.length}`
                                        )
                                ])
                            ])
                        ] : [
                            // Error message
                            m('div', { class: 'alert alert-error' }, [
                                m('svg', { xmlns: 'http://www.w3.org/2000/svg', class: 'stroke-current shrink-0 h-6 w-6', fill: 'none', viewBox: '0 0 24 24' }, [
                                    m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' })
                                ]),
                                m('span', FilteredAnalysisState.queryResult.error)
                            ])
                        ]
                    ])
                ]),
                
                // Predefined Filtered Analyses (Analysis Tab)
                m('div', { class: 'card bg-base-100 shadow-xl' }, [
                    m('div', { class: 'card-body' }, [
                        m('h2', { class: 'card-title mb-4' }, 'Predefined Analyses'),
                        m('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                            FilteredAnalyses.map(analysis => 
                                m('div', { 
                                    class: 'card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors',
                                    onclick: () => {
                                        FilteredAnalysisState.currentQuery = { ...analysis };
                                        FilteredAnalysisState.executeQuery();
                                    }
                                }, [
                                    m('div', { class: 'card-body p-4' }, [
                                        m('div', { class: 'font-medium' }, analysis.name),
                                        m('div', { class: 'text-xs opacity-70 mt-1' }, analysis.description),
                                        m('div', { class: 'flex gap-1 mt-2' }, [
                                            m('span', { class: 'badge badge-outline badge-xs' }, analysis.chartType)
                                        ])
                                    ])
                                ])
                            )
                        )
                    ])
                ])
                ] : [
                    // Job List Tab Content
                    m('div', { class: 'card bg-base-100 shadow-xl' }, [
                        m('div', { class: 'card-body' }, [
                            m('h2', { class: 'card-title mb-4' }, [
                                'Matching Jobs',
                                FilteredAnalysisState.filteredJobs.length > 0 && 
                                    m('span', { class: 'badge badge-info' }, FilteredAnalysisState.filteredJobs.length)
                            ]),
                            
                            // Job list
                            FilteredAnalysisState.filteredJobs.length > 0 ? 
                                m('div', { class: 'border border-base-300 rounded' },
                                    FilteredAnalysisState.filteredJobs.map((job, index) => 
                                        m(JobListItem, { job: job, index: index + 1 })
                                    )
                                ) : 
                                m('div', { class: 'alert alert-info' }, [
                                    m('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'stroke-current shrink-0 w-6 h-6' }, [
                                        m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
                                    ]),
                                    m('span', 'No jobs found matching your filters. Try adjusting your filters or switch to the Analysis tab.')
                                ])
                        ])
                    ])
                ]
            ])
        ])
    ]),
    
    renderChart: (vnode, data, chartType) => {
        if (!data || data.length === 0) return null;
        
        const canvas = vnode.dom;
        if (!canvas) return;
        
        // Destroy existing chart
        if (FilteredAnalysisState.chartInstance) {
            FilteredAnalysisState.chartInstance.destroy();
        }
        
        const keys = Object.keys(data[0] || {});
        
        // Determine label column (first non-numeric column, or first column)
        const labelKey = keys.find(k => typeof data[0][k] === 'string') || keys[0];
        
        // Determine value columns (all numeric columns except 'id')
        const valueKeys = keys.filter(k => {
            const val = data[0][k];
            return typeof val === 'number' && k !== 'id' && k !== labelKey;
        });
        
        // If no numeric columns found, use second column
        const finalValueKeys = valueKeys.length === 0 ? [keys[1] || keys[0]] : valueKeys;
        
        const labels = data.map(row => row[labelKey]);
        
        const datasets = finalValueKeys.map((valueKey, idx) => {
            const values = data.map(row => row[valueKey] || 0);
            const colors = ChartHelpers.generateColors(finalValueKeys.length);
            
            return {
                label: valueKey,
                data: values,
                backgroundColor: ['line', 'radar'].includes(chartType) 
                    ? colors[idx].replace('0.8', '0.2')
                    : (finalValueKeys.length === 1 ? ChartHelpers.generateColors(values.length) : colors[idx]),
                borderColor: colors[idx].replace('0.8', '1'),
                borderWidth: 2,
                fill: ['line', 'radar'].includes(chartType),
                tension: 0
            };
        });
        
        const config = {
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
                        display: ['doughnut', 'pie', 'polarArea'].includes(chartType) || finalValueKeys.length > 1
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: !['doughnut', 'pie', 'polarArea', 'radar'].includes(chartType) ? {
                    y: {
                        beginAtZero: true
                    }
                } : undefined
            }
        };
        
        FilteredAnalysisState.chartInstance = new Chart(canvas, config);
    }
};
