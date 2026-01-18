const FilterPanel = {
    showAdvanced: false,
    salaryMinTimer: null,
    salaryMaxTimer: null,
    experienceMinTimer: null,
    experienceMaxTimer: null,
    filterCounts: {}, // Store dynamic filter counts
    suggestions: [], // Store filter suggestions
    suggestionsTimer: null,
    
    // Async function to get counts for a specific field
    async getCountsForField(fieldKey) {
        try {
            const counts = await dbApi.getFilteredCounts(fieldKey, state.filters);
            FilterPanel.filterCounts[fieldKey] = counts;
            m.redraw();
        } catch (error) {
            console.error(`Error getting counts for ${fieldKey}:`, error);
            FilterPanel.filterCounts[fieldKey] = [];
        }
    },
    
    // Async function to fetch suggestions
    async fetchSuggestions() {
        if (!state.search || state.search.trim() === '') {
            FilterPanel.suggestions = [];
            return;
        }
        
        try {
            const searchTerm = state.search.toLowerCase().trim();
            const suggestions = [];
            
            await DatabaseManager.init();
            
            // Map of filterable fields to their table and foreign key info
            // Single-select fields (many-to-one relationships)
            const filterableFields = [
                { key: 'title', table: 'titles', foreignKey: 'title_id', column: 'name', label: 'Job Title' },
                { key: 'job_function', table: 'job_functions', foreignKey: 'job_function_id', column: 'name', label: 'Job Function' },
                { key: 'seniority_level', table: 'seniority_levels', foreignKey: 'seniority_level_id', column: 'name', label: 'Seniority Level' },
                { key: 'industry', table: 'industries', foreignKey: 'industry_id', column: 'name', label: 'Industry' },
                { key: 'department', table: 'departments', foreignKey: 'department_id', column: 'name', label: 'Department' },
                { key: 'job_family', table: 'job_families', foreignKey: 'job_family_id', column: 'name', label: 'Job Family' },
                { key: 'specialization', table: 'specializations', foreignKey: 'specialization_id', column: 'name', label: 'Specialization' },
                { key: 'education_level', table: 'education_levels', foreignKey: 'required_education_id', column: 'name', label: 'Education Level' },
                { key: 'employment_type', table: 'employment_types', foreignKey: 'employment_type_id', column: 'name', label: 'Employment Type' },
                { key: 'contract_type', table: 'contract_types', foreignKey: 'contract_type_id', column: 'name', label: 'Contract Type' },
                { key: 'work_schedule', table: 'work_schedules', foreignKey: 'work_schedule_id', column: 'name', label: 'Work Schedule' },
                { key: 'shift_details', table: 'shift_details', foreignKey: 'shift_details_id', column: 'name', label: 'Shift Details' },
                { key: 'remote_work', table: 'remote_work_options', foreignKey: 'remote_work_id', column: 'name', label: 'Remote Work' },
                { key: 'travel_required', table: 'travel_requirements', foreignKey: 'travel_required_id', column: 'name', label: 'Travel Required' },
                { key: 'city', table: 'cities', foreignKey: 'city_id', column: 'name', label: 'City' },
                { key: 'region', table: 'regions', foreignKey: 'region_id', column: 'name', label: 'Region' },
                { key: 'country', table: 'countries', foreignKey: 'country_id', column: 'name', label: 'Country' },
                { key: 'company', table: 'companies', foreignKey: 'company_name_id', column: 'name', label: 'Company' },
                { key: 'company_size', table: 'company_sizes', foreignKey: 'company_size_id', column: 'name', label: 'Company Size' }
            ];
            
            // Many-to-many fields (multi-select)
            const m2mFields = [
                { key: 'hard_skills', table: 'hard_skills', column: 'name', label: 'Hard Skills' },
                { key: 'soft_skills', table: 'soft_skills', column: 'name', label: 'Soft Skills' },
                { key: 'certifications', table: 'certifications', column: 'name', label: 'Certifications' },
                { key: 'licenses_required', table: 'licenses', column: 'name', label: 'Licenses' },
                { key: 'benefits', table: 'benefits', column: 'description', label: 'Benefits' },
                { key: 'work_environment', table: 'work_environment', column: 'description', label: 'Work Environment' },
                { key: 'professional_development', table: 'professional_development', column: 'description', label: 'Professional Development' },
                { key: 'work_life_balance', table: 'work_life_balance', column: 'description', label: 'Work-Life Balance' },
                { key: 'physical_requirements', table: 'physical_requirements', column: 'description', label: 'Physical Requirements' },
                { key: 'work_conditions', table: 'work_conditions', column: 'description', label: 'Work Conditions' },
                { key: 'special_requirements', table: 'special_requirements', column: 'description', label: 'Special Requirements' }
            ];
            
            // One-to-many fields (like languages)
            const oneToManyFields = [
                { key: 'languages', table: 'job_languages', column: 'language', foreignKey: 'job_detail_id', label: 'Languages' }
            ];
            
            // Search across all single-select filterable fields with counts
            for (const fieldInfo of filterableFields) {
                // Build WHERE clause for current active filters (excluding this field)
                const filtersWithoutCurrent = { ...state.filters };
                delete filtersWithoutCurrent[fieldInfo.key];
                
                const { whereClause, params } = dbApi.buildWhereClause(filtersWithoutCurrent, '');
                
                // Query with JOIN to count actual jobs
                const query = `
                    SELECT t.${fieldInfo.column} as value, COUNT(DISTINCT jd.id) as count
                    FROM job_details jd
                    LEFT JOIN titles ti ON jd.title_id = ti.id
                    LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
                    LEFT JOIN specializations sp ON jd.specialization_id = sp.id
                    LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
                    LEFT JOIN companies c ON jd.company_name_id = c.id
                    LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
                    LEFT JOIN cities ci ON jd.city_id = ci.id
                    LEFT JOIN regions reg ON jd.region_id = reg.id
                    LEFT JOIN countries cou ON jd.country_id = cou.id
                    LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
                    LEFT JOIN employment_types et ON jd.employment_type_id = et.id
                    LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
                    LEFT JOIN departments d ON jd.department_id = d.id
                    LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
                    LEFT JOIN education_levels el ON jd.required_education_id = el.id
                    LEFT JOIN industries ind ON jd.industry_id = ind.id
                    LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
                    LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
                    LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
                    LEFT JOIN ${fieldInfo.table} t ON jd.${fieldInfo.foreignKey} = t.id
                    ${whereClause}
                    ${whereClause ? 'AND' : 'WHERE'} LOWER(t.${fieldInfo.column}) LIKE ?
                    GROUP BY t.${fieldInfo.column}
                    HAVING count > 0
                    ORDER BY count DESC, t.${fieldInfo.column}
                    LIMIT 3
                `;
                
                const results = DatabaseManager.queryObjects(query, [...params, `%${searchTerm}%`]);
                
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
                // Build WHERE clause for current active filters (excluding this field)
                const filtersWithoutCurrent = { ...state.filters };
                delete filtersWithoutCurrent[fieldInfo.key];
                
                const { whereClause, params } = dbApi.buildWhereClause(filtersWithoutCurrent, '');
                
                // Query for many-to-many relationships
                const query = `
                    SELECT t.${fieldInfo.column} as value, COUNT(DISTINCT jd.id) as count
                    FROM job_details jd
                    LEFT JOIN titles ti ON jd.title_id = ti.id
                    LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
                    LEFT JOIN specializations sp ON jd.specialization_id = sp.id
                    LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
                    LEFT JOIN companies c ON jd.company_name_id = c.id
                    LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
                    LEFT JOIN cities ci ON jd.city_id = ci.id
                    LEFT JOIN regions reg ON jd.region_id = reg.id
                    LEFT JOIN countries cou ON jd.country_id = cou.id
                    LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
                    LEFT JOIN employment_types et ON jd.employment_type_id = et.id
                    LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
                    LEFT JOIN departments d ON jd.department_id = d.id
                    LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
                    LEFT JOIN education_levels el ON jd.required_education_id = el.id
                    LEFT JOIN industries ind ON jd.industry_id = ind.id
                    LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
                    LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
                    LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
                    JOIN job_details_${fieldInfo.table} jm ON jd.id = jm.job_details_id
                    JOIN ${fieldInfo.table} t ON jm.${fieldInfo.table}_id = t.id
                    ${whereClause}
                    ${whereClause ? 'AND' : 'WHERE'} LOWER(t.${fieldInfo.column}) LIKE ?
                    GROUP BY t.${fieldInfo.column}
                    HAVING count > 0
                    ORDER BY count DESC, t.${fieldInfo.column}
                    LIMIT 3
                `;
                
                const results = DatabaseManager.queryObjects(query, [...params, `%${searchTerm}%`]);
                
                results.forEach(row => {
                    suggestions.push({
                        value: row.value,
                        count: row.count,
                        field: fieldInfo.key,
                        fieldName: fieldInfo.label,
                        fieldDisplay: fieldInfo.label,
                        isMultiSelect: true  // Mark as multi-select field
                    });
                });
            }
            
            // Search across one-to-many fields (like languages)
            for (const fieldInfo of oneToManyFields) {
                // Build WHERE clause for current active filters (excluding this field)
                const filtersWithoutCurrent = { ...state.filters };
                delete filtersWithoutCurrent[fieldInfo.key];
                
                const { whereClause, params } = dbApi.buildWhereClause(filtersWithoutCurrent, '');
                
                // Query for one-to-many relationships
                const query = `
                    SELECT t.${fieldInfo.column} as value, COUNT(DISTINCT jd.id) as count
                    FROM job_details jd
                    LEFT JOIN titles ti ON jd.title_id = ti.id
                    LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
                    LEFT JOIN specializations sp ON jd.specialization_id = sp.id
                    LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
                    LEFT JOIN companies c ON jd.company_name_id = c.id
                    LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
                    LEFT JOIN cities ci ON jd.city_id = ci.id
                    LEFT JOIN regions reg ON jd.region_id = reg.id
                    LEFT JOIN countries cou ON jd.country_id = cou.id
                    LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
                    LEFT JOIN employment_types et ON jd.employment_type_id = et.id
                    LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
                    LEFT JOIN departments d ON jd.department_id = d.id
                    LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
                    LEFT JOIN education_levels el ON jd.required_education_id = el.id
                    LEFT JOIN industries ind ON jd.industry_id = ind.id
                    LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
                    LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
                    LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
                    JOIN ${fieldInfo.table} t ON jd.id = t.${fieldInfo.foreignKey}
                    ${whereClause}
                    ${whereClause ? 'AND' : 'WHERE'} LOWER(t.${fieldInfo.column}) LIKE ?
                    GROUP BY t.${fieldInfo.column}
                    HAVING count > 0
                    ORDER BY count DESC, t.${fieldInfo.column}
                    LIMIT 3
                `;
                
                const results = DatabaseManager.queryObjects(query, [...params, `%${searchTerm}%`]);
                
                results.forEach(row => {
                    suggestions.push({
                        value: row.value,
                        count: row.count,
                        field: fieldInfo.key,
                        fieldName: fieldInfo.label,
                        fieldDisplay: fieldInfo.label,
                        isMultiSelect: true  // Mark as multi-select field
                    });
                });
            }
            
            // Sort suggestions by relevance (exact match, then starts with, then by count)
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
                
                // Sort by count (higher counts first)
                return b.count - a.count;
            });
            
            FilterPanel.suggestions = suggestions.slice(0, 10);
            m.redraw();
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            FilterPanel.suggestions = [];
        }
    },
    
    view: () => {
        if (!state.jobsIndex) return null;
        
        // Calculate salary range - use reasonable defaults
        const salaryRange = { min: 0, max: 100000 };
        
        // All available filter fields - organized following schema order
        // Excludes non-filterable fields like contact info
        const filterFields = [
            // Job Details
            { key: 'title', label: 'Job Title', section: 'Job Details' },
            { key: 'seniority_level', label: 'Seniority Level', section: 'Job Details' },
            { key: 'industry', label: 'Industry', section: 'Job Details' },
            { key: 'department', label: 'Department', section: 'Job Details' },
            { key: 'job_family', label: 'Job Family', section: 'Job Details' },
            { key: 'specialization', label: 'Specialization', section: 'Job Details' },
            { key: 'job_function', label: 'Job Function', section: 'Job Details' },
            
            // Requirements
            { key: 'education_level', label: 'Required Education', section: 'Requirements' },
            { key: 'languages', label: 'Languages', section: 'Requirements' },
            { key: 'hard_skills', label: 'Hard Skills', section: 'Requirements' },
            { key: 'soft_skills', label: 'Soft Skills', section: 'Requirements' },
            { key: 'certifications', label: 'Certifications', section: 'Requirements' },
            { key: 'licenses_required', label: 'Licenses', section: 'Requirements' },
            
            // Work Arrangement
            { key: 'employment_type', label: 'Employment Type', section: 'Work Arrangement' },
            { key: 'contract_type', label: 'Contract Type', section: 'Work Arrangement' },
            { key: 'work_schedule', label: 'Work Schedule', section: 'Work Arrangement' },
            { key: 'shift_details', label: 'Shift Details', section: 'Work Arrangement' },
            { key: 'remote_work', label: 'Remote Work', section: 'Work Arrangement' },
            { key: 'travel_required', label: 'Travel Required', section: 'Work Arrangement' },
            
            // Location
            { key: 'city', label: 'City', section: 'Location' },
            { key: 'region', label: 'Region', section: 'Location' },
            { key: 'country', label: 'Country', section: 'Location' },
            
            // Company
            { key: 'company', label: 'Company Name', section: 'Company' },
            { key: 'company_size', label: 'Company Size', section: 'Company' },
            
            // Benefits & Culture
            { key: 'benefits', label: 'Benefits', section: 'Benefits & Culture' },
            { key: 'work_environment', label: 'Work Environment', section: 'Benefits & Culture' },
            { key: 'professional_development', label: 'Professional Development', section: 'Benefits & Culture' },
            { key: 'work_life_balance', label: 'Work Life Balance', section: 'Benefits & Culture' },
            
            // Conditions
            { key: 'physical_requirements', label: 'Physical Requirements', section: 'Conditions' },
            { key: 'work_conditions', label: 'Work Conditions', section: 'Conditions' },
            { key: 'special_requirements', label: 'Special Requirements', section: 'Conditions' }
        ];
        
        const handleFilterChange = async () => {
            JobsPage.displayPage = 1;
            
            // Update URL with new filter state
            URLState.update();
            
            // Reload jobs with new filters
            await JobsPage.loadJobs();
            m.redraw();
        };
        
        // Function to apply search as filter
        const applySearchAsFilter = async (suggestion = null) => {
            if (!state.search || state.search.trim() === '') return;
            
            // If suggestion provided, use it
            if (suggestion) {
                // Handle multi-select fields differently
                if (suggestion.isMultiSelect) {
                    // For multi-select fields, add to array if not already present
                    if (!state.filters[suggestion.field]) {
                        state.filters[suggestion.field] = [];
                    }
                    if (!Array.isArray(state.filters[suggestion.field])) {
                        // Convert existing value to array, filtering out null/undefined
                        const existingValue = state.filters[suggestion.field];
                        state.filters[suggestion.field] = existingValue ? [existingValue] : [];
                    }
                    // Add value if not already in the array
                    if (!state.filters[suggestion.field].includes(suggestion.value)) {
                        state.filters[suggestion.field].push(suggestion.value);
                    }
                } else {
                    // For single-select fields, replace value
                    state.filters[suggestion.field] = suggestion.value;
                }
                state.search = ''; // Clear search input
                
                // Clear filter counts cache
                FilterPanel.filterCounts = {};
                
                await handleFilterChange();
                m.redraw();
            } else {
                // Keep as general search and trigger filter
                await handleFilterChange();
            }
        };
        
        return m('div', { class: 'bg-base-200 p-4' }, [
            m('div', { class: 'flex justify-between items-center mb-4' }, [
                m('h3', { class: 'font-bold text-lg' }, 'Filters'),
                m('button', { 
                    class: 'btn btn-xs btn-ghost',
                    onclick: async () => {
                        // Clear all filters - both numeric and categorical
                        Object.keys(state.filters).forEach(key => {
                            state.filters[key] = null;
                        });
                        state.search = '';
                        JobsPage.displayPage = 1;
                        
                        // Clear filter counts cache
                        FilterPanel.filterCounts = {};
                        
                        // Update URL
                        URLState.update();
                        
                        // Reload jobs with no filters
                        await JobsPage.loadJobs();
                        m.redraw();
                    }
                }, 'Clear All')
            ]),
            
            // Apply Filter (Search) Field
            m('div', { class: 'form-control mb-6 relative' }, [
                m('label', { class: 'label' }, m('span', { class: 'label-text font-semibold' }, 'Apply Filter')),
                m('div', { class: 'flex gap-2' }, [
                    m('div', { class: 'relative flex-1' }, [
                        m('input', { 
                            type: 'text',
                            class: `input input-bordered input-sm w-full ${state.search ? 'input-info' : ''}`,
                            placeholder: 'Type to search/filter by title, company, skills, location...',
                            value: state.search || '',
                            oninput: (e) => {
                                state.search = e.target.value;
                                // Debounce suggestions fetching
                                clearTimeout(FilterPanel.suggestionsTimer);
                                FilterPanel.suggestionsTimer = setTimeout(() => {
                                    FilterPanel.fetchSuggestions();
                                }, 300);
                                m.redraw(); // Trigger redraw to show/hide suggestions
                            },
                            onkeypress: (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    applySearchAsFilter();
                                }
                            },
                            onfocus: (e) => {
                                // Show hint text
                                if (!state.search) {
                                    e.target.placeholder = 'Type and press Enter to apply as filter...';
                                }
                            },
                            onblur: (e) => {
                                e.target.placeholder = 'Type to search/filter by title, company, skills, location...';
                            }
                        }),
                        // Suggestions dropdown
                        (() => {
                            const suggestions = FilterPanel.suggestions;
                            if (suggestions.length === 0 || !state.search) return null;
                            
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
                                        title: suggestion.isMultiSelect 
                                            ? `Add "${suggestion.value}" to ${suggestion.fieldDisplay} (multi-select)`
                                            : `Apply "${suggestion.value}" to ${suggestion.fieldDisplay}`
                                    }, [
                                        m('div', { class: 'flex justify-between items-center' }, [
                                            m('div', [
                                                m('div', { class: 'font-medium text-base-content' }, [
                                                    suggestion.value,
                                                    suggestion.isMultiSelect && m('span', { class: 'ml-2 text-xs opacity-60' }, '(+)')
                                                ]),
                                                m('div', { class: 'text-xs opacity-70' }, 
                                                    suggestion.isMultiSelect 
                                                        ? `Add to: ${suggestion.fieldDisplay}` 
                                                        : `Apply to: ${suggestion.fieldDisplay}`
                                                )
                                            ]),
                                            m('div', { class: 'badge badge-sm badge-info' }, suggestion.count)
                                        ])
                                    ])
                                )
                            ]);
                        })()
                    ]),
                    m('button', { 
                        class: 'btn btn-sm btn-primary',
                        onclick: applySearchAsFilter
                    }, 'Apply')
                ])
            ]),
            
            m('div', { class: 'divider' }),
            
            // Items Per Page Selector
            m('div', { class: 'form-control mb-6' }, [
                m('label', { class: 'label' }, m('span', { class: 'label-text font-semibold' }, 'Items Per Page')),
                m('div', { class: 'flex gap-2' }, [
                    state.availablePageSizes.map(size =>
                        m('button', {
                            class: `btn btn-sm ${state.itemsPerPage === size ? 'btn-primary' : 'btn-ghost'}`,
                            onclick: async () => {
                                state.itemsPerPage = size;
                                JobsPage.displayPage = 1;
                                URLState.update();
                                await JobsPage.loadJobs();
                                m.redraw();
                            }
                        }, size)
                    )
                ]),
                m('div', { class: 'text-xs opacity-70 mt-2' }, `Showing ${state.itemsPerPage} jobs per page`)
            ]),
            
            // Sort Controls
            m('div', { class: 'form-control mb-6' }, [
                m('label', { class: 'label' }, m('span', { class: 'label-text font-semibold' }, 'Sort By')),
                m('div', { class: 'grid grid-cols-2 gap-2' }, [
                    state.sortOptions.map(option =>
                        m('button', {
                            class: `btn btn-sm ${state.sort === option.value ? 'btn-primary' : 'btn-ghost'} w-full`,
                            onclick: async () => {
                                state.sort = option.value;
                                URLState.update();
                                await JobsPage.loadJobs();
                                m.redraw();
                            }
                        }, option.label)
                    )
                ])
            ]),
            
            m('div', { class: 'divider' }),
            
            // Salary Range Filter
            m('div', { class: 'form-control mb-6' }, [
                m('label', { class: 'label' }, m('span', { class: 'label-text font-semibold' }, 'Salary Range (MDL)')),
                m('div', { class: 'space-y-2' }, [
                    m('input', { 
                        type: 'number',
                        class: `input input-bordered input-sm w-full ${state.filters.salaryMin ? 'input-info' : ''}`,
                        placeholder: 'Minimum',
                        value: state.filters.salaryMin || '',
                        oninput: (e) => {
                            state.filters.salaryMin = e.target.value ? parseInt(e.target.value) : null;
                            // Debounce the filter change
                            clearTimeout(FilterPanel.salaryMinTimer);
                            FilterPanel.salaryMinTimer = setTimeout(() => {
                                handleFilterChange();
                            }, 500);
                            URLState.update();
                        }
                    }),
                    m('input', { 
                        type: 'number',
                        class: `input input-bordered input-sm w-full ${state.filters.salaryMax ? 'input-info' : ''}`,
                        placeholder: 'Maximum',
                        value: state.filters.salaryMax || '',
                        oninput: (e) => {
                            state.filters.salaryMax = e.target.value ? parseInt(e.target.value) : null;
                            // Debounce the filter change
                            clearTimeout(FilterPanel.salaryMaxTimer);
                            FilterPanel.salaryMaxTimer = setTimeout(() => {
                                handleFilterChange();
                            }, 500);
                            URLState.update();
                        }
                    }),
                    (state.filters.salaryMin || state.filters.salaryMax) && m('div', { class: 'text-xs opacity-70' }, 
                        `${state.filters.salaryMin ? state.filters.salaryMin.toLocaleString() : '0'} - ${state.filters.salaryMax ? state.filters.salaryMax.toLocaleString() : '∞'} MDL`
                    )
                ])
            ]),
            
            // Experience Years Filter
            m('div', { class: 'form-control mb-6' }, [
                m('label', { class: 'label' }, m('span', { class: 'label-text font-semibold' }, 'Experience (Years)')),
                m('div', { class: 'space-y-2' }, [
                    m('input', { 
                        type: 'number',
                        class: `input input-bordered input-sm w-full ${state.filters.experienceMin !== null ? 'input-info' : ''}`,
                        placeholder: 'Minimum',
                        min: 0,
                        value: state.filters.experienceMin !== null ? state.filters.experienceMin : '',
                        oninput: (e) => {
                            state.filters.experienceMin = e.target.value ? parseInt(e.target.value) : null;
                            // Debounce the filter change
                            clearTimeout(FilterPanel.experienceMinTimer);
                            FilterPanel.experienceMinTimer = setTimeout(() => {
                                handleFilterChange();
                            }, 500);
                            URLState.update();
                        }
                    }),
                    m('input', { 
                        type: 'number',
                        class: `input input-bordered input-sm w-full ${state.filters.experienceMax !== null ? 'input-info' : ''}`,
                        placeholder: 'Maximum',
                        min: 0,
                        value: state.filters.experienceMax !== null ? state.filters.experienceMax : '',
                        oninput: (e) => {
                            state.filters.experienceMax = e.target.value ? parseInt(e.target.value) : null;
                            // Debounce the filter change
                            clearTimeout(FilterPanel.experienceMaxTimer);
                            FilterPanel.experienceMaxTimer = setTimeout(() => {
                                handleFilterChange();
                            }, 500);
                            URLState.update();
                        }
                    }),
                    (state.filters.experienceMin !== null || state.filters.experienceMax !== null) && 
                        m('div', { class: 'text-xs opacity-70' }, 
                            `${state.filters.experienceMin || 0} - ${state.filters.experienceMax || '∞'} years`
                        )
                ])
            ]),
            
            m('div', { class: 'divider' }),
            
            // All filters grouped by section
            m('div', { class: 'space-y-6' },
                // Group filters by section - only show basic filters from metadata
                Object.entries(
                    filterFields
                        .filter(field => {
                            // Only show fields that have metadata
                            const metadataKey = getMetadataKey(field.key);
                            return state.jobsIndex.metadata && state.jobsIndex.metadata[metadataKey];
                        })
                        .reduce((acc, field) => {
                            if (!acc[field.section]) acc[field.section] = [];
                            acc[field.section].push(field);
                            return acc;
                        }, {})
                ).map(([section, fields]) => 
                    m('div', { class: 'space-y-2' }, [
                        m('div', { class: 'text-xs font-semibold opacity-60 uppercase tracking-wide' }, section),
                        ...fields.map(field => {
                            // Get metadata or dynamic counts for this field
                            const metadataKey = getMetadataKey(field.key);
                            
                            // Use dynamic counts if available, otherwise fall back to static metadata
                            let options = [];
                            if (FilterPanel.filterCounts[field.key]) {
                                options = FilterPanel.filterCounts[field.key];
                            } else {
                                // Use static metadata as initial fallback
                                options = state.jobsIndex.metadata[metadataKey] || [];
                                // Trigger async fetch of dynamic counts
                                FilterPanel.getCountsForField(field.key);
                            }
                            
                            // Filter out options with 0 count
                            const availableOptions = options.filter(opt => opt.count > 0);
                            
                            // Determine if this is a multi-select field (many-to-many)
                            const isMultiSelect = MULTI_SELECT_FIELDS.includes(field.key);
                            
                            // Initialize filter value as array for multi-select fields
                            if (isMultiSelect && !Array.isArray(state.filters[field.key])) {
                                state.filters[field.key] = state.filters[field.key] ? [state.filters[field.key]] : [];
                            }
                            
                            return m('div', { class: 'form-control' }, [
                                m('label', { class: 'label py-1' }, [
                                    m('span', { class: 'label-text text-sm' }, field.label),
                                    isMultiSelect && state.filters[field.key] && state.filters[field.key].length > 0 && 
                                        m('span', { class: 'badge badge-info badge-sm ml-2' }, state.filters[field.key].length)
                                ]),
                                isMultiSelect ? 
                                    // Multi-select for many-to-many fields - checkbox + dropdown pattern
                                    m('div', { class: 'space-y-2' }, [
                                        // Display selected items as checkboxes
                                        state.filters[field.key] && state.filters[field.key].length > 0 && 
                                            m('div', { class: 'space-y-1 mb-2 p-2 bg-base-100 rounded border border-base-300' }, 
                                                state.filters[field.key].map(selectedValue => 
                                                    m('label', { 
                                                        class: 'flex items-center gap-2 cursor-pointer hover:bg-base-200 p-1 rounded',
                                                        onclick: (e) => {
                                                            e.preventDefault();
                                                            // Remove this item from selection
                                                            state.filters[field.key] = state.filters[field.key].filter(v => v !== selectedValue);
                                                            // Clear cached counts so they refresh
                                                            FilterPanel.filterCounts = {};
                                                            handleFilterChange();
                                                        }
                                                    }, [
                                                        m('input', { 
                                                            type: 'checkbox',
                                                            class: 'checkbox checkbox-sm checkbox-info',
                                                            checked: true,
                                                            onclick: (e) => e.stopPropagation() // Prevent double-triggering
                                                        }),
                                                        m('span', { class: 'text-sm flex-1' }, selectedValue)
                                                    ])
                                                )
                                            ),
                                        // Dropdown to add more items (without counts for performance)
                                        m('select', { 
                                            class: `select select-bordered select-sm w-full ${state.filters[field.key] && state.filters[field.key].length > 0 ? 'select-info' : ''}`,
                                            value: '',
                                            onchange: (e) => {
                                                if (e.target.value) {
                                                    // Add selected item to the filter array
                                                    if (!state.filters[field.key]) {
                                                        state.filters[field.key] = [];
                                                    }
                                                    if (!state.filters[field.key].includes(e.target.value)) {
                                                        state.filters[field.key].push(e.target.value);
                                                    }
                                                    // Reset dropdown to show prompt
                                                    e.target.value = '';
                                                    // Clear cached counts so they refresh
                                                    FilterPanel.filterCounts = {};
                                                    handleFilterChange();
                                                }
                                            }
                                        }, [
                                            m('option', { value: '', disabled: true, selected: true }, 
                                                state.filters[field.key] && state.filters[field.key].length > 0 
                                                    ? 'Add more...' 
                                                    : 'Select...'
                                            ),
                                            ...availableOptions
                                                .filter(item => !state.filters[field.key] || !state.filters[field.key].includes(item.name))
                                                .map(item => 
                                                    m('option', { value: item.name }, item.name)
                                                )
                                        ])
                                    ])
                                    :
                                    // Single-select for many-to-one fields
                                    m('select', { 
                                        class: `select select-bordered select-sm w-full ${state.filters[field.key] ? 'select-info' : ''}`,
                                        value: state.filters[field.key] || '',
                                        onchange: (e) => {
                                            if (e.target.value) {
                                                state.filters[field.key] = e.target.value;
                                            } else {
                                                state.filters[field.key] = null;
                                            }
                                            // Clear cached counts so they refresh
                                            FilterPanel.filterCounts = {};
                                            handleFilterChange();
                                        }
                                    }, [
                                        m('option', { value: '' }, 'All'),
                                        ...availableOptions.map(item => 
                                            m('option', { value: item.name }, `${item.name} (${item.count})`)
                                        )
                                    ])
                            ]);
                        })
                    ])
                )
            )
        ]);
    }
};

