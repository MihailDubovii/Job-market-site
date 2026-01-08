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
