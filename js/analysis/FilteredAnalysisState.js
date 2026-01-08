// State management for Filtered Analysis
const FilteredAnalysisState = {
    // Current filters - organized by field
    filters: {},
    
    // Current query being executed
    currentQuery: {
        name: '',
        description: '',
        sql: '',
        chartType: 'bar'
    },
    
    // Query execution result
    queryResult: null,
    
    // Chart instance
    chartInstance: null,
    
    // Add a filter
    addFilter: (field, value, fieldLabel) => {
        if (!FilteredAnalysisState.filters[field]) {
            FilteredAnalysisState.filters[field] = [];
        }
        
        // For filtered analysis, ALWAYS use OR logic - add to array, never replace
        // Check if this exact value is already in the filters
        const alreadyExists = FilteredAnalysisState.filters[field].some(f => f.value === value);
        
        if (!alreadyExists) {
            FilteredAnalysisState.filters[field].push({
                value: value,
                label: fieldLabel || field
            });
        }
    },
    
    // Remove a specific filter value
    removeFilter: (field, value) => {
        if (!FilteredAnalysisState.filters[field]) return;
        
        FilteredAnalysisState.filters[field] = FilteredAnalysisState.filters[field].filter(
            f => f.value !== value
        );
        
        // If no more values for this field, remove the field entirely
        if (FilteredAnalysisState.filters[field].length === 0) {
            delete FilteredAnalysisState.filters[field];
        }
    },
    
    // Clear all filters
    clearAllFilters: () => {
        FilteredAnalysisState.filters = {};
    },
    
    // Get count of active filters
    getActiveFilterCount: () => {
        return Object.values(FilteredAnalysisState.filters).reduce(
            (sum, filters) => sum + filters.length, 
            0
        );
    },
    
    // Build WHERE clause with OR logic
    buildOrWhereClause: () => {
        const conditions = [];
        const params = [];
        
        // Build OR conditions for each filter type
        for (const [field, filterValues] of Object.entries(FilteredAnalysisState.filters)) {
            if (!filterValues || filterValues.length === 0) continue;
            
            const fieldConditions = [];
            
            // Map field names to database columns and tables
            const fieldMapping = {
                // Job Details
                'title': { table: 'titles', column: 'name', foreignKey: 'title_id', alias: 't' },
                'job_function': { table: 'job_functions', column: 'name', foreignKey: 'job_function_id', alias: 'jf' },
                'seniority_level': { table: 'seniority_levels', column: 'name', foreignKey: 'seniority_level_id', alias: 'sl' },
                'city': { table: 'cities', column: 'name', foreignKey: 'city_id', alias: 'ci' },
                'remote_work': { table: 'remote_work_options', column: 'name', foreignKey: 'remote_work_id', alias: 'rw' },
                'industry': { table: 'industries', column: 'name', foreignKey: 'industry_id', alias: 'ind' },
                'company': { table: 'companies', column: 'name', foreignKey: 'company_name_id', alias: 'c' },
                'employment_type': { table: 'employment_types', column: 'name', foreignKey: 'employment_type_id', alias: 'et' },
                'contract_type': { table: 'contract_types', column: 'name', foreignKey: 'contract_type_id', alias: 'ct' },
                'department': { table: 'departments', column: 'name', foreignKey: 'department_id', alias: 'd' },
                'specialization': { table: 'specializations', column: 'name', foreignKey: 'specialization_id', alias: 'sp' },
                'education_level': { table: 'education_levels', column: 'name', foreignKey: 'required_education_id', alias: 'el' },
                'company_size': { table: 'company_sizes', column: 'name', foreignKey: 'company_size_id', alias: 'cs' },
                'job_family': { table: 'job_families', column: 'name', foreignKey: 'job_family_id', alias: 'jf2' },
                'work_schedule': { table: 'work_schedules', column: 'name', foreignKey: 'work_schedule_id', alias: 'ws' },
                'shift_details': { table: 'shift_details', column: 'name', foreignKey: 'shift_details_id', alias: 'sd' },
                'travel_required': { table: 'travel_requirements', column: 'name', foreignKey: 'travel_required_id', alias: 'tr' },
                'region': { table: 'regions', column: 'name', foreignKey: 'region_id', alias: 'reg' },
                'country': { table: 'countries', column: 'name', foreignKey: 'country_id', alias: 'cou' }
            };
            
            // Handle many-to-many relationships
            const m2mMapping = {
                'hard_skills': { table: 'hard_skills', column: 'name' },
                'soft_skills': { table: 'soft_skills', column: 'name' },
                'certifications': { table: 'certifications', column: 'name' },
                'licenses_required': { table: 'licenses', column: 'name' },
                'benefits': { table: 'benefits', column: 'description' }
            };
            
            const mapping = fieldMapping[field];
            const m2mMap = m2mMapping[field];
            
            if (m2mMap) {
                // Many-to-many: Use subquery with OR
                const placeholders = filterValues.map(() => '?').join(',');
                const values = filterValues.map(f => f.value);
                
                conditions.push(`jd.id IN (
                    SELECT jm.job_details_id 
                    FROM job_details_${m2mMap.table} jm
                    JOIN ${m2mMap.table} mt ON jm.${m2mMap.table}_id = mt.id
                    WHERE mt.${m2mMap.column} IN (${placeholders})
                )`);
                params.push(...values);
            } else if (mapping) {
                // Many-to-one: Direct comparison with OR
                for (const filterValue of filterValues) {
                    fieldConditions.push(`${mapping.alias}.${mapping.column} = ?`);
                    params.push(filterValue.value);
                }
                
                if (fieldConditions.length > 0) {
                    conditions.push(`(${fieldConditions.join(' OR ')})`);
                }
            }
        }
        
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' OR ') : '';
        return { whereClause, params };
    },
    
    // Execute current query with filters applied
    executeQuery: async () => {
        try {
            await DatabaseManager.init();
            
            const query = FilteredAnalysisState.currentQuery;
            let sql = query.baseSql || query.sql;
            
            // Apply filters using OR logic
            const { whereClause, params } = FilteredAnalysisState.buildOrWhereClause();
            
            // If filters are active, modify the SQL to include them
            if (whereClause) {
                // Find the FROM clause and insert the WHERE clause
                // Look for existing WHERE clause
                const upperSql = sql.toUpperCase();
                const whereIndex = upperSql.indexOf('WHERE');
                const groupByIndex = upperSql.indexOf('GROUP BY');
                const orderByIndex = upperSql.indexOf('ORDER BY');
                const limitIndex = upperSql.indexOf('LIMIT');
                
                if (whereIndex !== -1) {
                    // Already has WHERE, combine with AND
                    // Extract just the condition part (without the "WHERE" keyword)
                    const filterCondition = whereClause.substring(6); // Remove "WHERE "
                    const insertPoint = whereIndex + 5; // After "WHERE"
                    sql = sql.substring(0, insertPoint) + ' (' + filterCondition + ') AND' + sql.substring(insertPoint);
                } else {
                    // No WHERE clause, find insertion point
                    let insertPoint = sql.length;
                    
                    if (groupByIndex !== -1) {
                        insertPoint = groupByIndex;
                    } else if (orderByIndex !== -1) {
                        insertPoint = orderByIndex;
                    } else if (limitIndex !== -1) {
                        insertPoint = limitIndex;
                    }
                    
                    sql = sql.substring(0, insertPoint) + '\n' + whereClause + '\n' + sql.substring(insertPoint);
                }
            }
            
            // Execute query
            const data = DatabaseManager.queryObjects(sql, params);
            
            FilteredAnalysisState.queryResult = {
                success: true,
                data: data,
                rowCount: data.length
            };
            
            // Store the executed SQL for display
            FilteredAnalysisState.currentQuery.sql = sql;
            
            m.redraw();
        } catch (error) {
            console.error('Query execution error:', error);
            FilteredAnalysisState.queryResult = {
                success: false,
                error: error.message
            };
            m.redraw();
        }
    },
    
    // Load filtered jobs for display
    loadFilteredJobs: async () => {
        try {
            await DatabaseManager.init();
            
            // Build WHERE clause with OR logic
            const { whereClause, params } = FilteredAnalysisState.buildOrWhereClause();
            
            // Query to get all matching jobs with details
            const sql = `
                SELECT 
                    jd.id,
                    t.name as title,
                    c.name as company,
                    ci.name as city,
                    jd.max_salary,
                    jd.posting_date
                FROM job_details jd
                LEFT JOIN titles t ON jd.title_id = t.id
                LEFT JOIN companies c ON jd.company_name_id = c.id
                LEFT JOIN cities ci ON jd.city_id = ci.id
                LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
                LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
                LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
                LEFT JOIN industries ind ON jd.industry_id = ind.id
                LEFT JOIN employment_types et ON jd.employment_type_id = et.id
                LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
                LEFT JOIN departments d ON jd.department_id = d.id
                LEFT JOIN specializations sp ON jd.specialization_id = sp.id
                LEFT JOIN education_levels el ON jd.required_education_id = el.id
                LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
                LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
                LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
                LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
                LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
                LEFT JOIN regions reg ON jd.region_id = reg.id
                LEFT JOIN countries cou ON jd.country_id = cou.id
                ${whereClause}
                ORDER BY jd.posting_date DESC
                LIMIT 100
            `;
            
            const jobs = DatabaseManager.queryObjects(sql, params);
            
            FilteredAnalysisState.filteredJobs = jobs;
            m.redraw();
        } catch (error) {
            console.error('Error loading filtered jobs:', error);
            FilteredAnalysisState.filteredJobs = [];
            m.redraw();
        }
    },
    
    // Store filtered jobs list
    filteredJobs: []
};
