// API Configuration
const API_BASE = '/api';

// Constants for multi-select fields (many-to-many relationships and one-to-many like languages)
const MULTI_SELECT_FIELDS = [
    'languages',  // One-to-many (job can require multiple languages)
    'hard_skills', 'soft_skills', 'certifications', 'licenses_required',
    'benefits', 'work_environment', 'professional_development', 
    'work_life_balance', 'physical_requirements', 'work_conditions', 
    'special_requirements'
];

// Database Management
const DatabaseManager = {
    db: null,
    loading: false,
    loaded: false,
    error: null,
    initPromise: null,
    
    // Initialize SQL.js and load the database
    async init() {
        if (this.loaded) return this.db;
        if (this.loading && this.initPromise) {
            // Wait for existing initialization to complete
            return this.initPromise;
        }
        
        this.loading = true;
        this.error = null;
        
        // Store the initialization promise so multiple calls can await it
        this.initPromise = (async () => {
            try {
                console.log('Initializing SQL.js...');
                
                // Initialize SQL.js with CDN WASM files
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                
                console.log('Loading database file...');
                
                // Load the database file
                const response = await fetch(`${API_BASE}/data.db`);
                if (!response.ok) {
                    throw new Error(`Failed to load database: ${response.status} ${response.statusText}`);
                }
                
                const buffer = await response.arrayBuffer();
                console.log(`Database loaded: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
                
                // Create database instance
                this.db = new SQL.Database(new Uint8Array(buffer));
                this.loaded = true;
                this.loading = false;
                
                console.log('Database ready for queries');
                return this.db;
                
            } catch (error) {
                console.error('Database initialization failed:', error);
                this.error = error;
                this.loading = false;
                this.initPromise = null;
                throw error;
            }
        })();
        
        return this.initPromise;
    },
    
    // Execute a SQL query
    query(sql, params = []) {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }
        
        try {
            const results = this.db.exec(sql, params);
            return results;
        } catch (error) {
            console.error('Query failed:', sql, error);
            throw error;
        }
    },
    
    // Get query results as objects
    queryObjects(sql, params = []) {
        const results = this.query(sql, params);
        if (results.length === 0) return [];
        
        const [result] = results;
        const { columns, values } = result;
        
        return values.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });
    }
};

// URL State Management Utilities
const URLState = {
    // Parse query parameters from URL
    parse: () => {
        const params = new URLSearchParams(window.location.search);
        const state = {
            filters: {},
            page: parseInt(params.get('page')) || 1,
            itemsPerPage: parseInt(params.get('limit')) || 20,
            sort: params.get('sort') || 'date_desc',
            search: params.get('q') || ''
        };
        
        // Parse all filter parameters
        for (const [key, value] of params.entries()) {
            if (['page', 'limit', 'sort', 'q'].includes(key)) continue;
            if (value && value !== '') {
                // Convert numeric values for range filters
                if (['salaryMin', 'salaryMax', 'experienceMin', 'experienceMax'].includes(key)) {
                    state.filters[key] = value === 'null' ? null : parseInt(value);
                } else if (MULTI_SELECT_FIELDS.includes(key)) {
                    // Handle multi-select fields - support comma-separated values
                    state.filters[key] = value.split(',').map(v => v.trim()).filter(v => v);
                } else {
                    state.filters[key] = value;
                }
            }
        }
        
        return state;
    },
    
    // Update URL with current state
    update: (newState) => {
        const url = new URL(window.location);
        
        // Update filters
        Object.keys(state.filters).forEach(key => {
            const value = state.filters[key];
            if (Array.isArray(value) && value.length > 0) {
                // Join array values with comma for URL
                url.searchParams.set(key, value.join(','));
            } else if (value !== null && value !== undefined && value !== '' && !Array.isArray(value)) {
                url.searchParams.set(key, value);
            } else {
                url.searchParams.delete(key);
            }
        });
        
        // Update search
        if (state.search && state.search.trim()) {
            url.searchParams.set('q', state.search.trim());
        } else {
            url.searchParams.delete('q');
        }
        
        // Update pagination and sorting
        if (JobsPage.displayPage !== 1) {
            url.searchParams.set('page', JobsPage.displayPage);
        } else {
            url.searchParams.delete('page');
        }
        
        if (state.itemsPerPage !== 20) {
            url.searchParams.set('limit', state.itemsPerPage);
        } else {
            url.searchParams.delete('limit');
        }
        
        if (state.sort !== 'date_desc') {
            url.searchParams.set('sort', state.sort);
        } else {
            url.searchParams.delete('sort');
        }
        
        // Update browser URL without triggering route change
        window.history.replaceState({}, '', url.toString());
    },
    
    // Initialize state from URL
    initialize: () => {
        const urlState = URLState.parse();
        
        // Return URL state for later application
        return urlState;
    }
};

// API Client
const api = {
    getJobsIndex: () => m.request({ url: `${API_BASE}/jobs/index.json` }),
    getJobsPage: (page) => m.request({ url: `${API_BASE}/jobs/page-${page}.json` }),
    getAnalysisIndex: () => m.request({ url: `${API_BASE}/analysis/index.json` }),
    getAnalysis: (filename) => m.request({ url: `${API_BASE}/analysis/${filename}` })
};

// SQL-based data access functions
const dbApi = {
    // Build WHERE clause from filters
    buildWhereClause(filters, search) {
        const conditions = [];
        const params = [];  // Changed from {} to [] for positional parameters
        
        // Text search across multiple fields
        if (search && search.trim()) {
            const searchValue = `%${search.trim()}%`;
            conditions.push(`(
                jd.job_title LIKE ? OR
                t.name LIKE ? OR
                c.name LIKE ? OR
                jf.name LIKE ? OR
                sp.name LIKE ?
            )`);
            // Add the same search value 5 times for the 5 LIKE clauses
            params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
        }
        
        // Job function filter
        if (filters.job_function) {
            conditions.push('jf.name = ?');
            params.push(filters.job_function);
        }
        
        // Seniority filter
        if (filters.seniority_level) {
            conditions.push('sl.name = ?');
            params.push(filters.seniority_level);
        }
        
        // City filter
        if (filters.city) {
            conditions.push('ci.name = ?');
            params.push(filters.city);
        }
        
        // Remote work filter
        if (filters.remote_work) {
            conditions.push('rw.name = ?');
            params.push(filters.remote_work);
        }
        
        // Industry filter
        if (filters.industry) {
            conditions.push('ind.name = ?');
            params.push(filters.industry);
        }
        
        // Company filter
        if (filters.company) {
            conditions.push('c.name = ?');
            params.push(filters.company);
        }
        
        // Employment type filter
        if (filters.employment_type) {
            conditions.push('et.name = ?');
            params.push(filters.employment_type);
        }
        
        // Contract type filter
        if (filters.contract_type) {
            conditions.push('ct.name = ?');
            params.push(filters.contract_type);
        }
        
        // Department filter
        if (filters.department) {
            conditions.push('d.name = ?');
            params.push(filters.department);
        }
        
        // Specialization filter
        if (filters.specialization) {
            conditions.push('sp.name = ?');
            params.push(filters.specialization);
        }
        
        // Education level filter
        if (filters.education_level) {
            conditions.push('el.name = ?');
            params.push(filters.education_level);
        }
        
        // Company size filter
        if (filters.company_size) {
            conditions.push('cs.name = ?');
            params.push(filters.company_size);
        }
        
        // Title filter
        if (filters.title) {
            conditions.push('t.name = ?');
            params.push(filters.title);
        }
        
        // Job family filter
        if (filters.job_family) {
            conditions.push('jf2.name = ?');
            params.push(filters.job_family);
        }
        
        // Work schedule filter
        if (filters.work_schedule) {
            conditions.push('ws.name = ?');
            params.push(filters.work_schedule);
        }
        
        // Shift details filter
        if (filters.shift_details) {
            conditions.push('sd.name = ?');
            params.push(filters.shift_details);
        }
        
        // Travel requirements filter
        if (filters.travel_required) {
            conditions.push('tr.name = ?');
            params.push(filters.travel_required);
        }
        
        // Region filter
        if (filters.region) {
            conditions.push('reg.name = ?');
            params.push(filters.region);
        }
        
        // Country filter
        if (filters.country) {
            conditions.push('cou.name = ?');
            params.push(filters.country);
        }
        
        // Many-to-many filters (multi-select with AND logic)
        // Helper function to build many-to-many conditions
        // Jobs must have ALL selected items (not just one)
        const addM2MFilter = (filterKey, tableName, columnName = 'name') => {
            const filterValue = filters[filterKey];
            if (filterValue && filterValue.length > 0) {
                // Ensure job has ALL selected items (AND logic across selections)
                const placeholders = filterValue.map(() => '?').join(',');
                conditions.push(`jd.id IN (
                    SELECT jm.job_details_id 
                    FROM job_details_${tableName} jm
                    JOIN ${tableName} mt ON jm.${tableName}_id = mt.id
                    WHERE mt.${columnName} IN (${placeholders})
                    GROUP BY jm.job_details_id
                    HAVING COUNT(DISTINCT mt.${columnName}) = ${filterValue.length}
                )`);
                params.push(...filterValue);
            }
        };
        
        // Helper function for one-to-many relationships (like languages)
        const addOneToManyFilter = (filterKey, tableName, columnName, foreignKey = 'job_detail_id') => {
            const filterValue = filters[filterKey];
            if (filterValue && filterValue.length > 0) {
                // Ensure job has ALL selected items (AND logic across selections)
                const placeholders = filterValue.map(() => '?').join(',');
                conditions.push(`jd.id IN (
                    SELECT t.${foreignKey}
                    FROM ${tableName} t
                    WHERE t.${columnName} IN (${placeholders})
                    GROUP BY t.${foreignKey}
                    HAVING COUNT(DISTINCT t.${columnName}) = ${filterValue.length}
                )`);
                params.push(...filterValue);
            }
        };
        
        // One-to-many filters
        addOneToManyFilter('languages', 'job_languages', 'language', 'job_detail_id');
        
        // Many-to-many filters
        addM2MFilter('hard_skills', 'hard_skills');
        addM2MFilter('soft_skills', 'soft_skills');
        addM2MFilter('certifications', 'certifications');
        addM2MFilter('licenses_required', 'licenses');
        addM2MFilter('benefits', 'benefits', 'description');
        addM2MFilter('work_environment', 'work_environment', 'description');
        addM2MFilter('professional_development', 'professional_development', 'description');
        addM2MFilter('work_life_balance', 'work_life_balance', 'description');
        addM2MFilter('physical_requirements', 'physical_requirements', 'description');
        addM2MFilter('work_conditions', 'work_conditions', 'description');
        addM2MFilter('special_requirements', 'special_requirements', 'description');
        
        // Salary range filters
        if (filters.salaryMin !== null && filters.salaryMin !== undefined) {
            conditions.push('jd.min_salary >= ?');
            params.push(filters.salaryMin);
        }
        
        if (filters.salaryMax !== null && filters.salaryMax !== undefined) {
            conditions.push('jd.max_salary <= ?');
            params.push(filters.salaryMax);
        }
        
        // Experience filters
        if (filters.experienceMin !== null && filters.experienceMin !== undefined) {
            conditions.push('jd.experience_years >= ?');
            params.push(filters.experienceMin);
        }
        
        if (filters.experienceMax !== null && filters.experienceMax !== undefined) {
            conditions.push('jd.experience_years <= ?');
            params.push(filters.experienceMax);
        }
        
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        return { whereClause, params };
    },
    
    // Build ORDER BY clause from sort option
    buildOrderByClause(sortOption) {
        const sortMap = {
            'date_desc': 'jd.posting_date DESC',
            'date_asc': 'jd.posting_date ASC',
            'salary_desc': 'jd.min_salary DESC',
            'salary_asc': 'jd.min_salary ASC',
            'title_asc': 't.name ASC',
            'title_desc': 't.name DESC',
            'company_asc': 'c.name ASC',
            'company_desc': 'c.name DESC'
        };
        
        return sortMap[sortOption] || sortMap['date_desc'];
    },
    
    // Get jobs with pagination, filtering, and sorting
    async getJobs(page = 1, limit = 20, filters = {}, search = '', sort = 'date_desc') {
        await DatabaseManager.init();
        
        const { whereClause, params } = this.buildWhereClause(filters, search);
        const orderBy = this.buildOrderByClause(sort);
        const offset = (page - 1) * limit;
        
        // Main query to get jobs
        const jobsQuery = `
            SELECT 
                jd.id,
                t.name as title,
                jf.name as job_function,
                sp.name as specialization,
                sl.name as seniority_level,
                c.name as company,
                cs.name as company_size,
                ci.name as city,
                reg.name as region,
                cou.name as country,
                rw.name as remote_work,
                jd.min_salary,
                jd.max_salary,
                curr.code as salary_currency,
                sper.name as salary_period,
                et.name as employment_type,
                ct.name as contract_type,
                ws.name as work_schedule,
                el.name as education_level,
                jd.experience_years,
                jd.posting_date,
                jd.site,
                jd.job_url,
                jd.job_title as original_title,
                jd.company_name as original_company,
                jd.job_description as original_description,
                ind.name as industry,
                d.name as department,
                jf2.name as job_family,
                sd.name as shift_details,
                tr.name as travel_requirements
            FROM job_details jd
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN specializations sp ON jd.specialization_id = sp.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
            LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN regions reg ON jd.region_id = reg.id
            LEFT JOIN countries cou ON jd.country_id = cou.id
            LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
            LEFT JOIN currencies curr ON jd.salary_currency_id = curr.id
            LEFT JOIN salary_periods sper ON jd.salary_period_id = sper.id
            LEFT JOIN employment_types et ON jd.employment_type_id = et.id
            LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
            LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
            LEFT JOIN education_levels el ON jd.required_education_id = el.id
            LEFT JOIN industries ind ON jd.industry_id = ind.id
            LEFT JOIN departments d ON jd.department_id = d.id
            LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
            LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
            LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
        `;
        
        const jobs = DatabaseManager.queryObjects(jobsQuery, params);
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM job_details jd
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN specializations sp ON jd.specialization_id = sp.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
            LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
            LEFT JOIN employment_types et ON jd.employment_type_id = et.id
            LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
            LEFT JOIN departments d ON jd.department_id = d.id
            LEFT JOIN education_levels el ON jd.required_education_id = el.id
            LEFT JOIN industries ind ON jd.industry_id = ind.id
            ${whereClause}
        `;
        
        const countResult = DatabaseManager.queryObjects(countQuery, params);
        const total = countResult[0]?.total || 0;
        
        // Format jobs to match the JSON API structure
        const formattedJobs = await Promise.all(jobs.map(job => this.formatJob(job)));
        
        return {
            jobs: formattedJobs,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    },
    
    // Format a job to match JSON API structure
    async formatJob(job) {
        // Get related data (skills, benefits, etc.)
        const hardSkills = await this.getJobSkills(job.id, 'hard_skills');
        const softSkills = await this.getJobSkills(job.id, 'soft_skills');
        const certifications = await this.getJobRelated(job.id, 'certifications');
        const benefits = await this.getJobRelated(job.id, 'benefits');
        const responsibilities = await this.getJobResponsibilities(job.id);
        const languages = await this.getJobLanguages(job.id);
        const workEnvironment = await this.getJobRelated(job.id, 'work_environment');
        const professionalDevelopment = await this.getJobRelated(job.id, 'professional_development');
        
        return {
            id: job.id,
            title: job.title,
            job_function: job.job_function,
            specialization: job.specialization,
            seniority_level: job.seniority_level,
            company: job.company,
            company_size: job.company_size,
            location: {
                city: job.city,
                region: job.region,
                country: job.country,
                remote_work: job.remote_work
            },
            salary: {
                min: job.min_salary,
                max: job.max_salary,
                currency: job.salary_currency || 'MDL',
                period: job.salary_period,
                min_mdl: job.min_salary, // For Moldova market, assume MDL
                max_mdl: job.max_salary
            },
            employment: {
                type: job.employment_type,
                contract: job.contract_type,
                schedule: job.work_schedule
            },
            requirements: {
                education: job.education_level,
                experience_years: job.experience_years,
                languages: languages,
                hard_skills: hardSkills,
                soft_skills: softSkills,
                certifications: certifications
            },
            benefits: benefits,
            posting_date: job.posting_date,
            source: {
                site: job.site,
                url: job.job_url
            },
            parsed_view: {
                responsibilities: responsibilities,
                work_environment: workEnvironment,
                professional_development: professionalDevelopment
            },
            raw: {
                original_title: job.original_title,
                original_company: job.original_company,
                original_description: job.original_description
            },
            industry: job.industry,
            department: job.department,
            job_family: job.job_family,
            shift_details: job.shift_details,
            travel_requirements: job.travel_requirements
        };
    },
    
    // Get job skills (hard or soft)
    async getJobSkills(jobId, skillType) {
        // Validate skillType to prevent SQL injection
        const allowedTypes = ['hard_skills', 'soft_skills'];
        if (!allowedTypes.includes(skillType)) {
            console.error('Invalid skill type:', skillType);
            return [];
        }
        
        const table = skillType;
        const query = `
            SELECT s.name
            FROM ${table} s
            JOIN job_details_${table} js ON s.id = js.${table}_id
            WHERE js.job_details_id = ?
        `;
        
        const results = DatabaseManager.queryObjects(query, [jobId]);
        return results.map(r => r.name);
    },
    
    // Get job related data (benefits, certifications, etc.)
    async getJobRelated(jobId, relationType) {
        // Validate relationType to prevent SQL injection
        const allowedTypes = [
            'certifications', 'benefits', 'work_environment', 
            'professional_development', 'work_life_balance',
            'physical_requirements', 'work_conditions', 'special_requirements'
        ];
        if (!allowedTypes.includes(relationType)) {
            console.error('Invalid relation type:', relationType);
            return [];
        }
        
        const columnName = relationType === 'benefits' || relationType === 'work_environment' || 
                          relationType === 'professional_development' ? 'description' : 'name';
        const query = `
            SELECT r.${columnName} as value
            FROM ${relationType} r
            JOIN job_details_${relationType} jr ON r.id = jr.${relationType}_id
            WHERE jr.job_details_id = ?
        `;
        
        const results = DatabaseManager.queryObjects(query, [jobId]);
        return results.map(r => r.value);
    },
    
    // Get job responsibilities
    async getJobResponsibilities(jobId) {
        const query = `
            SELECT description
            FROM responsibilities
            WHERE job_detail_id = ?
        `;
        
        const results = DatabaseManager.queryObjects(query, [jobId]);
        return results.map(r => r.description);
    },
    
    // Get job languages
    async getJobLanguages(jobId) {
        const query = `
            SELECT language
            FROM job_languages
            WHERE job_detail_id = ?
        `;
        
        const results = DatabaseManager.queryObjects(query, [jobId]);
        return results.map(r => r.language);
    },
    
    // Get metadata for filters (distinct values with counts)
    async getMetadata() {
        await DatabaseManager.init();
        
        const metadata = {};
        
        // Map table names to their foreign key column names in job_details
        const tableToForeignKey = {
            'titles': 'title_id',
            'job_functions': 'job_function_id',
            'seniority_levels': 'seniority_level_id',
            'industries': 'industry_id',
            'departments': 'department_id',
            'job_families': 'job_family_id',
            'specializations': 'specialization_id',
            'education_levels': 'required_education_id',
            'employment_types': 'employment_type_id',
            'contract_types': 'contract_type_id',
            'work_schedules': 'work_schedule_id',
            'shift_details': 'shift_details_id',
            'remote_work_options': 'remote_work_id',
            'travel_requirements': 'travel_required_id',
            'cities': 'city_id',
            'regions': 'region_id',
            'countries': 'country_id',
            'companies': 'company_name_id',
            'company_sizes': 'company_size_id'
        };
        
        // Helper function to get distinct values with counts
        const getDistinctValues = (table, column, label) => {
            const foreignKey = tableToForeignKey[table];
            if (!foreignKey) {
                console.error(`No foreign key mapping found for table: ${table}`);
                return [];
            }
            
            const query = `
                SELECT ${column} as name, COUNT(*) as count
                FROM job_details jd
                LEFT JOIN ${table} t ON jd.${foreignKey} = t.id
                WHERE t.${column} IS NOT NULL
                GROUP BY t.${column}
                ORDER BY count DESC, t.${column} ASC
            `;
            return DatabaseManager.queryObjects(query);
        };
        
        // Helper function to get many-to-many values with counts
        const getM2MValues = (table, column) => {
            const query = `
                SELECT t.${column} as name, COUNT(DISTINCT jd.id) as count
                FROM job_details jd
                JOIN job_details_${table} jm ON jd.id = jm.job_details_id
                JOIN ${table} t ON jm.${table}_id = t.id
                WHERE t.${column} IS NOT NULL
                GROUP BY t.${column}
                ORDER BY count DESC, t.${column} ASC
            `;
            return DatabaseManager.queryObjects(query);
        };
        
        // Helper function to get one-to-many values (like languages)
        const getOneToManyValues = (table, column, foreignKey = 'job_detail_id') => {
            const query = `
                SELECT t.${column} as name, COUNT(DISTINCT jd.id) as count
                FROM job_details jd
                JOIN ${table} t ON jd.id = t.${foreignKey}
                WHERE t.${column} IS NOT NULL
                GROUP BY t.${column}
                ORDER BY count DESC, t.${column} ASC
            `;
            return DatabaseManager.queryObjects(query);
        };
        
        // Get metadata for each filterable field
        try {
            // Single-select fields (many-to-one)
            metadata.title = getDistinctValues('titles', 'name', 'Title');
            metadata.job_function = getDistinctValues('job_functions', 'name', 'Job Function');
            metadata.seniority_level = getDistinctValues('seniority_levels', 'name', 'Seniority');
            metadata.industry = getDistinctValues('industries', 'name', 'Industry');
            metadata.department = getDistinctValues('departments', 'name', 'Department');
            metadata.job_family = getDistinctValues('job_families', 'name', 'Job Family');
            metadata.specialization = getDistinctValues('specializations', 'name', 'Specialization');
            metadata.education_level = getDistinctValues('education_levels', 'name', 'Education');
            metadata.employment_type = getDistinctValues('employment_types', 'name', 'Employment Type');
            metadata.contract_type = getDistinctValues('contract_types', 'name', 'Contract Type');
            metadata.work_schedule = getDistinctValues('work_schedules', 'name', 'Work Schedule');
            metadata.shift_details = getDistinctValues('shift_details', 'name', 'Shift Details');
            metadata.remote_work = getDistinctValues('remote_work_options', 'name', 'Remote Work');
            metadata.travel_required = getDistinctValues('travel_requirements', 'name', 'Travel Required');
            metadata.location = getDistinctValues('cities', 'name', 'City');
            metadata.region = getDistinctValues('regions', 'name', 'Region');
            metadata.country = getDistinctValues('countries', 'name', 'Country');
            metadata.company_name = getDistinctValues('companies', 'name', 'Company');
            metadata.company_size = getDistinctValues('company_sizes', 'name', 'Company Size');
            
            // One-to-many fields (like languages)
            metadata.languages = getOneToManyValues('job_languages', 'language');
            
            // Multi-select fields (many-to-many)
            metadata.hard_skills = getM2MValues('hard_skills', 'name');
            metadata.soft_skills = getM2MValues('soft_skills', 'name');
            metadata.certifications = getM2MValues('certifications', 'name');
            metadata.licenses_required = getM2MValues('licenses', 'name');
            metadata.benefits = getM2MValues('benefits', 'description');
            metadata.work_environment = getM2MValues('work_environment', 'description');
            metadata.professional_development = getM2MValues('professional_development', 'description');
            metadata.work_life_balance = getM2MValues('work_life_balance', 'description');
            metadata.physical_requirements = getM2MValues('physical_requirements', 'description');
            metadata.work_conditions = getM2MValues('work_conditions', 'description');
            metadata.special_requirements = getM2MValues('special_requirements', 'description');
        } catch (error) {
            console.error('Error getting metadata:', error);
        }
        
        // Get total jobs count
        const totalQuery = 'SELECT COUNT(*) as total FROM job_details';
        const totalResult = DatabaseManager.queryObjects(totalQuery);
        const totalJobs = totalResult[0]?.total || 0;
        
        return {
            total_jobs: totalJobs,
            metadata: metadata
        };
    },
    
    // Get filter counts based on currently active filters
    async getFilteredCounts(fieldKey, activeFilters = {}) {
        await DatabaseManager.init();
        
        // Map field keys to table info for single-select (many-to-one) fields
        const fieldToTableMap = {
            'title': { table: 'titles', foreignKey: 'title_id', column: 'name' },
            'job_function': { table: 'job_functions', foreignKey: 'job_function_id', column: 'name' },
            'seniority_level': { table: 'seniority_levels', foreignKey: 'seniority_level_id', column: 'name' },
            'industry': { table: 'industries', foreignKey: 'industry_id', column: 'name' },
            'department': { table: 'departments', foreignKey: 'department_id', column: 'name' },
            'job_family': { table: 'job_families', foreignKey: 'job_family_id', column: 'name' },
            'specialization': { table: 'specializations', foreignKey: 'specialization_id', column: 'name' },
            'education_level': { table: 'education_levels', foreignKey: 'required_education_id', column: 'name' },
            'employment_type': { table: 'employment_types', foreignKey: 'employment_type_id', column: 'name' },
            'contract_type': { table: 'contract_types', foreignKey: 'contract_type_id', column: 'name' },
            'work_schedule': { table: 'work_schedules', foreignKey: 'work_schedule_id', column: 'name' },
            'shift_details': { table: 'shift_details', foreignKey: 'shift_details_id', column: 'name' },
            'remote_work': { table: 'remote_work_options', foreignKey: 'remote_work_id', column: 'name' },
            'travel_required': { table: 'travel_requirements', foreignKey: 'travel_required_id', column: 'name' },
            'city': { table: 'cities', foreignKey: 'city_id', column: 'name' },
            'region': { table: 'regions', foreignKey: 'region_id', column: 'name' },
            'country': { table: 'countries', foreignKey: 'country_id', column: 'name' },
            'company': { table: 'companies', foreignKey: 'company_name_id', column: 'name' },
            'company_size': { table: 'company_sizes', foreignKey: 'company_size_id', column: 'name' }
        };
        
        // Map for many-to-many fields
        const m2mFieldMap = {
            'hard_skills': { table: 'hard_skills', column: 'name' },
            'soft_skills': { table: 'soft_skills', column: 'name' },
            'certifications': { table: 'certifications', column: 'name' },
            'licenses_required': { table: 'licenses', column: 'name' },
            'benefits': { table: 'benefits', column: 'description' },
            'work_environment': { table: 'work_environment', column: 'description' },
            'professional_development': { table: 'professional_development', column: 'description' },
            'work_life_balance': { table: 'work_life_balance', column: 'description' },
            'physical_requirements': { table: 'physical_requirements', column: 'description' },
            'work_conditions': { table: 'work_conditions', column: 'description' },
            'special_requirements': { table: 'special_requirements', column: 'description' }
        };
        
        // Map for one-to-many fields like languages
        const oneToManyFieldMap = {
            'languages': { table: 'job_languages', column: 'language', foreignKey: 'job_detail_id' }
        };
        
        const tableInfo = fieldToTableMap[fieldKey];
        const m2mInfo = m2mFieldMap[fieldKey];
        const oneToManyInfo = oneToManyFieldMap[fieldKey];
        
        if (!tableInfo && !m2mInfo && !oneToManyInfo) {
            console.error(`No table mapping found for field: ${fieldKey}`);
            return [];
        }
        
        // Build WHERE clause excluding the current field
        const filtersWithoutCurrent = { ...activeFilters };
        delete filtersWithoutCurrent[fieldKey];
        
        const { whereClause, params } = this.buildWhereClause(filtersWithoutCurrent, '');
        
        // Handle one-to-many fields (like languages)
        if (oneToManyInfo) {
            const query = `
                SELECT t.${oneToManyInfo.column} as name, COUNT(DISTINCT jd.id) as count
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
                JOIN ${oneToManyInfo.table} t ON jd.id = t.${oneToManyInfo.foreignKey}
                ${whereClause}
                GROUP BY t.${oneToManyInfo.column}
                HAVING t.${oneToManyInfo.column} IS NOT NULL
                ORDER BY count DESC, t.${oneToManyInfo.column} ASC
            `;
            
            return DatabaseManager.queryObjects(query, params);
        }
        
        // Handle many-to-many fields differently
        if (m2mInfo) {
            const query = `
                SELECT t.${m2mInfo.column} as name, COUNT(DISTINCT jd.id) as count
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
                JOIN job_details_${m2mInfo.table} jm ON jd.id = jm.job_details_id
                JOIN ${m2mInfo.table} t ON jm.${m2mInfo.table}_id = t.id
                ${whereClause}
                GROUP BY t.${m2mInfo.column}
                HAVING t.${m2mInfo.column} IS NOT NULL
                ORDER BY count DESC, t.${m2mInfo.column} ASC
            `;
            
            return DatabaseManager.queryObjects(query, params);
        }
        
        // Query to get counts for this field with current filters applied
        const query = `
            SELECT t.${tableInfo.column} as name, COUNT(*) as count
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
            LEFT JOIN ${tableInfo.table} t ON jd.${tableInfo.foreignKey} = t.id
            ${whereClause}
            GROUP BY t.${tableInfo.column}
            HAVING t.${tableInfo.column} IS NOT NULL
            ORDER BY count DESC, t.${tableInfo.column} ASC
        `;
        
        return DatabaseManager.queryObjects(query, params);
    }
};

// Helper to check if filters are active
const hasActiveFilters = (filters) => {
    return Object.keys(filters).some(k => {
        const val = filters[k];
        if (Array.isArray(val)) {
            return val.length > 0;
        }
        return val !== null && val !== undefined && val !== '';
    });
};

// State Management
const state = {
    jobsIndex: null,
    currentPage: 1,
    jobs: [],
    allLoadedJobs: [], // Cache of all jobs loaded so far
    loadedJobIds: new Set(), // Track job IDs for fast duplicate checking
    loadedPages: new Set(), // Track which pages have been loaded
    filters: {
        salaryMin: null,
        salaryMax: null,
        experienceMin: null,
        experienceMax: null
    },
    loading: false,
    dbLoading: false,
    dbLoaded: false,
    dbError: null,
    analysisIndex: null,
    selectedAnalysis: null,
    selectedAnalysisData: null,
    itemsPerPage: 20, // User-configurable items per page for display
    availablePageSizes: [10, 20, 50, 100],
    sort: 'date_desc', // Default sorting: newest first
    search: '', // Global search term
    sortOptions: [
        { value: 'date_desc', label: 'Newest First', field: 'posting_date', order: 'desc' },
        { value: 'date_asc', label: 'Oldest First', field: 'posting_date', order: 'asc' },
        { value: 'salary_desc', label: 'Highest Salary', field: 'salary', order: 'desc' },
        { value: 'salary_asc', label: 'Lowest Salary', field: 'salary', order: 'asc' },
        { value: 'title_asc', label: 'Job Title A-Z', field: 'title', order: 'asc' },
        { value: 'title_desc', label: 'Job Title Z-A', field: 'title', order: 'desc' },
        { value: 'company_asc', label: 'Company A-Z', field: 'company', order: 'asc' },
        { value: 'company_desc', label: 'Company Z-A', field: 'company', order: 'desc' }
    ]
};

// Configuration constants
const DEFAULT_JOBS_PER_API_PAGE = 100;

// Utility Functions

// Map filter keys to metadata keys
const filterKeyToMetadataKey = {
    'city': 'location',
    'company': 'company_name'
};

const getMetadataKey = (filterKey) => {
    return filterKeyToMetadataKey[filterKey] || filterKey;
};

// Helper to find filter metadata for active filters
// Note: Currently only supports single filter metadata lookups.
// When multiple filters are active, returns metadata for the first one found.
// This is a limitation of the current metadata structure which doesn't include
// intersection counts for multiple filter combinations.
const getActiveFilterMetadata = (filters, jobsIndex) => {
    if (!jobsIndex || !jobsIndex.metadata) return null;
    
    let activeFilterCount = 0;
    let firstFilterMetadata = null;
    
    for (const [filterKey, filterValue] of Object.entries(filters)) {
        if (filterValue === null || filterValue === undefined || filterValue === '') continue;
        
        // Skip numeric range filters (salaryMin, salaryMax, experienceMin, experienceMax)
        if (['salaryMin', 'salaryMax', 'experienceMin', 'experienceMax'].includes(filterKey)) continue;
        
        activeFilterCount++;
        
        const metadataKey = getMetadataKey(filterKey);
        
        if (jobsIndex.metadata[metadataKey] && !firstFilterMetadata) {
            const metadataItems = jobsIndex.metadata[metadataKey];
            
            // Find the matching metadata entry
            for (const item of metadataItems) {
                if (item.name === filterValue) {
                    firstFilterMetadata = item;
                    break;
                }
            }
        }
    }
    
    // Only return metadata if there's exactly one active filter
    // When multiple filters are active, we can't use single-filter metadata counts
    return activeFilterCount === 1 ? firstFilterMetadata : null;
};

// Sort Functions
const sortJobs = (jobs, sortBy) => {
    const sortOption = state.sortOptions.find(opt => opt.value === sortBy) || state.sortOptions[0];
    const { field, order } = sortOption;
    
    return jobs.slice().sort((a, b) => {
        let aVal, bVal;
        
        // Handle different field types
        switch (field) {
            case 'salary':
                // Compare by min salary in MDL, jobs without salary data go to end
                if (hasValidSalary(a)) {
                    aVal = a.salary?.min_mdl || a.salary?.min;
                } else {
                    aVal = null; // Let the null handling logic put these at the end
                }
                
                if (hasValidSalary(b)) {
                    bVal = b.salary?.min_mdl || b.salary?.min;
                } else {
                    bVal = null; // Let the null handling logic put these at the end
                }
                break;
            case 'title':
                aVal = (a.title || '').toLowerCase();
                bVal = (b.title || '').toLowerCase();
                break;
            case 'company':
                aVal = (a.company || '').toLowerCase();
                bVal = (b.company || '').toLowerCase();
                break;
            case 'posting_date':
                aVal = new Date(a.posting_date || '1970-01-01');
                bVal = new Date(b.posting_date || '1970-01-01');
                break;
            default:
                aVal = (a[field] || '').toLowerCase();
                bVal = (b[field] || '').toLowerCase();
        }
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return order === 'asc' ? 1 : -1;
        if (bVal == null) return order === 'asc' ? -1 : 1;
        
        // Compare values
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        } else {
            comparison = aVal.toString().localeCompare(bVal.toString());
        }
        
        return order === 'asc' ? comparison : -comparison;
    });
};

// Enhanced filter matching with search functionality

const formatSalary = (salary) => {
    if (!salary) return 'Not specified';
    
    // Check if we have MDL values (handles 0 as valid salary)
    const hasMdlValues = salary.min_mdl != null;
    
    if (hasMdlValues) {
        // Use MDL values
        const minMdl = salary.min_mdl;
        const maxMdl = salary.max_mdl;
        
        if (minMdl == null) return 'Not specified';
        
        const minStr = minMdl.toLocaleString();
        const maxStr = maxMdl != null ? maxMdl.toLocaleString() : '';
        const mdlRange = maxStr ? `${minStr} - ${maxStr} MDL` : `${minStr} MDL`;
        
        // Show original currency if different from MDL
        if (salary.currency && salary.currency.toUpperCase() !== 'MDL' && salary.min != null) {
            const origMin = salary.min.toLocaleString();
            const origMax = salary.max != null ? salary.max.toLocaleString() : '';
            const origRange = origMax ? `${origMin} - ${origMax} ${salary.currency.toUpperCase()}` : `${origMin} ${salary.currency.toUpperCase()}`;
            return `${mdlRange} (${origRange})`;
        }
        
        return mdlRange;
    } else {
        // Fallback: no MDL conversion available
        // Only use if currency is MDL or not specified (assume MDL for Moldova market)
        const currency = salary.currency ? salary.currency.toUpperCase() : 'MDL';
        
        if (salary.min == null) return 'Not specified';
        
        const minStr = salary.min.toLocaleString();
        const maxStr = salary.max != null ? salary.max.toLocaleString() : '';
        return maxStr ? `${minStr} - ${maxStr} ${currency}` : `${minStr} ${currency}`;
    }
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
};

// Components

// Header Component
const Header = {
    view: () => m('div', { class: 'navbar bg-base-100 shadow-lg' }, [
        m('div', { class: 'navbar-start' }, [
            m('a', { 
                class: 'btn btn-ghost text-xl', 
                href: '#!/',
                oncreate: m.route.link 
            }, 'Moldova Job Market')
        ]),
        m('div', { class: 'navbar-center hidden lg:flex' }, [
            m('ul', { class: 'menu menu-horizontal px-1' }, [
                m('li', m('a', { href: '#!/', oncreate: m.route.link }, 'Home')),
                m('li', m('a', { href: '#!/jobs', oncreate: m.route.link }, 'Jobs')),
                m('li', m('a', { href: '#!/analysis', oncreate: m.route.link }, 'Analysis'))
            ])
        ]),
        m('div', { class: 'navbar-end' }, [
            m('label', { class: 'swap swap-rotate btn btn-ghost btn-circle' }, [
                m('input', { 
                    type: 'checkbox',
                    onchange: (e) => {
                        const theme = e.target.checked ? 'dark' : 'light';
                        document.documentElement.setAttribute('data-theme', theme);
                    }
                }),
                m('svg', { class: 'swap-on fill-current w-6 h-6', xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' }, 
                    m('path', { d: 'M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z' })),
                m('svg', { class: 'swap-off fill-current w-6 h-6', xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' }, 
                    m('path', { d: 'M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z' }))
            ])
        ])
    ])
};

// Footer Component
const Footer = {
    view: () => m('footer', { class: 'footer footer-center p-4 bg-base-300 text-base-content mt-8' }, [
        m('div', [
            m('p', '© 2026 Moldova Job Market - Data updated regularly')
        ])
    ])
};

// Loading Component
const Loading = {
    view: () => m('div', { class: 'flex justify-center items-center h-64' }, [
        m('span', { class: 'loading loading-spinner loading-lg' })
    ])
};

// Home Page
const HomePage = {
    oninit: async () => {
        try {
            state.dbLoading = true;
            await DatabaseManager.init();
            state.dbLoaded = true;
            
            const metadata = await dbApi.getMetadata();
            state.jobsIndex = metadata;
            state.dbLoading = false;
            m.redraw();
        } catch (error) {
            console.error('Failed to load database:', error);
            state.dbError = error;
            state.dbLoading = false;
            m.redraw();
        }
    },
    view: () => m('div', { class: 'container mx-auto px-4 py-8' }, [
        state.dbLoading ? m('div', { class: 'hero min-h-[50vh] bg-base-200 rounded-lg' }, [
            m('div', { class: 'hero-content text-center' }, [
                m('div', { class: 'max-w-md' }, [
                    m('h1', { class: 'text-5xl font-bold mb-4' }, 'Moldova Job Market'),
                    m('div', { class: 'flex flex-col items-center gap-4' }, [
                        m('span', { class: 'loading loading-spinner loading-lg' }),
                        m('p', { class: 'text-sm opacity-70' }, 'Loading job database...')
                    ])
                ])
            ])
        ]) : state.dbError ? m('div', { class: 'hero min-h-[50vh] bg-base-200 rounded-lg' }, [
            m('div', { class: 'hero-content text-center' }, [
                m('div', { class: 'max-w-md' }, [
                    m('h1', { class: 'text-5xl font-bold' }, 'Moldova Job Market'),
                    m('div', { class: 'alert alert-error mt-6' }, [
                        m('span', 'Failed to load database. Please make sure data.db is available in /public/')
                    ])
                ])
            ])
        ]) : m('div', { class: 'hero min-h-[50vh] bg-base-200 rounded-lg' }, [
            m('div', { class: 'hero-content text-center' }, [
                m('div', { class: 'max-w-md' }, [
                    m('h1', { class: 'text-5xl font-bold' }, 'Moldova Job Market'),
                    m('p', { class: 'py-6' }, 'Browse thousands of job opportunities across Moldova. Filter by location, salary, skills, and more.'),
                    state.jobsIndex ? 
                        m('a', { 
                            class: 'stats shadow cursor-pointer hover:shadow-xl transition-shadow justify-center',
                            href: '#!/jobs',
                            oncreate: m.route.link,
                            'aria-label': 'Browse all jobs'
                        }, [
                            m('div', { class: 'stat place-items-center' }, [
                                m('div', { class: 'stat-title' }, 'Total Jobs'),
                                m('div', { class: 'stat-value text-primary' }, state.jobsIndex.total_jobs.toLocaleString()),
                                m('div', { class: 'stat-desc' }, 'Click to browse jobs')
                            ])
                        ])
                    : m(Loading)
                ])
            ])
        ])
    ])
};

// Job List Item Component (Extra Slim - HN Style)
const JobListItem = {
    view: (vnode) => {
        const job = vnode.attrs.job;
        return m('div', { class: 'px-2 py-1 border-b border-base-300 hover:bg-base-200' }, [
            m('div', { class: 'flex items-start gap-2' }, [
                m('span', { class: 'text-xs opacity-60 mt-1' }, `${vnode.attrs.index}.`),
                m('div', { class: 'flex-1' }, [
                    m('a', { 
                        href: `#!/jobs/${job.id}`,
                        class: 'text-sm font-medium hover:underline text-base-content',
                        oncreate: m.route.link
                    }, job.title),
                    m('div', { class: 'flex flex-wrap gap-2 mt-1 text-xs opacity-70' }, [
                        job.company && m('span', { class: 'badge badge-outline badge-sm' }, job.company),
                        job.location && job.location.city && m('span', job.location.city),
                        job.salary && m('span', formatSalary(job.salary)),
                        job.posting_date && m('span', formatDate(job.posting_date))
                    ])
                ])
            ])
        ]);
    }
};

// Helper function to check if a job has valid salary data
const hasValidSalary = (job) => {
    return (job.salary?.min_mdl || job.salary?.min) && (job.salary?.max_mdl || job.salary?.max);
};

// Helper function to get field value from a job object
const getJobFieldValue = (job, fieldKey) => {
    switch (fieldKey) {
        case 'title': return job.title;
        case 'job_function': return job.job_function;
        case 'seniority_level': return job.seniority_level;
        case 'industry': return job.industry;
        case 'department': return job.department;
        case 'job_family': return job.job_family;
        case 'specialization': return job.specialization;
        case 'education_level': return job.requirements?.education;
        case 'languages': return job.requirements?.languages;
        case 'hard_skills': return job.requirements?.hard_skills;
        case 'soft_skills': return job.requirements?.soft_skills;
        case 'certifications': return job.requirements?.certifications;
        case 'licenses_required': return job.requirements?.licenses;
        case 'employment_type': return job.employment?.type;
        case 'contract_type': return job.employment?.contract_type;
        case 'work_schedule': return job.employment?.work_schedule;
        case 'shift_details': return job.employment?.shift_details;
        case 'remote_work': return job.employment?.remote_work;
        case 'travel_required': return job.employment?.travel_required;
        case 'city': return job.location?.city;
        case 'region': return job.location?.region;
        case 'country': return job.location?.country;
        case 'company_name': return job.company;
        case 'company_size': return job.company_size;
        case 'benefits': return job.benefits;
        case 'work_environment': return job.work_environment;
        case 'professional_development': return job.professional_development;
        case 'work_life_balance': return job.work_life_balance;
        case 'physical_requirements': return job.physical_requirements;
        case 'work_conditions': return job.work_conditions;
        case 'special_requirements': return job.special_requirements;
        default: return null;
    }
};

// Filter matching logic - ALL filters work as AND (combined)
const matchesFilters = (job, filters) => {
    for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined || value === '') continue;
        
        switch (key) {
            // Job Details
            case 'title':
                if (job.title !== value) return false;
                break;
            case 'job_function':
                if (job.job_function !== value) return false;
                break;
            case 'seniority_level':
                if (job.seniority_level !== value) return false;
                break;
            case 'industry':
                if (job.industry !== value) return false;
                break;
            case 'department':
                if (job.department !== value) return false;
                break;
            case 'job_family':
                if (job.job_family !== value) return false;
                break;
            case 'specialization':
                if (job.specialization !== value) return false;
                break;
            
            // Requirements
            case 'education_level':
                if (job.requirements?.education !== value) return false;
                break;
            case 'languages':
                if (!job.requirements?.languages || !job.requirements.languages.includes(value)) return false;
                break;
            case 'hard_skills':
                if (!job.requirements?.hard_skills || !job.requirements.hard_skills.some(skill => skill.includes(value))) return false;
                break;
            case 'soft_skills':
                if (!job.requirements?.soft_skills || !job.requirements.soft_skills.some(skill => skill.includes(value))) return false;
                break;
            case 'certifications':
                if (!job.requirements?.certifications || !job.requirements.certifications.includes(value)) return false;
                break;
            case 'licenses_required':
                if (!job.requirements?.licenses || !job.requirements.licenses.includes(value)) return false;
                break;
            
            // Work Arrangement
            case 'employment_type':
                if (job.employment?.type !== value) return false;
                break;
            case 'contract_type':
                if (job.employment?.contract !== value) return false;
                break;
            case 'work_schedule':
                if (job.employment?.schedule !== value) return false;
                break;
            case 'shift_details':
                if (job.employment?.shift !== value) return false;
                break;
            case 'remote_work':
                if (job.location?.remote_work !== value) return false;
                break;
            case 'travel_required':
                if (job.requirements?.travel !== value) return false;
                break;
            
            // Location
            case 'city':
                if (job.location?.city !== value) return false;
                break;
            case 'region':
                if (job.location?.region !== value) return false;
                break;
            case 'country':
                if (job.location?.country !== value) return false;
                break;
            
            // Company
            case 'company':
                if (job.company !== value) return false;
                break;
            case 'company_size':
                if (job.company_size !== value) return false;
                break;
            
            // Benefits & Culture
            case 'benefits':
                if (!job.benefits || !job.benefits.includes(value)) return false;
                break;
            case 'work_environment':
                if (!job.work_environment || !job.work_environment.includes(value)) return false;
                break;
            case 'professional_development':
                if (!job.professional_development || !job.professional_development.includes(value)) return false;
                break;
            case 'work_life_balance':
                if (!job.work_life_balance || !job.work_life_balance.includes(value)) return false;
                break;
            
            // Conditions
            case 'physical_requirements':
                if (!job.requirements?.physical || !job.requirements.physical.includes(value)) return false;
                break;
            case 'work_conditions':
                if (!job.work_conditions || !job.work_conditions.includes(value)) return false;
                break;
            case 'special_requirements':
                if (!job.requirements?.special || !job.requirements.special.includes(value)) return false;
                break;
            
            // Numeric Filters
            case 'salaryMin':
                // Filter out jobs without salary specified
                if (!hasValidSalary(job)) return false;
                const jobMinSalary = job.salary?.min_mdl || job.salary?.min;
                if (jobMinSalary < value) return false;
                break;
            case 'salaryMax':
                // Filter out jobs without salary specified
                if (!hasValidSalary(job)) return false;
                const jobMaxSalary = job.salary?.max_mdl || job.salary?.max;
                if (jobMaxSalary > value) return false;
                break;
            case 'experienceMin':
                const jobExpYears = job.requirements?.experience_years;
                if (jobExpYears === null || jobExpYears === undefined) return false;
                if (jobExpYears < value) return false;
                break;
            case 'experienceMax':
                const jobExpYearsMax = job.requirements?.experience_years;
                if (jobExpYearsMax === null || jobExpYearsMax === undefined) return false;
                if (jobExpYearsMax > value) return false;
                break;
        }
    }
    return true;
};

// Get available filter options based on current filters (hierarchical)
const getAvailableOptions = (jobs, filterKey) => {
    const options = new Set();
    jobs.forEach(job => {
        let value;
        switch (filterKey) {
            case 'job_function':
                value = job.job_function;
                break;
            case 'seniority_level':
                value = job.seniority_level;
                break;
            case 'city':
                value = job.location?.city;
                break;
            case 'remote_work':
                value = job.location?.remote_work;
                break;
            case 'industry':
                value = job.industry;
                break;
            case 'company':
                value = job.company;
                break;
            case 'employment_type':
                value = job.employment?.type;
                break;
            case 'contract_type':
                value = job.employment?.contract;
                break;
        }
        if (value) options.add(value);
    });
    return Array.from(options).sort();
};

// Filter Component with Hierarchical Filtering (Left Sidebar)
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

// Jobs Page
const JobsPage = {
    displayPage: 1, // Current display page for filtered results
    loadingMore: false,
    
    oninit: async () => {
        // Initialize URL state before loading data
        const urlState = URLState.initialize();
        
        // Apply URL state to our state objects
        if (urlState) {
            Object.assign(state.filters, urlState.filters);
            JobsPage.displayPage = urlState.page;
            state.itemsPerPage = urlState.itemsPerPage;
            state.sort = urlState.sort;
            state.search = urlState.search;
        }
        
        // Ensure database is loaded
        state.loading = true;
        try {
            await DatabaseManager.init();
            state.dbLoaded = true;
            
            // Load metadata if not already loaded
            if (!state.jobsIndex) {
                const metadata = await dbApi.getMetadata();
                state.jobsIndex = metadata;
            }
            
            // Load initial jobs
            await JobsPage.loadJobs();
            
            state.loading = false;
            m.redraw();
        } catch (err) {
            console.error('Error loading jobs:', err);
            state.dbError = err;
            state.loading = false;
            m.redraw();
        }
    },
    
    loadJobs: async () => {
        try {
            const result = await dbApi.getJobs(
                JobsPage.displayPage,
                state.itemsPerPage,
                state.filters,
                state.search,
                state.sort
            );
            
            state.jobs = result.jobs;
            state.totalJobs = result.total;
            state.totalPages = result.totalPages;
            
        } catch (err) {
            console.error('Error loading jobs:', err);
            state.jobs = [];
        }
    },
    
    navigateToPage: async (pageNumber) => {
        JobsPage.displayPage = pageNumber;
        window.scrollTo(0, 0);
        
        // Update URL with new page number
        URLState.update();
        
        // Load jobs for this page
        await JobsPage.loadJobs();
        m.redraw();
    },
    
    renderPagination: (totalPages) => {
        if (totalPages <= 1) return null;
        
        const currentPage = JobsPage.displayPage;
        const pageButtons = [];
        
        // First page button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === 1 ? 'btn-disabled' : ''}`,
                disabled: currentPage === 1,
                onclick: () => JobsPage.navigateToPage(1)
            }, '« First')
        );
        
        // Previous button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === 1 ? 'btn-disabled' : ''}`,
                disabled: currentPage === 1,
                onclick: () => JobsPage.navigateToPage(currentPage - 1)
            }, '‹ Prev')
        );
        
        // Page number buttons: show current, -3 to +3
        const startPage = Math.max(1, currentPage - 3);
        const endPage = Math.min(totalPages, currentPage + 3);
        
        if (startPage > 1) {
            pageButtons.push(m('div', { class: 'px-2 py-1 text-sm text-gray-500' }, '...'));
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageButtons.push(
                m('button', {
                    class: `btn btn-sm ${i === currentPage ? 'btn-primary' : ''}`,
                    onclick: () => JobsPage.navigateToPage(i)
                }, i)
            );
        }
        
        if (endPage < totalPages) {
            pageButtons.push(m('div', { class: 'px-2 py-1 text-sm text-gray-500' }, '...'));
        }
        
        // Next button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : ''}`,
                disabled: currentPage === totalPages,
                onclick: () => JobsPage.navigateToPage(currentPage + 1)
            }, 'Next ›')
        );
        
        // Last page button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : ''}`,
                disabled: currentPage === totalPages,
                onclick: () => JobsPage.navigateToPage(totalPages)
            }, 'Last »')
        );
        
        return m('div', { class: 'flex justify-center gap-1 items-center flex-wrap' }, pageButtons);
    },
    
    view: () => {
        const jobs = state.jobs || [];
        const total = state.totalJobs || 0;
        const totalPages = state.totalPages || 0;
        
        return m('div', { class: 'flex min-h-0 flex-1' }, [
            // Left Sidebar - Filters
            state.jobsIndex && m('div', { class: 'w-80 border-r border-base-300 overflow-y-auto' }, [
                m(FilterPanel)
            ]),
            
            // Main Content Area
            m('div', { class: 'flex-1 overflow-y-auto min-h-0' }, [
                m('div', { class: 'container mx-auto px-4 py-8' }, [
                    state.loading ? m(Loading) : [
                        JobsPage.renderPagination(totalPages),
                        
                        m('div', { class: 'bg-base-100 rounded-lg shadow my-4' }, [
                            jobs.length > 0 ? 
                                jobs.map((job, idx) => m(JobListItem, { 
                                    job, 
                                    index: ((JobsPage.displayPage - 1) * state.itemsPerPage) + idx + 1 
                                })) :
                                m('div', { class: 'text-center py-8 opacity-70' }, 
                                    hasActiveFilters(state.filters) || state.search ? 'No jobs match your filters. Try adjusting your criteria.' : 'No jobs found'
                                )
                        ]),
                        
                        // Bottom pagination
                        JobsPage.renderPagination(totalPages),
                        
                        // Stats footer
                        m('div', { class: 'text-center text-sm opacity-70 mt-4' }, 
                            `Showing ${jobs.length > 0 ? ((JobsPage.displayPage - 1) * state.itemsPerPage) + 1 : 0} - ${((JobsPage.displayPage - 1) * state.itemsPerPage) + jobs.length} of ${total.toLocaleString()} jobs`
                        )
                    ]
                ])
            ])
        ]);
    }
};

// Job Detail Page
const JobDetailPage = {
    job: null,
    activeTab: 'parsed',
    oninit: async (vnode) => {
        const jobId = parseInt(vnode.attrs.id);
        
        // Try to get job from database using SQL
        JobDetailPage.job = null;
        
        try {
            await DatabaseManager.init();
            
            // Query for specific job by ID
            const query = `
                SELECT 
                    jd.id,
                    t.name as title,
                    jf.name as job_function,
                    sp.name as specialization,
                    sl.name as seniority_level,
                    c.name as company,
                    cs.name as company_size,
                    ci.name as city,
                    reg.name as region,
                    cou.name as country,
                    rw.name as remote_work,
                    jd.min_salary,
                    jd.max_salary,
                    curr.code as salary_currency,
                    sper.name as salary_period,
                    et.name as employment_type,
                    ct.name as contract_type,
                    ws.name as work_schedule,
                    el.name as education_level,
                    jd.experience_years,
                    jd.posting_date,
                    jd.site,
                    jd.job_url,
                    jd.job_title as original_title,
                    jd.company_name as original_company,
                    jd.job_description as original_description,
                    ind.name as industry,
                    d.name as department,
                    jf2.name as job_family,
                    sd.name as shift_details,
                    tr.name as travel_requirements
                FROM job_details jd
                LEFT JOIN titles t ON jd.title_id = t.id
                LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
                LEFT JOIN specializations sp ON jd.specialization_id = sp.id
                LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
                LEFT JOIN companies c ON jd.company_name_id = c.id
                LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
                LEFT JOIN cities ci ON jd.city_id = ci.id
                LEFT JOIN regions reg ON jd.region_id = reg.id
                LEFT JOIN countries cou ON jd.country_id = cou.id
                LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
                LEFT JOIN currencies curr ON jd.salary_currency_id = curr.id
                LEFT JOIN salary_periods sper ON jd.salary_period_id = sper.id
                LEFT JOIN employment_types et ON jd.employment_type_id = et.id
                LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
                LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
                LEFT JOIN education_levels el ON jd.required_education_id = el.id
                LEFT JOIN industries ind ON jd.industry_id = ind.id
                LEFT JOIN departments d ON jd.department_id = d.id
                LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
                LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
                LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
                WHERE jd.id = ?
            `;
            
            const jobs = DatabaseManager.queryObjects(query, [jobId]);
            
            if (jobs.length > 0) {
                // Format the job
                JobDetailPage.job = await dbApi.formatJob(jobs[0]);
                m.redraw();
            }
        } catch (err) {
            console.error('Error loading job:', err);
        }
    },
    view: () => {
        if (!JobDetailPage.job) return m('div', { class: 'container mx-auto px-4 py-8' }, [
            m('div', { class: 'mb-4' }, [
                m('a', { 
                    href: '#!/jobs',
                    class: 'btn btn-sm btn-ghost',
                    oncreate: m.route.link
                }, '← Back to Jobs')
            ]),
            m(Loading)
        ]);
        
        const job = JobDetailPage.job;
        
        return m('div', { class: 'container mx-auto px-4 py-8' }, [
            m('div', { class: 'mb-4' }, [
                m('a', { 
                    href: '#!/jobs',
                    class: 'btn btn-sm btn-ghost',
                    oncreate: m.route.link
                }, '← Back to Jobs')
            ]),
            
            m('div', { class: 'card bg-base-100 shadow-xl' }, [
                m('div', { class: 'card-body' }, [
                    m('h1', { class: 'card-title text-2xl' }, job.title),
                    m('div', { class: 'flex flex-wrap gap-2 mb-4' }, [
                        job.company && m('span', { class: 'badge badge-primary' }, job.company),
                        job.location?.city && m('span', { class: 'badge badge-secondary' }, job.location.city),
                        job.seniority_level && m('span', { class: 'badge badge-accent' }, job.seniority_level)
                    ]),
                    
                    // Tabs
                    m('div', { class: 'tabs tabs-boxed mb-4' }, [
                        m('a', { 
                            class: `tab ${JobDetailPage.activeTab === 'parsed' ? 'tab-active' : ''}`,
                            onclick: () => JobDetailPage.activeTab = 'parsed'
                        }, 'Job Details'),
                        m('a', { 
                            class: `tab ${JobDetailPage.activeTab === 'raw' ? 'tab-active' : ''}`,
                            onclick: () => JobDetailPage.activeTab = 'raw'
                        }, 'Source Info')
                    ]),
                    
                    // Tab Content
                    JobDetailPage.activeTab === 'parsed' ? [
                        // Job Details View
                        m('div', { class: 'space-y-4' }, [
                            // Salary
                            job.salary && m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Salary'),
                                m('p', formatSalary(job.salary))
                            ]),
                            
                            // Location
                            job.location && m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Location'),
                                m('p', [
                                    job.location.city && m('span', job.location.city),
                                    job.location.region && m('span', `, ${job.location.region}`),
                                    job.location.country && m('span', `, ${job.location.country}`)
                                ]),
                                job.location.remote_work && m('p', [
                                    m('strong', 'Remote: '),
                                    job.location.remote_work
                                ])
                            ]),
                            
                            // Employment
                            job.employment && m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Employment'),
                                job.employment.type && m('p', [m('strong', 'Type: '), job.employment.type]),
                                job.employment.contract && m('p', [m('strong', 'Contract: '), job.employment.contract]),
                                job.employment.schedule && m('p', [m('strong', 'Schedule: '), job.employment.schedule])
                            ]),
                            
                            // Requirements
                            job.requirements && m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Requirements'),
                                job.requirements.education && m('p', [
                                    m('strong', 'Education: '),
                                    job.requirements.education
                                ]),
                                job.requirements.experience_years && m('p', [
                                    m('strong', 'Experience: '),
                                    `${job.requirements.experience_years} years`
                                ]),
                                job.requirements.languages && job.requirements.languages.length > 0 && m('div', [
                                    m('strong', 'Languages: '),
                                    m('div', { class: 'flex flex-wrap gap-2 mt-2' },
                                        job.requirements.languages.map(lang => 
                                            m('span', { class: 'badge badge-outline' }, lang)
                                        )
                                    )
                                ]),
                                job.requirements.hard_skills && job.requirements.hard_skills.length > 0 && m('div', [
                                    m('strong', 'Skills: '),
                                    m('div', { class: 'flex flex-wrap gap-2 mt-2' },
                                        job.requirements.hard_skills.map(skill => 
                                            m('span', { class: 'badge badge-primary' }, skill)
                                        )
                                    )
                                ]),
                                job.requirements.soft_skills && job.requirements.soft_skills.length > 0 && m('div', [
                                    m('strong', 'Soft Skills: '),
                                    m('div', { class: 'flex flex-wrap gap-2 mt-2' },
                                        job.requirements.soft_skills.map(skill => 
                                            m('span', { class: 'badge badge-secondary' }, skill)
                                        )
                                    )
                                ])
                            ]),
                            
                            // Responsibilities
                            job.parsed_view?.responsibilities && job.parsed_view.responsibilities.length > 0 && m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Responsibilities'),
                                m('ul', { class: 'list-disc list-inside space-y-1' },
                                    job.parsed_view.responsibilities.map(r => m('li', r))
                                )
                            ]),
                            
                            // Benefits
                            job.benefits && job.benefits.length > 0 && m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Benefits'),
                                m('div', { class: 'flex flex-wrap gap-2' },
                                    job.benefits.map(b => m('span', { class: 'badge badge-success' }, b))
                                )
                            ])
                        ])
                    ] : [
                        // Source Info View - Show raw original job description
                        m('div', { class: 'space-y-4' }, [
                            m('div', [
                                m('h3', { class: 'font-bold mb-2' }, 'Source Information'),
                                job.source?.site && m('p', [m('strong', 'Source: '), job.source.site]),
                                job.source?.url && m('div', { class: 'mt-2' }, [
                                    m('a', { 
                                        href: job.source.url, 
                                        target: '_blank',
                                        class: 'btn btn-primary btn-sm'
                                    }, 'View Original Posting →')
                                ]),
                                job.posting_date && m('p', { class: 'mt-2' }, [
                                    m('strong', 'Posted: '), 
                                    formatDate(job.posting_date)
                                ])
                            ]),
                            // Show raw original data
                            job.raw && m('div', { class: 'mt-4' }, [
                                m('h3', { class: 'font-bold mb-2' }, 'Original Job Posting'),
                                job.raw.original_title && m('div', { class: 'mb-2' }, [
                                    m('p', { class: 'text-sm text-gray-500' }, 'Original Title:'),
                                    m('p', { class: 'font-medium' }, job.raw.original_title)
                                ]),
                                job.raw.original_company && m('div', { class: 'mb-2' }, [
                                    m('p', { class: 'text-sm text-gray-500' }, 'Original Company:'),
                                    m('p', { class: 'font-medium' }, job.raw.original_company)
                                ]),
                                job.raw.original_description && m('div', { class: 'mt-4' }, [
                                    m('p', { class: 'text-sm text-gray-500 mb-2' }, 'Original Description:'),
                                    m('div', { class: 'bg-base-200 p-4 rounded-lg max-h-96 overflow-y-auto' }, [
                                        m('pre', { class: 'whitespace-pre-wrap text-sm' }, job.raw.original_description)
                                    ])
                                ])
                            ])
                        ])
                    ]
                ])
            ])
        ]);
    }
};

// Helper object for field name mapping (backward compatibility)
const FieldMapping = {
    map: {
        'function': ['function'],
        'seniority': ['seniority', 'seniority_level'],
        'location': ['location', 'city'],
        'size': ['size', 'company_size'],
        'education': ['education', 'education_level']
    },
    getValue: (item, fieldName) => {
        if (FieldMapping.map[fieldName]) {
            for (const field of FieldMapping.map[fieldName]) {
                if (field in item && item[field] !== null && item[field] !== undefined) {
                    return item[field];
                }
            }
        }
        return item[fieldName];
    },
    extractLabel: (item) => {
        // Try known field mappings first
        for (const fieldName of ['function', 'seniority', 'location', 'size', 'education']) {
            const value = FieldMapping.getValue(item, fieldName);
            if (value !== null && value !== undefined) return value;
        }
        // Fallback to other common fields
        return item.employment_type || item.remote_option || 
               item.benefit || item.name || item.skill || 
               item.company || 'Unknown';
    }
};

// Chart Helper Functions
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
        // Generate an array of colors for charts
        return Array.from({ length: count }, (_, i) => {
            const hue = (i * 360 / count);
            return `hsla(${hue}, 70%, 60%, 0.7)`;
        });
    }
};

// Custom Analysis Builder State
const CustomAnalysisState = {
    savedQueries: [],
    currentQuery: {
        name: '',
        description: '',
        sql: '',
        chartType: 'bar',
        chartConfig: null,  // Custom chart configuration
        dataAdapter: null,  // JS function to transform data
        labelColumn: null,  // Column to use for labels (auto-detect if null)
        valueColumns: []    // Columns to use for values (auto-detect if empty)
    },
    queryResult: null,
    chartInstance: null,
    showHelp: false,
    showStatistics: true,  // Enable statistical computations
    
    // Load saved queries from localStorage
    loadSavedQueries: () => {
        try {
            const saved = localStorage.getItem('customAnalysisQueries');
            if (saved) {
                CustomAnalysisState.savedQueries = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load saved queries:', e);
        }
    },
    
    // Save queries to localStorage
    saveQueries: () => {
        try {
            localStorage.setItem('customAnalysisQueries', JSON.stringify(CustomAnalysisState.savedQueries));
        } catch (e) {
            console.error('Failed to save queries:', e);
        }
    },
    
    // Add new query
    addQuery: (query) => {
        CustomAnalysisState.savedQueries.push({
            ...query,
            id: Date.now(),
            createdAt: new Date().toISOString()
        });
        CustomAnalysisState.saveQueries();
    },
    
    // Delete query
    deleteQuery: (id) => {
        CustomAnalysisState.savedQueries = CustomAnalysisState.savedQueries.filter(q => q.id !== id);
        CustomAnalysisState.saveQueries();
    },
    
    // Execute query
    executeQuery: async (sql) => {
        try {
            await DatabaseManager.init();
            let results = DatabaseManager.queryObjects(sql);
            
            // Apply data adapter if provided
            if (CustomAnalysisState.currentQuery.dataAdapter) {
                try {
                    const adapterFn = new Function('data', CustomAnalysisState.currentQuery.dataAdapter);
                    results = adapterFn(results);
                } catch (e) {
                    console.error('Data adapter error:', e);
                }
            }
            
            // Calculate statistics for numeric columns
            const statistics = CustomAnalysisState.showStatistics ? CustomAnalysisState.calculateStatistics(results) : null;
            
            CustomAnalysisState.queryResult = {
                success: true,
                data: results,
                rowCount: results.length,
                statistics: statistics
            };
        } catch (error) {
            CustomAnalysisState.queryResult = {
                success: false,
                error: error.message || 'Query execution failed'
            };
        }
        m.redraw();
    },
    
    // Calculate statistics for numeric columns
    calculateStatistics: (data) => {
        if (!data || data.length === 0) return null;
        
        const stats = {};
        const firstRow = data[0];
        
        // Find numeric columns
        Object.keys(firstRow).forEach(key => {
            const values = data.map(row => row[key]).filter(v => typeof v === 'number' && !isNaN(v));
            
            if (values.length > 0) {
                const sorted = [...values].sort((a, b) => a - b);
                const sum = values.reduce((a, b) => a + b, 0);
                const mean = sum / values.length;
                
                // Median
                const mid = Math.floor(sorted.length / 2);
                const median = sorted.length % 2 === 0 
                    ? (sorted[mid - 1] + sorted[mid]) / 2 
                    : sorted[mid];
                
                // Mode (most frequent value)
                const frequency = {};
                let maxFreq = 0;
                let mode = null;
                values.forEach(v => {
                    frequency[v] = (frequency[v] || 0) + 1;
                    if (frequency[v] > maxFreq) {
                        maxFreq = frequency[v];
                        mode = v;
                    }
                });
                
                // Standard deviation
                const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
                const stdDev = Math.sqrt(variance);
                
                // Percentiles
                const percentile = (p) => {
                    const index = (p / 100) * (sorted.length - 1);
                    const lower = Math.floor(index);
                    const upper = Math.ceil(index);
                    const weight = index - lower;
                    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
                };
                
                stats[key] = {
                    count: values.length,
                    min: sorted[0],
                    max: sorted[sorted.length - 1],
                    mean: mean,
                    median: median,
                    mode: mode,
                    stdDev: stdDev,
                    p25: percentile(25),
                    p50: median,
                    p75: percentile(75),
                    p90: percentile(90),
                    p95: percentile(95),
                    p99: percentile(99)
                };
            }
        });
        
        return Object.keys(stats).length > 0 ? stats : null;
    }
};

// Predefined Analysis Queries
const PredefinedAnalyses = [
    // === TEMPORAL TRENDS (7 charts) ===
    {
        name: 'Job Postings Over Time',
        description: 'Track daily job openings showing peak hiring seasons',
        sql: `SELECT 
    DATE(posting_date) as date,
    COUNT(*) as job_count,
    COUNT(DISTINCT company_name_id) as company_count
FROM job_details
WHERE posting_date >= date('now', '-90 days')
GROUP BY DATE(posting_date)
ORDER BY date ASC`,
        chartType: 'line',
        category: 'temporal'
    },
    {
        name: 'Hiring Trends by Month',
        description: 'Monthly hiring patterns to identify best times to job hunt',
        sql: `SELECT 
    strftime('%Y-%m', posting_date) as month,
    COUNT(*) as job_count,
    AVG(max_salary) as avg_max_salary
FROM job_details
WHERE posting_date >= date('now', '-12 months')
  AND max_salary IS NOT NULL
GROUP BY month
ORDER BY month ASC`,
        chartType: 'line',
        category: 'temporal'
    },
    {
        name: 'High-Salary Job Postings Timeline',
        description: 'Track when high-paying jobs (top 25%) are posted',
        sql: `SELECT 
    DATE(posting_date) as date,
    COUNT(*) as high_salary_jobs,
    AVG(max_salary) as avg_max_salary
FROM job_details
WHERE max_salary >= (SELECT CAST(AVG(max_salary) * 1.25 AS INTEGER) FROM job_details WHERE max_salary IS NOT NULL)
  AND posting_date >= date('now', '-90 days')
GROUP BY date
ORDER BY date ASC`,
        chartType: 'line',
        category: 'temporal'
    },
    {
        name: 'Job Posting Velocity by Industry',
        description: 'Which industries are hiring fastest in recent weeks',
        sql: `SELECT 
    i.name as industry,
    COUNT(*) as recent_jobs,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM job_details WHERE posting_date >= date('now', '-30 days')), 2) as percentage
FROM job_details jd
JOIN industries i ON jd.industry_id = i.id
WHERE jd.posting_date >= date('now', '-30 days')
GROUP BY i.name
ORDER BY recent_jobs DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'temporal'
    },
    {
        name: 'Seasonal Hiring Patterns',
        description: 'Best months to apply based on historical data',
        sql: `SELECT 
    CASE CAST(strftime('%m', posting_date) AS INTEGER)
        WHEN 1 THEN 'January'
        WHEN 2 THEN 'February'
        WHEN 3 THEN 'March'
        WHEN 4 THEN 'April'
        WHEN 5 THEN 'May'
        WHEN 6 THEN 'June'
        WHEN 7 THEN 'July'
        WHEN 8 THEN 'August'
        WHEN 9 THEN 'September'
        WHEN 10 THEN 'October'
        WHEN 11 THEN 'November'
        ELSE 'December'
    END as month,
    COUNT(*) as job_count,
    AVG(max_salary) as avg_max_salary
FROM job_details
WHERE max_salary IS NOT NULL
GROUP BY strftime('%m', posting_date)
ORDER BY CAST(strftime('%m', posting_date) AS INTEGER)`,
        chartType: 'line',
        category: 'temporal'
    },
    {
        name: 'Weekly Posting Patterns',
        description: 'Best days of the week to find new job postings',
        sql: `SELECT 
    CASE CAST(strftime('%w', posting_date) AS INTEGER)
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        ELSE 'Saturday'
    END as day_of_week,
    COUNT(*) as job_count,
    ROUND(AVG(max_salary)) as avg_max_salary
FROM job_details
WHERE max_salary IS NOT NULL
  AND posting_date >= date('now', '-90 days')
GROUP BY strftime('%w', posting_date)
ORDER BY CAST(strftime('%w', posting_date) AS INTEGER)`,
        chartType: 'bar',
        category: 'temporal'
    },
    {
        name: 'Job Market Growth Rate',
        description: 'Month-over-month growth in job postings',
        sql: `SELECT 
    strftime('%Y-%m', posting_date) as month,
    COUNT(*) as job_count
FROM job_details
WHERE posting_date >= date('now', '-12 months')
GROUP BY month
ORDER BY month ASC`,
        chartType: 'line',
        category: 'temporal'
    },

    // === SKILLS ANALYSIS (10 charts) ===
    {
        name: 'Top Skills in Demand',
        description: 'Most requested skills across all job postings',
        sql: `SELECT 
    hs.name as skill,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(COUNT(DISTINCT jd.id) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
GROUP BY hs.name
ORDER BY job_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Top Skills by Salary',
        description: 'Skills that command the highest average salaries',
        sql: `SELECT 
    hs.name as skill,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
WHERE jd.min_salary IS NOT NULL AND jd.max_salary IS NOT NULL
GROUP BY hs.name
HAVING job_count >= 5
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Skill Co-Occurrences',
        description: 'Top skill combinations that appear together',
        sql: `SELECT 
    hs1.name || ' + ' || hs2.name as skill_combination,
    COUNT(DISTINCT jd.id) as job_count
FROM job_details jd
JOIN job_details_hard_skills jhs1 ON jd.id = jhs1.job_details_id
JOIN hard_skills hs1 ON jhs1.hard_skills_id = hs1.id
JOIN job_details_hard_skills jhs2 ON jd.id = jhs2.job_details_id
JOIN hard_skills hs2 ON jhs2.hard_skills_id = hs2.id
WHERE hs1.id < hs2.id
GROUP BY hs1.name, hs2.name
ORDER BY job_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Emerging Skills',
        description: 'Skills with fastest growing demand (last 3 months vs previous 3)',
        sql: `SELECT 
    hs.name as skill,
    COUNT(DISTINCT CASE WHEN jd.posting_date >= date('now', '-90 days') THEN jd.id END) as recent_count,
    COUNT(DISTINCT CASE WHEN jd.posting_date >= date('now', '-180 days') AND jd.posting_date < date('now', '-90 days') THEN jd.id END) as previous_count
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
WHERE jd.posting_date >= date('now', '-180 days')
GROUP BY hs.name
HAVING recent_count > previous_count AND recent_count >= 10
ORDER BY (recent_count - previous_count) DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'High-Value Skill Combinations',
        description: 'Skill pairs that lead to highest salaries',
        sql: `SELECT 
    hs1.name || ' + ' || hs2.name as skill_combo,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN job_details_hard_skills jhs1 ON jd.id = jhs1.job_details_id
JOIN hard_skills hs1 ON jhs1.hard_skills_id = hs1.id
JOIN job_details_hard_skills jhs2 ON jd.id = jhs2.job_details_id
JOIN hard_skills hs2 ON jhs2.hard_skills_id = hs2.id
WHERE hs1.id < hs2.id AND jd.max_salary IS NOT NULL
GROUP BY hs1.name, hs2.name
HAVING job_count >= 5
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Skills by Industry',
        description: 'Which industries value which skills most',
        sql: `SELECT 
    i.name || ' - ' || hs.name as industry_skill,
    COUNT(DISTINCT jd.id) as job_count
FROM job_details jd
JOIN industries i ON jd.industry_id = i.id
JOIN job_details_hard_skills jhs ON jd.id = jhs.job_details_id
JOIN hard_skills hs ON jhs.hard_skills_id = hs.id
WHERE i.name IN (SELECT i2.name FROM job_details jd2 JOIN industries i2 ON jd2.industry_id = i2.id GROUP BY i2.name ORDER BY COUNT(*) DESC LIMIT 5)
GROUP BY i.name, hs.name
ORDER BY job_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Top Soft Skills',
        description: 'Most requested soft skills in job postings',
        sql: `SELECT 
    ss.name as skill,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(COUNT(DISTINCT jd.id) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM soft_skills ss
JOIN job_details_soft_skills jss ON ss.id = jss.soft_skills_id
JOIN job_details jd ON jss.job_details_id = jd.id
GROUP BY ss.name
ORDER BY job_count DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Soft Skills by Salary Impact',
        description: 'Which soft skills correlate with higher salaries',
        sql: `SELECT 
    ss.name as soft_skill,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM soft_skills ss
JOIN job_details_soft_skills jss ON ss.id = jss.soft_skills_id
JOIN job_details jd ON jss.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
GROUP BY ss.name
HAVING job_count >= 10
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Rare High-Value Skills',
        description: 'Niche skills with high demand and high salaries',
        sql: `SELECT 
    hs.name as skill,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
GROUP BY hs.name
HAVING job_count BETWEEN 5 AND 50 AND avg_max_salary > (SELECT AVG(max_salary) * 1.2 FROM job_details WHERE max_salary IS NOT NULL)
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'skills'
    },
    {
        name: 'Skills Gap Analysis',
        description: 'Skills in high demand but low supply (few candidates)',
        sql: `SELECT 
    hs.name as skill,
    COUNT(DISTINCT jd.id) as job_demand,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
  AND jd.posting_date >= date('now', '-90 days')
GROUP BY hs.name
HAVING job_demand >= 10
ORDER BY avg_max_salary DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'skills'
    },

    // === SALARY ANALYSIS (12 charts) ===
    {
        name: 'Salary Distribution',
        description: 'Salary ranges and quartiles across all jobs',
        sql: `SELECT 
    CASE 
        WHEN min_salary < 10000 THEN '< 10k'
        WHEN min_salary < 20000 THEN '10k-20k'
        WHEN min_salary < 30000 THEN '20k-30k'
        WHEN min_salary < 40000 THEN '30k-40k'
        WHEN min_salary < 50000 THEN '40k-50k'
        ELSE '50k+'
    END as salary_range,
    COUNT(*) as job_count
FROM job_details
WHERE min_salary IS NOT NULL
GROUP BY salary_range
ORDER BY 
    CASE salary_range
        WHEN '< 10k' THEN 1
        WHEN '10k-20k' THEN 2
        WHEN '20k-30k' THEN 3
        WHEN '30k-40k' THEN 4
        WHEN '40k-50k' THEN 5
        ELSE 6
    END`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary by Seniority Level',
        description: 'Average salary progression across seniority levels',
        sql: `SELECT 
    sl.name as seniority_level,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
WHERE jd.min_salary IS NOT NULL
GROUP BY sl.name
ORDER BY avg_max_salary DESC`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary vs Experience',
        description: 'How salary correlates with years of experience',
        sql: `SELECT 
    experience_years,
    COUNT(*) as job_count,
    ROUND(AVG(min_salary)) as avg_min_salary,
    ROUND(AVG(max_salary)) as avg_max_salary
FROM job_details
WHERE experience_years IS NOT NULL 
  AND min_salary IS NOT NULL 
  AND experience_years <= 15
GROUP BY experience_years
ORDER BY experience_years`,
        chartType: 'line',
        category: 'salary'
    },
    {
        name: 'Salary by Job Function',
        description: 'Average salaries across different job functions',
        sql: `SELECT 
    jf.name as job_function,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN job_functions jf ON jd.job_function_id = jf.id
WHERE jd.min_salary IS NOT NULL
GROUP BY jf.name
HAVING job_count >= 5
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Top Paying Industries',
        description: 'Industries offering the highest average salaries',
        sql: `SELECT 
    i.name as industry,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN industries i ON jd.industry_id = i.id
WHERE jd.max_salary IS NOT NULL
GROUP BY i.name
HAVING job_count >= 10
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Top Paying Companies',
        description: 'Companies offering the highest average salaries',
        sql: `SELECT 
    c.name as company,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN companies c ON jd.company_name_id = c.id
WHERE jd.max_salary IS NOT NULL
GROUP BY c.name
HAVING job_count >= 5
ORDER BY avg_max_salary DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary by City',
        description: 'Geographic salary differences across major cities',
        sql: `SELECT 
    c.name as city,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN cities c ON jd.city_id = c.id
WHERE jd.max_salary IS NOT NULL
GROUP BY c.name
HAVING job_count >= 10
ORDER BY avg_max_salary DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary by Remote Work Option',
        description: 'How remote work options affect salary ranges',
        sql: `SELECT 
    rw.name as remote_option,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN remote_work_options rw ON jd.remote_work_id = rw.id
WHERE jd.max_salary IS NOT NULL
GROUP BY rw.name
ORDER BY avg_max_salary DESC`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary by Company Size',
        description: 'How company size impacts compensation',
        sql: `SELECT 
    cs.name as company_size,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN company_sizes cs ON jd.company_size_id = cs.id
WHERE jd.max_salary IS NOT NULL
GROUP BY cs.name
ORDER BY avg_max_salary DESC`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary by Education Level',
        description: 'ROI of different education levels',
        sql: `SELECT 
    el.name as education_level,
    COUNT(*) as job_count,
    ROUND(AVG(jd.min_salary)) as avg_min_salary,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN education_levels el ON jd.education_level_id = el.id
WHERE jd.max_salary IS NOT NULL
GROUP BY el.name
ORDER BY avg_max_salary DESC`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary Growth by Region',
        description: 'Which regions have fastest growing salaries',
        sql: `SELECT 
    r.name as region,
    ROUND(AVG(CASE WHEN jd.posting_date >= date('now', '-90 days') THEN jd.max_salary END)) as recent_avg_salary,
    ROUND(AVG(CASE WHEN jd.posting_date >= date('now', '-180 days') AND jd.posting_date < date('now', '-90 days') THEN jd.max_salary END)) as previous_avg_salary,
    COUNT(*) as job_count
FROM job_details jd
JOIN cities c ON jd.city_id = c.id
JOIN regions r ON c.region_id = r.id
WHERE jd.max_salary IS NOT NULL
  AND jd.posting_date >= date('now', '-180 days')
GROUP BY r.name
HAVING job_count >= 20
ORDER BY (recent_avg_salary - previous_avg_salary) DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'salary'
    },
    {
        name: 'Salary Percentiles',
        description: 'Distribution showing 25th, 50th, 75th, and 90th percentiles',
        sql: `SELECT 
    'Overall' as category,
    MIN(max_salary) as min_salary,
    MAX(max_salary) as max_salary,
    ROUND(AVG(max_salary)) as avg_salary
FROM job_details
WHERE max_salary IS NOT NULL`,
        chartType: 'boxplot',
        category: 'salary'
    },

    // === COMPANY & EMPLOYER INSIGHTS (6 charts) ===
    {
        name: 'Top Companies Hiring',
        description: 'Companies with the most active job postings',
        sql: `SELECT 
    c.name as company,
    COUNT(*) as job_count,
    COUNT(DISTINCT jd.title_id) as unique_titles
FROM job_details jd
JOIN companies c ON jd.company_name_id = c.id
GROUP BY c.name
ORDER BY job_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'companies'
    },
    {
        name: 'Companies Hiring for High-Salary Roles',
        description: 'Which companies offer the most high-paying positions',
        sql: `SELECT 
    c.name as company,
    COUNT(*) as high_salary_jobs
FROM job_details jd
JOIN companies c ON jd.company_name_id = c.id
WHERE jd.max_salary >= (SELECT CAST(AVG(max_salary) * 1.25 AS INTEGER) FROM job_details WHERE max_salary IS NOT NULL)
GROUP BY c.name
ORDER BY high_salary_jobs DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'companies'
    },
    {
        name: 'Company Size Distribution',
        description: 'Distribution of jobs by company size',
        sql: `SELECT 
    cs.name as company_size,
    COUNT(*) as job_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM job_details jd
JOIN company_sizes cs ON jd.company_size_id = cs.id
GROUP BY cs.name
ORDER BY job_count DESC`,
        chartType: 'doughnut',
        category: 'companies'
    },
    {
        name: 'Industries Hiring Most Actively',
        description: 'Which industries have the most job openings',
        sql: `SELECT 
    i.name as industry,
    COUNT(*) as job_count,
    COUNT(DISTINCT jd.company_name_id) as company_count
FROM job_details jd
JOIN industries i ON jd.industry_id = i.id
GROUP BY i.name
ORDER BY job_count DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'companies'
    },
    {
        name: 'Department Distribution',
        description: 'Job openings by department/function',
        sql: `SELECT 
    d.name as department,
    COUNT(*) as job_count
FROM job_details jd
JOIN departments d ON jd.department_id = d.id
GROUP BY d.name
ORDER BY job_count DESC
LIMIT 15`,
        chartType: 'doughnut',
        category: 'companies'
    },
    {
        name: 'Company Growth Indicators',
        description: 'Companies with accelerating hiring in last 30 days',
        sql: `SELECT 
    c.name as company,
    COUNT(CASE WHEN jd.posting_date >= date('now', '-30 days') THEN 1 END) as recent_jobs,
    COUNT(CASE WHEN jd.posting_date >= date('now', '-60 days') AND jd.posting_date < date('now', '-30 days') THEN 1 END) as previous_jobs
FROM job_details jd
JOIN companies c ON jd.company_name_id = c.id
WHERE jd.posting_date >= date('now', '-60 days')
GROUP BY c.name
HAVING recent_jobs > previous_jobs AND recent_jobs >= 5
ORDER BY (recent_jobs - previous_jobs) DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'companies'
    },

    // === WORK ARRANGEMENTS (5 charts) ===
    {
        name: 'Remote Work Options',
        description: 'Distribution of remote work opportunities',
        sql: `SELECT 
    rw.name as remote_option,
    COUNT(*) as job_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM job_details jd
LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
GROUP BY rw.name
ORDER BY job_count DESC`,
        chartType: 'doughnut',
        category: 'arrangements'
    },
    {
        name: 'Employment Type Distribution',
        description: 'Full-time vs part-time vs contract opportunities',
        sql: `SELECT 
    et.name as employment_type,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN employment_types et ON jd.employment_type_id = et.id
WHERE jd.max_salary IS NOT NULL
GROUP BY et.name
ORDER BY job_count DESC`,
        chartType: 'bar',
        category: 'arrangements'
    },
    {
        name: 'Work Schedule Options',
        description: 'Flexibility in work schedules offered',
        sql: `SELECT 
    ws.name as work_schedule,
    COUNT(*) as job_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM job_details jd
JOIN work_schedules ws ON jd.work_schedule_id = ws.id
GROUP BY ws.name
ORDER BY job_count DESC`,
        chartType: 'doughnut',
        category: 'arrangements'
    },
    {
        name: 'Contract Type Analysis',
        description: 'Permanent vs temporary vs contract roles',
        sql: `SELECT 
    ct.name as contract_type,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN contract_types ct ON jd.contract_type_id = ct.id
WHERE jd.max_salary IS NOT NULL
GROUP BY ct.name
ORDER BY job_count DESC`,
        chartType: 'bar',
        category: 'arrangements'
    },
    {
        name: 'Remote Work by Industry',
        description: 'Which industries offer most remote opportunities',
        sql: `SELECT 
    i.name as industry,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN rw.name LIKE '%Remote%' OR rw.name LIKE '%Hybrid%' THEN 1 END) as remote_jobs,
    ROUND(COUNT(CASE WHEN rw.name LIKE '%Remote%' OR rw.name LIKE '%Hybrid%' THEN 1 END) * 100.0 / COUNT(*), 2) as remote_percentage
FROM job_details jd
JOIN industries i ON jd.industry_id = i.id
LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
GROUP BY i.name
HAVING total_jobs >= 10
ORDER BY remote_percentage DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'arrangements'
    },

    // === REQUIREMENTS & QUALIFICATIONS (5 charts) ===
    {
        name: 'Experience Requirements',
        description: 'Distribution of required years of experience',
        sql: `SELECT 
    CASE 
        WHEN experience_years = 0 THEN 'Entry Level'
        WHEN experience_years BETWEEN 1 AND 2 THEN '1-2 years'
        WHEN experience_years BETWEEN 3 AND 5 THEN '3-5 years'
        WHEN experience_years BETWEEN 6 AND 10 THEN '6-10 years'
        ELSE '10+ years'
    END as experience_range,
    COUNT(*) as job_count
FROM job_details
WHERE experience_years IS NOT NULL
GROUP BY experience_range
ORDER BY 
    CASE experience_range
        WHEN 'Entry Level' THEN 1
        WHEN '1-2 years' THEN 2
        WHEN '3-5 years' THEN 3
        WHEN '6-10 years' THEN 4
        ELSE 5
    END`,
        chartType: 'bar',
        category: 'requirements'
    },
    {
        name: 'Education Requirements',
        description: 'Most common education level requirements',
        sql: `SELECT 
    el.name as education_level,
    COUNT(*) as job_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM job_details jd
JOIN education_levels el ON jd.education_level_id = el.id
GROUP BY el.name
ORDER BY job_count DESC`,
        chartType: 'doughnut',
        category: 'requirements'
    },
    {
        name: 'Top Certifications in Demand',
        description: 'Most valuable certifications requested',
        sql: `SELECT 
    cert.name as certification,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM certifications cert
JOIN job_details_certifications jc ON cert.id = jc.certifications_id
JOIN job_details jd ON jc.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
GROUP BY cert.name
ORDER BY job_count DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'requirements'
    },
    {
        name: 'High-Value Certifications',
        description: 'Certifications that lead to highest salaries',
        sql: `SELECT 
    cert.name as certification,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM certifications cert
JOIN job_details_certifications jc ON cert.id = jc.certifications_id
JOIN job_details jd ON jc.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
GROUP BY cert.name
HAVING job_count >= 5
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'requirements'
    },
    {
        name: 'Entry-Level Opportunities',
        description: 'Jobs requiring minimal experience with growth potential',
        sql: `SELECT 
    t.name as job_title,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN titles t ON jd.title_id = t.id
WHERE jd.experience_years <= 2
  AND jd.max_salary IS NOT NULL
GROUP BY t.name
HAVING job_count >= 5
ORDER BY avg_max_salary DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'requirements'
    },

    // === BENEFITS & PERKS (3 charts) ===
    {
        name: 'Top Benefits Offered',
        description: 'Most frequently offered employee benefits',
        sql: `SELECT 
    b.description as benefit,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(COUNT(DISTINCT jd.id) * 100.0 / (SELECT COUNT(*) FROM job_details), 2) as percentage
FROM benefits b
JOIN job_details_benefits jb ON b.id = jb.benefits_id
JOIN job_details jd ON jb.job_details_id = jd.id
GROUP BY b.description
ORDER BY job_count DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'benefits'
    },
    {
        name: 'Benefits by Salary Range',
        description: 'Which benefits are offered at different salary levels',
        sql: `SELECT 
    b.description as benefit,
    ROUND(AVG(jd.max_salary)) as avg_max_salary,
    COUNT(DISTINCT jd.id) as job_count
FROM benefits b
JOIN job_details_benefits jb ON b.id = jb.benefits_id
JOIN job_details jd ON jb.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
GROUP BY b.description
HAVING job_count >= 10
ORDER BY avg_max_salary DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'benefits'
    },
    {
        name: 'Benefits Package Completeness',
        description: 'Companies offering comprehensive benefits packages',
        sql: `SELECT 
    c.name as company,
    COUNT(DISTINCT b.id) as benefits_count,
    COUNT(DISTINCT jd.id) as job_count
FROM companies c
JOIN job_details jd ON c.id = jd.company_name_id
JOIN job_details_benefits jb ON jd.id = jb.job_details_id
JOIN benefits b ON jb.benefits_id = b.id
GROUP BY c.name
HAVING job_count >= 5
ORDER BY benefits_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'benefits'
    },

    // === CAREER OPTIMIZATION (7 charts) ===
    {
        name: 'Best ROI Career Paths',
        description: 'Job functions with best salary growth per year of experience',
        sql: `SELECT 
    jf.name as job_function,
    ROUND(AVG(jd.max_salary) / AVG(jd.experience_years)) as salary_per_year_experience,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN job_functions jf ON jd.job_function_id = jf.id
WHERE jd.max_salary IS NOT NULL 
  AND jd.experience_years > 0
GROUP BY jf.name
HAVING job_count >= 10
ORDER BY salary_per_year_experience DESC
LIMIT 15`,
        chartType: 'bar',
        category: 'career'
    },
    {
        name: 'Undervalued Skills',
        description: 'Skills in high demand but average salaries (good entry point)',
        sql: `SELECT 
    hs.name as skill,
    COUNT(DISTINCT jd.id) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM hard_skills hs
JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
JOIN job_details jd ON jhs.job_details_id = jd.id
WHERE jd.max_salary IS NOT NULL
GROUP BY hs.name
HAVING job_count >= 20 AND avg_max_salary < (SELECT AVG(max_salary) FROM job_details WHERE max_salary IS NOT NULL)
ORDER BY job_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'career'
    },
    {
        name: 'Career Transition Opportunities',
        description: 'Related job functions to pivot into',
        sql: `SELECT 
    jf1.name || ' → ' || jf2.name as transition,
    COUNT(DISTINCT hs.id) as shared_skills
FROM job_details jd1
JOIN job_functions jf1 ON jd1.job_function_id = jf1.id
JOIN job_details_hard_skills jhs1 ON jd1.id = jhs1.job_details_id
JOIN hard_skills hs ON jhs1.hard_skills_id = hs.id
JOIN job_details_hard_skills jhs2 ON hs.id = jhs2.hard_skills_id
JOIN job_details jd2 ON jhs2.job_details_id = jd2.id
JOIN job_functions jf2 ON jd2.job_function_id = jf2.id
WHERE jf1.id < jf2.id
GROUP BY jf1.name, jf2.name
ORDER BY shared_skills DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'career'
    },
    {
        name: 'Fastest Growing Job Titles',
        description: 'Job titles with increasing demand',
        sql: `SELECT 
    t.name as job_title,
    COUNT(CASE WHEN jd.posting_date >= date('now', '-90 days') THEN 1 END) as recent_count,
    COUNT(CASE WHEN jd.posting_date >= date('now', '-180 days') AND jd.posting_date < date('now', '-90 days') THEN 1 END) as previous_count
FROM job_details jd
JOIN titles t ON jd.title_id = t.id
WHERE jd.posting_date >= date('now', '-180 days')
GROUP BY t.name
HAVING recent_count > previous_count AND recent_count >= 10
ORDER BY (recent_count - previous_count) DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'career'
    },
    {
        name: 'Jobs with Most Skill Requirements',
        description: 'Roles that require diverse skill sets (challenging but rewarding)',
        sql: `SELECT 
    t.name as job_title,
    COUNT(DISTINCT hs.id) as skill_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary,
    COUNT(DISTINCT jd.id) as job_count
FROM job_details jd
JOIN titles t ON jd.title_id = t.id
JOIN job_details_hard_skills jhs ON jd.id = jhs.job_details_id
JOIN hard_skills hs ON jhs.hard_skills_id = hs.id
WHERE jd.max_salary IS NOT NULL
GROUP BY t.name
HAVING job_count >= 5
ORDER BY skill_count DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'career'
    },
    {
        name: 'Low Competition High Salary Roles',
        description: 'Jobs with fewer postings but high salaries',
        sql: `SELECT 
    t.name as job_title,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary
FROM job_details jd
JOIN titles t ON jd.title_id = t.id
WHERE jd.max_salary IS NOT NULL
GROUP BY t.name
HAVING job_count BETWEEN 5 AND 30 AND avg_max_salary > (SELECT AVG(max_salary) * 1.2 FROM job_details WHERE max_salary IS NOT NULL)
ORDER BY avg_max_salary DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'career'
    },
    {
        name: 'Geographic Salary Arbitrage',
        description: 'Cities offering highest salary-to-cost ratio (requires cost of living data)',
        sql: `SELECT 
    c.name as city,
    COUNT(*) as job_count,
    ROUND(AVG(jd.max_salary)) as avg_max_salary,
    COUNT(CASE WHEN rw.name LIKE '%Remote%' THEN 1 END) as remote_jobs
FROM job_details jd
JOIN cities c ON jd.city_id = c.id
LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
WHERE jd.max_salary IS NOT NULL
GROUP BY c.name
HAVING job_count >= 20
ORDER BY avg_max_salary DESC
LIMIT 20`,
        chartType: 'bar',
        category: 'career'
    }
];

// AI Prompt Template for Query Writing
const AI_PROMPT_TEMPLATE = `I need help writing an SQL query for job market analysis.

DATABASE STRUCTURE:
- Main table: job_details (id, posting_date, job_title, company_name, min_salary, max_salary, experience_years, etc.)
- Lookup tables: titles, companies, cities, regions, countries, job_functions, seniority_levels, industries, departments, employment_types, contract_types, work_schedules, remote_work_options, company_sizes, education_levels
- Many-to-many: hard_skills, soft_skills, benefits, certifications (via junction tables like job_details_hard_skills)

QUERY REQUIREMENTS:
[Describe what you want to analyze]

EXAMPLE PATTERNS:
1. Top items with counts:
   SELECT hs.name, COUNT(DISTINCT jd.id) as count
   FROM hard_skills hs
   JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
   JOIN job_details jd ON jhs.job_details_id = jd.id
   GROUP BY hs.name ORDER BY count DESC LIMIT 20

2. Salary statistics:
   SELECT sl.name, AVG(jd.min_salary) as avg_min, AVG(jd.max_salary) as avg_max
   FROM job_details jd
   JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
   WHERE jd.min_salary IS NOT NULL
   GROUP BY sl.name

3. Time series:
   SELECT DATE(posting_date) as date, COUNT(*) as count
   FROM job_details
   WHERE posting_date >= date('now', '-90 days')
   GROUP BY DATE(posting_date)

4. Multi-column analysis (for comparing metrics):
   SELECT i.name as industry, 
          AVG(jd.min_salary) as avg_min_salary,
          AVG(jd.max_salary) as avg_max_salary,
          COUNT(*) as job_count
   FROM job_details jd
   JOIN industries i ON jd.industry_id = i.id
   WHERE jd.min_salary IS NOT NULL
   GROUP BY i.name

VISUALIZATION SETUP:
- Chart Types: bar, line, doughnut, pie, scatter, bubble, radar, polarArea, boxplot
- Box Plot: Use 'boxplot' for pure statistical visualization showing quartiles, median, outliers
  * Ideal for salary distributions, experience requirements, etc.
  * Query should return numeric columns to visualize

COLUMN SELECTION:
- After running query, you can select which columns to plot
- Label Column: Used for X-axis (auto-detects first string column)
- Value Column(s): Used for Y-axis (auto-detects numeric columns)
- Multiple value columns create multi-series charts
- Box plots automatically use all numeric columns for statistical comparison

- Data Adapter (optional JS function to transform results):
  return data.map(row => ({ label: row.name, value: row.count }));

- Custom Chart Config (optional JSON for full Chart.js control):
  {
    "type": "bar",
    "data": {
      "labels": ["labels from query"],
      "datasets": [{
        "label": "Dataset Label",
        "data": [values],
        "backgroundColor": "rgba(99, 102, 241, 0.7)"
      }]
    },
    "options": {
      "scales": {
        "y": { "beginAtZero": true }
      }
    }
  }

Please provide:
1. SQL query (use descriptive column names)
2. Recommended chart type
3. Optional: which columns to use for labels/values
4. Optional data adapter function
5. Optional custom chart config`;

// Analysis Page - Custom Query Builder
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
        
        // Main Layout: Sidebar + Content
        m('div', { class: 'flex flex-col lg:flex-row gap-6' }, [
            // Left Sidebar - Predefined & Saved Analyses
            m('div', { class: 'lg:w-80 flex-shrink-0 flex flex-col' }, [
                // Predefined Analyses (Expanded, Scrollable)
                m('div', { class: 'card bg-base-100 shadow-xl flex-1 flex flex-col' }, [
                    m('div', { class: 'card-body p-4 flex flex-col flex-1 min-h-0' }, [
                        m('h2', { class: 'card-title text-lg mb-2' }, 'Predefined Analyses'),
                        m('div', { class: 'overflow-y-auto flex-1' }, [
                            m('div', { class: 'space-y-1' },
                                PredefinedAnalyses.map(analysis => 
                                    m('div', { 
                                        class: 'p-2 hover:bg-base-200 rounded cursor-pointer',
                                        onclick: () => {
                                            CustomAnalysisState.currentQuery = { ...analysis };
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
                                        class: 'p-2 hover:bg-base-200 rounded'
                                    }, [
                                        m('div', { class: 'font-medium text-sm' }, query.name),
                                        m('div', { class: 'text-xs opacity-70 mt-1' }, query.description),
                                        m('div', { class: 'flex gap-1 mt-2' }, [
                                            m('button', {
                                                class: 'btn btn-xs btn-ghost',
                                                onclick: () => {
                                                    CustomAnalysisState.currentQuery = { ...query };
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
            
            // Main Content Area
            m('div', { class: 'flex-1' }, [
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

// Remove old analysis detail page since we're not using JSON anymore
const AnalysisDetailPage = {
    view: () => m('div', { class: 'container mx-auto px-4 py-8' }, [
        m('div', { class: 'alert alert-info' }, [
            m('svg', { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', class: 'stroke-current shrink-0 w-6 h-6' }, [
                m('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' })
            ]),
            m('div', [
                m('div', { class: 'font-bold' }, 'Analysis system updated'),
                m('div', { class: 'text-sm' }, 'Please use the custom analysis builder on the main Analysis page.')
            ])
        ]),
        m('a', {
            href: '#!/analysis',
            oncreate: m.route.link,
            class: 'btn btn-primary mt-4'
        }, 'Go to Analysis Builder')
    ])
};

// Layout Component
const Layout = {
    view: (vnode) => m('div', { class: 'min-h-screen flex flex-col' }, [
        m(Header),
        m('main', { class: 'flex-1' }, vnode.children),
        m(Footer)
    ])
};

// Router Configuration
m.route(document.getElementById('app'), '/', {
    '/': {
        render: () => m(Layout, m(HomePage))
    },
    '/jobs': {
        render: () => m(Layout, m(JobsPage))
    },
    '/jobs/:id': {
        render: (vnode) => m(Layout, m(JobDetailPage, { id: vnode.attrs.id }))
    },
    '/analysis': {
        render: () => m(Layout, m(AnalysisPage))
    },
    '/analysis/:id': {
        render: (vnode) => m(Layout, m(AnalysisDetailPage, { id: vnode.attrs.id }))
    }
});
