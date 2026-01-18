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

