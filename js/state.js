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

