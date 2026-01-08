// Predefined Filtered Analyses - General Purpose, User-Friendly Queries
// These analyses work with the OR filter logic of the Filtered Analysis Page
// Designed to help average users explore and narrow down their job interests

const FilteredAnalyses = [
    {
        name: 'Salary Insights by Experience',
        description: 'See how salary varies by experience level to guide career expectations',
        baseSql: `
            SELECT 
                CASE 
                    WHEN jd.experience_years = 0 THEN 'Entry Level (0 years)'
                    WHEN jd.experience_years BETWEEN 1 AND 2 THEN 'Junior (1-2 years)'
                    WHEN jd.experience_years BETWEEN 3 AND 5 THEN 'Mid-Level (3-5 years)'
                    WHEN jd.experience_years BETWEEN 6 AND 10 THEN 'Senior (6-10 years)'
                    ELSE 'Expert (10+ years)'
                END as experience_level,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.min_salary)) as avg_min_salary,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
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
            WHERE jd.experience_years IS NOT NULL AND jd.max_salary IS NOT NULL
            GROUP BY experience_level
            ORDER BY 
                CASE experience_level
                    WHEN 'Entry Level (0 years)' THEN 1
                    WHEN 'Junior (1-2 years)' THEN 2
                    WHEN 'Mid-Level (3-5 years)' THEN 3
                    WHEN 'Senior (6-10 years)' THEN 4
                    ELSE 5
                END`,
        chartType: 'bar'
    },
    {
        name: 'Work Flexibility Options',
        description: 'Compare remote, hybrid, and office work opportunities',
        baseSql: `
            SELECT 
                COALESCE(rw.name, 'Not Specified') as work_arrangement,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
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
            GROUP BY work_arrangement
            ORDER BY job_count DESC`,
        chartType: 'pie'
    },
    {
        name: 'Job Opportunities by Location',
        description: 'Explore which cities have the most opportunities',
        baseSql: `
            SELECT 
                ci.name as city,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
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
            WHERE ci.name IS NOT NULL
            GROUP BY ci.name
            HAVING COUNT(DISTINCT jd.id) >= 10
            ORDER BY job_count DESC
            LIMIT 15`,
        chartType: 'bar'
    },
    {
        name: 'Industries Hiring Most',
        description: 'Discover which industries are actively hiring',
        baseSql: `
            SELECT 
                COALESCE(ind.name, 'Various Industries') as industry,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN industries ind ON jd.industry_id = ind.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
            LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
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
            GROUP BY industry
            HAVING COUNT(DISTINCT jd.id) >= 10
            ORDER BY job_count DESC
            LIMIT 15`,
        chartType: 'bar'
    },
    {
        name: 'Career Entry Points',
        description: 'Find opportunities for those starting their career',
        baseSql: `
            SELECT 
                t.name as job_title,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
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
            WHERE (jd.experience_years <= 1 OR jd.experience_years IS NULL)
              AND t.name IS NOT NULL
            GROUP BY t.name
            HAVING COUNT(DISTINCT jd.id) >= 3
            ORDER BY job_count DESC
            LIMIT 20`,
        chartType: 'bar'
    },
    {
        name: 'Employment Type Comparison',
        description: 'See breakdown of full-time, part-time, and contract positions',
        baseSql: `
            SELECT 
                COALESCE(et.name, 'Not Specified') as employment_type,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN employment_types et ON jd.employment_type_id = et.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
            LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
            LEFT JOIN industries ind ON jd.industry_id = ind.id
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
            WHERE jd.max_salary IS NOT NULL
            GROUP BY employment_type
            ORDER BY job_count DESC`,
        chartType: 'pie'
    },
    {
        name: 'Top Hiring Companies',
        description: 'See which companies are actively recruiting',
        baseSql: `
            SELECT 
                c.name as company,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN companies c ON jd.company_name_id = c.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
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
            WHERE c.name IS NOT NULL
            GROUP BY c.name
            HAVING COUNT(DISTINCT jd.id) >= 5
            ORDER BY job_count DESC
            LIMIT 20`,
        chartType: 'bar'
    },
    {
        name: 'Salary Range Distribution',
        description: 'Understand the market salary ranges',
        baseSql: `
            SELECT 
                CASE 
                    WHEN jd.max_salary < 15000 THEN 'Under 15k MDL'
                    WHEN jd.max_salary < 25000 THEN '15k-25k MDL'
                    WHEN jd.max_salary < 35000 THEN '25k-35k MDL'
                    WHEN jd.max_salary < 50000 THEN '35k-50k MDL'
                    ELSE '50k+ MDL'
                END as salary_range,
                COUNT(DISTINCT jd.id) as job_count
            FROM job_details jd
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
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
            WHERE jd.max_salary IS NOT NULL
            GROUP BY salary_range
            ORDER BY 
                CASE salary_range
                    WHEN 'Under 15k MDL' THEN 1
                    WHEN '15k-25k MDL' THEN 2
                    WHEN '25k-35k MDL' THEN 3
                    WHEN '35k-50k MDL' THEN 4
                    ELSE 5
                END`,
        chartType: 'bar'
    },
    {
        name: 'Most In-Demand Skills',
        description: 'See which skills employers are looking for',
        baseSql: `
            SELECT 
                hs.name as skill,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM hard_skills hs
            JOIN job_details_hard_skills jhs ON hs.id = jhs.hard_skills_id
            JOIN job_details jd ON jhs.job_details_id = jd.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
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
            WHERE jd.max_salary IS NOT NULL
            GROUP BY hs.name
            ORDER BY job_count DESC
            LIMIT 20`,
        chartType: 'bar'
    },
    {
        name: 'Company Size Preferences',
        description: 'Compare opportunities at small, medium, and large companies',
        baseSql: `
            SELECT 
                COALESCE(cs.name, 'Not Specified') as company_size,
                COUNT(DISTINCT jd.id) as job_count,
                ROUND(AVG(jd.max_salary)) as avg_max_salary
            FROM job_details jd
            LEFT JOIN company_sizes cs ON jd.company_size_id = cs.id
            LEFT JOIN titles t ON jd.title_id = t.id
            LEFT JOIN job_functions jf ON jd.job_function_id = jf.id
            LEFT JOIN seniority_levels sl ON jd.seniority_level_id = sl.id
            LEFT JOIN cities ci ON jd.city_id = ci.id
            LEFT JOIN companies c ON jd.company_name_id = c.id
            LEFT JOIN remote_work_options rw ON jd.remote_work_id = rw.id
            LEFT JOIN industries ind ON jd.industry_id = ind.id
            LEFT JOIN employment_types et ON jd.employment_type_id = et.id
            LEFT JOIN contract_types ct ON jd.contract_type_id = ct.id
            LEFT JOIN departments d ON jd.department_id = d.id
            LEFT JOIN specializations sp ON jd.specialization_id = sp.id
            LEFT JOIN education_levels el ON jd.required_education_id = el.id
            LEFT JOIN job_families jf2 ON jd.job_family_id = jf2.id
            LEFT JOIN work_schedules ws ON jd.work_schedule_id = ws.id
            LEFT JOIN shift_details sd ON jd.shift_details_id = sd.id
            LEFT JOIN travel_requirements tr ON jd.travel_required_id = tr.id
            LEFT JOIN regions reg ON jd.region_id = reg.id
            LEFT JOIN countries cou ON jd.country_id = cou.id
            WHERE jd.max_salary IS NOT NULL
            GROUP BY company_size
            ORDER BY job_count DESC`,
        chartType: 'pie'
    }
];
