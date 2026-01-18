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
JOIN education_levels el ON jd.required_education_id = el.id
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
JOIN regions r ON jd.region_id = r.id
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
JOIN education_levels el ON jd.required_education_id = el.id
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

