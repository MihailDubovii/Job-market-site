// Filter Panel for Filtered Analysis Page (searchbar based)
const FilteredAnalysisFilterPanel = {
    searchTerm: '',
    suggestions: [],
    suggestionsTimer: null,
    
    // Async function to fetch suggestions based on search term
    async fetchSuggestions() {
        if (!FilteredAnalysisFilterPanel.searchTerm || FilteredAnalysisFilterPanel.searchTerm.trim() === '') {
            FilteredAnalysisFilterPanel.suggestions = [];
            return;
        }
        
        try {
            const searchTerm = FilteredAnalysisFilterPanel.searchTerm.toLowerCase().trim();
            const suggestions = [];
            
            await DatabaseManager.init();
            
            // Map of filterable fields to their table and foreign key info
            const filterableFields = [
                { key: 'title', table: 'titles', foreignKey: 'title_id', column: 'name', label: 'Job Title' },
                { key: 'job_function', table: 'job_functions', foreignKey: 'job_function_id', column: 'name', label: 'Job Function' },
                { key: 'seniority_level', table: 'seniority_levels', foreignKey: 'seniority_level_id', column: 'name', label: 'Seniority Level' },
                { key: 'industry', table: 'industries', foreignKey: 'industry_id', column: 'name', label: 'Industry' },
                { key: 'city', table: 'cities', foreignKey: 'city_id', column: 'name', label: 'City' },
                { key: 'remote_work', table: 'remote_work_options', foreignKey: 'remote_work_id', column: 'name', label: 'Remote Work' },
                { key: 'company', table: 'companies', foreignKey: 'company_name_id', column: 'name', label: 'Company' },
                { key: 'employment_type', table: 'employment_types', foreignKey: 'employment_type_id', column: 'name', label: 'Employment Type' }
            ];
            
            // Many-to-many fields
            const m2mFields = [
                { key: 'hard_skills', table: 'hard_skills', column: 'name', label: 'Hard Skills' },
                { key: 'soft_skills', table: 'soft_skills', column: 'name', label: 'Soft Skills' }
            ];
            
            // Search across all filterable fields
            for (const fieldInfo of filterableFields) {
                const query = `
                    SELECT t.${fieldInfo.column} as value, COUNT(DISTINCT jd.id) as count
                    FROM job_details jd
                    LEFT JOIN ${fieldInfo.table} t ON jd.${fieldInfo.foreignKey} = t.id
                    WHERE LOWER(t.${fieldInfo.column}) LIKE ?
                    GROUP BY t.${fieldInfo.column}
                    HAVING count > 0
                    ORDER BY count DESC, t.${fieldInfo.column}
                    LIMIT 5
                `;
                
                const results = DatabaseManager.queryObjects(query, [`%${searchTerm}%`]);
                
                results.forEach(row => {
                    suggestions.push({
                        value: row.value,
                        count: row.count,
                        field: fieldInfo.key,
                        fieldName: fieldInfo.label,
                        fieldDisplay: fieldInfo.label
                    });
                });
            }
            
            // Search across many-to-many fields
            for (const fieldInfo of m2mFields) {
                const query = `
                    SELECT t.${fieldInfo.column} as value, COUNT(DISTINCT jd.id) as count
                    FROM job_details jd
                    JOIN job_details_${fieldInfo.table} jm ON jd.id = jm.job_details_id
                    JOIN ${fieldInfo.table} t ON jm.${fieldInfo.table}_id = t.id
                    WHERE LOWER(t.${fieldInfo.column}) LIKE ?
                    GROUP BY t.${fieldInfo.column}
                    HAVING count > 0
                    ORDER BY count DESC, t.${fieldInfo.column}
                    LIMIT 5
                `;
                
                const results = DatabaseManager.queryObjects(query, [`%${searchTerm}%`]);
                
                results.forEach(row => {
                    suggestions.push({
                        value: row.value,
                        count: row.count,
                        field: fieldInfo.key,
                        fieldName: fieldInfo.label,
                        fieldDisplay: fieldInfo.label
                    });
                });
            }
            
            // Sort suggestions by relevance
            suggestions.sort((a, b) => {
                const aLower = a.value.toLowerCase();
                const bLower = b.value.toLowerCase();
                const searchLower = searchTerm.toLowerCase();
                
                // Exact match first
                if (aLower === searchLower && bLower !== searchLower) return -1;
                if (bLower === searchLower && aLower !== searchLower) return 1;
                
                // Starts with
                if (aLower.startsWith(searchLower) && !bLower.startsWith(searchLower)) return -1;
                if (bLower.startsWith(searchLower) && !aLower.startsWith(searchLower)) return 1;
                
                // Sort by count
                return b.count - a.count;
            });
            
            // Filter out already selected values
            const filteredSuggestions = suggestions.filter(suggestion => {
                const activeFilters = FilteredAnalysisState.filters[suggestion.field] || [];
                return !activeFilters.some(f => f.value === suggestion.value);
            });
            
            FilteredAnalysisFilterPanel.suggestions = filteredSuggestions.slice(0, 10);
            m.redraw();
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            FilteredAnalysisFilterPanel.suggestions = [];
        }
    },
    
    view: () => {
        if (!state.jobsIndex) return m(Loading);
        
        const applySearchAsFilter = (suggestion = null) => {
            if (!FilteredAnalysisFilterPanel.searchTerm && !suggestion) return;
            
            if (suggestion) {
                // Add the suggested filter
                FilteredAnalysisState.addFilter(suggestion.field, suggestion.value, suggestion.fieldDisplay);
                FilteredAnalysisFilterPanel.searchTerm = '';
                FilteredAnalysisFilterPanel.suggestions = [];
            }
            m.redraw();
        };
        
        return m('div', { class: 'card bg-base-100 shadow-xl' }, [
            m('div', { class: 'card-body p-4' }, [
                m('div', { class: 'flex justify-between items-center mb-4' }, [
                    m('h3', { class: 'font-bold text-lg' }, 'Add Filters'),
                    FilteredAnalysisState.getActiveFilterCount() > 0 && m('button', { 
                        class: 'btn btn-xs btn-ghost',
                        onclick: () => {
                            FilteredAnalysisState.clearAllFilters();
                            m.redraw();
                        }
                    }, 'Clear All')
                ]),
                
                m('div', { class: 'alert alert-info mb-4' }, [
                    m('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'stroke-current shrink-0 w-6 h-6' }, [
                        m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
                    ]),
                    m('div', { class: 'text-xs' }, [
                        m('div', { class: 'font-bold' }, 'OR Logic'),
                        m('div', 'Jobs matching ANY selected filter will be analyzed')
                    ])
                ]),
                
                // Search box for adding filters
                m('div', { class: 'form-control mb-4 relative' }, [
                    m('label', { class: 'label' }, m('span', { class: 'label-text font-semibold' }, 'Search & Add Filters')),
                    m('div', { class: 'relative' }, [
                        m('input', { 
                            type: 'text',
                            class: `input input-bordered input-sm w-full ${FilteredAnalysisFilterPanel.searchTerm ? 'input-info' : ''}`,
                            placeholder: 'Type to search: job title, city, skills, industry...',
                            value: FilteredAnalysisFilterPanel.searchTerm || '',
                            oninput: (e) => {
                                FilteredAnalysisFilterPanel.searchTerm = e.target.value;
                                // Debounce suggestions fetching
                                clearTimeout(FilteredAnalysisFilterPanel.suggestionsTimer);
                                FilteredAnalysisFilterPanel.suggestionsTimer = setTimeout(() => {
                                    FilteredAnalysisFilterPanel.fetchSuggestions();
                                }, 300);
                                m.redraw();
                            },
                            onkeypress: (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    // Add first suggestion if available
                                    const suggestions = FilteredAnalysisFilterPanel.suggestions;
                                    if (suggestions.length > 0) {
                                        applySearchAsFilter(suggestions[0]);
                                    }
                                }
                            },
                            onfocus: (e) => {
                                if (!FilteredAnalysisFilterPanel.searchTerm) {
                                    e.target.placeholder = 'Type and press Enter or click suggestion...';
                                }
                            },
                            onblur: (e) => {
                                // Delay to allow clicking on suggestions
                                setTimeout(() => {
                                    e.target.placeholder = 'Type to search: job title, city, skills, industry...';
                                }, 200);
                            }
                        }),
                        // Suggestions dropdown
                        (() => {
                            const suggestions = FilteredAnalysisFilterPanel.suggestions;
                            if (suggestions.length === 0 || !FilteredAnalysisFilterPanel.searchTerm) return null;
                            
                            return m('div', { 
                                class: 'absolute top-full left-0 right-0 bg-base-100 border border-base-300 rounded-box shadow-lg z-50 max-h-60 overflow-y-auto',
                                style: 'margin-top: 2px;'
                            }, [
                                suggestions.map(suggestion => 
                                    m('button', {
                                        class: 'w-full text-left px-4 py-2 hover:bg-base-200 text-sm',
                                        onclick: (e) => {
                                            e.preventDefault();
                                            applySearchAsFilter(suggestion);
                                        },
                                        title: `Add "${suggestion.value}" as ${suggestion.fieldDisplay} filter`
                                    }, [
                                        m('div', { class: 'flex justify-between items-center' }, [
                                            m('div', [
                                                m('div', { class: 'font-medium text-base-content' }, suggestion.value),
                                                m('div', { class: 'text-xs opacity-70' }, `Add as: ${suggestion.fieldDisplay}`)
                                            ]),
                                            m('div', { class: 'badge badge-sm badge-info' }, suggestion.count)
                                        ])
                                    ])
                                )
                            ]);
                        })()
                    ])
                ]),
                
                m('div', { class: 'text-xs opacity-70 mb-4' }, [
                    m('div', '💡 Tip: Search for any term and select from suggestions to add multiple filters'),
                    m('div', '📌 You can add multiple values for the same field (e.g., multiple job titles)')
                ])
            ])
        ]);
    }
};

// Active Filters Display Component
const ActiveFiltersDisplay = {
    view: () => {
        const filters = FilteredAnalysisState.filters;
        const filterCount = FilteredAnalysisState.getActiveFilterCount();
        
        if (filterCount === 0) {
            return m('div', { class: 'alert mb-6' }, [
                m('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'stroke-info shrink-0 w-6 h-6' }, [
                    m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
                ]),
                m('span', 'No filters applied. Search and add filters from the sidebar, or run a predefined analysis.')
            ]);
        }
        
        return m('div', { class: 'card bg-base-100 shadow-xl mb-6' }, [
            m('div', { class: 'card-body p-4' }, [
                m('div', { class: 'flex justify-between items-center mb-3' }, [
                    m('h3', { class: 'font-bold' }, 'Active Filters'),
                    m('span', { class: 'badge badge-info' }, `${filterCount} filter${filterCount !== 1 ? 's' : ''}`)
                ]),
                m('div', { class: 'space-y-2' },
                    Object.entries(filters).map(([field, filterValues]) =>
                        m('div', { class: 'space-y-1' },
                            filterValues.map(filter =>
                                m('div', { 
                                    class: 'badge badge-lg badge-outline gap-2 cursor-pointer hover:badge-error',
                                    onclick: () => {
                                        FilteredAnalysisState.removeFilter(field, filter.value);
                                        m.redraw();
                                    },
                                    title: 'Click to remove'
                                }, [
                                    m('span', { class: 'font-mono text-xs' }, `${filter.label} == "${filter.value}"`),
                                    m('svg', { 
                                        xmlns: 'http://www.w3.org/2000/svg', 
                                        fill: 'none', 
                                        viewBox: '0 0 24 24', 
                                        class: 'inline-block w-4 h-4 stroke-current'
                                    }, [
                                        m('path', { 
                                            'stroke-linecap': 'round', 
                                            'stroke-linejoin': 'round', 
                                            'stroke-width': '2', 
                                            d: 'M6 18L18 6M6 6l12 12'
                                        })
                                    ])
                                ])
                            )
                        )
                    )
                ),
                m('button', { 
                    class: 'btn btn-sm btn-primary mt-4',
                    onclick: () => FilteredAnalysisState.executeQuery()
                }, 'Run Analysis with Filters')
            ])
        ]);
    }
};
