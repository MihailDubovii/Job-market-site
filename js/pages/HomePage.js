// Default number of analyses to show if PredefinedAnalyses is not available
const DEFAULT_ANALYSIS_COUNT = 55;

const HomePage = {
    oninit: async () => {
        try {
            state.dbLoading = true;
            await DatabaseManager.init();
            state.dbLoaded = true;
            
            const metadata = await dbApi.getMetadata();
            state.jobsIndex = metadata;
            
            // Get count of predefined analyses (fallback to default if not available)
            state.analysisCount = PredefinedAnalyses?.length ?? DEFAULT_ANALYSIS_COUNT;
            
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
                        m('span', 'Failed to load database. Please make sure data.db is available in /api/')
                    ])
                ])
            ])
        ]) : [
            // First Hero - Jobs
            m('div', { class: 'hero min-h-[50vh] bg-base-200 rounded-lg mb-8' }, [
                m('div', { class: 'hero-content text-center' }, [
                    m('div', { class: 'max-w-md' }, [
                        m('h1', { class: 'text-5xl font-bold' }, 'Aggregated Job Listings'),
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
            ]),
            // Second Hero - Analysis
            m('div', { class: 'hero min-h-[40vh] bg-base-300 rounded-lg' }, [
                m('div', { class: 'hero-content text-center' }, [
                    m('div', { class: 'max-w-2xl' }, [
                        m('h2', { class: 'text-4xl font-bold mb-4' }, 'Market Trends Analysis'),
                        m('p', { class: 'py-4' }, 'Explore pre-made analyses to understand the job market trends, salary ranges, in-demand skills, and more.'),
                        m('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4 my-6' }, [
                            m('div', { class: 'stat bg-base-100 rounded-lg shadow' }, [
                                m('div', { class: 'stat-title' }, 'Premade Analyses'),
                                m('div', { class: 'stat-value text-secondary' }, `${state.analysisCount}+`),
                                m('div', { class: 'stat-desc' }, 'Ready-to-explore insights')
                            ]),
                            m('div', { class: 'stat bg-base-100 rounded-lg shadow' }, [
                                m('div', { class: 'stat-title' }, 'Custom Queries'),
                                m('div', { class: 'stat-value text-accent' }, 'AI'),
                                m('div', { class: 'stat-desc' }, 'Build your own analysis')
                            ])
                        ]),
                        m('div', { class: 'flex flex-col sm:flex-row gap-4 justify-center items-center' }, [
                            m('a', { 
                                class: 'btn btn-secondary btn-lg',
                                href: '#!/analysis',
                                oncreate: m.route.link
                            }, [
                                'View Analyses',
                                m('svg', { 
                                    xmlns: 'http://www.w3.org/2000/svg', 
                                    class: 'h-6 w-6 ml-2', 
                                    fill: 'none', 
                                    viewBox: '0 0 24 24', 
                                    stroke: 'currentColor' 
                                }, [
                                    m('path', { 
                                        'stroke-linecap': 'round', 
                                        'stroke-linejoin': 'round', 
                                        'stroke-width': '2', 
                                        d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' 
                                    })
                                ])
                            ]),
                            m('div', { class: 'text-sm opacity-70 max-w-xs' }, [
                                'Copy prompts to use with your own AI chat app (ChatGPT, Claude, etc.) for custom analysis'
                            ])
                        ])
                    ])
                ])
            ])
        ]
    ])
};
