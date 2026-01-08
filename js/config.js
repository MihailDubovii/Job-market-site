// API Configuration
// Database is served from custom server at database.catalinplesu.xyz

const API_CONFIG = {
    // Using custom database server
    type: "custom-server",
    
    // Custom server configuration
    customServer: {
        url: "https://database.catalinplesu.xyz",  // Your database server URL
        path: "/db"  // Path to database endpoint
    }
};

function getApiBase() {
    // Always use custom server for production
    if (API_CONFIG.type === "custom-server") {
        return {
            type: 'custom-server',
            url: API_CONFIG.customServer.url,
            path: API_CONFIG.customServer.path
        };
    }
    
    // Default to /public for localhost development
    return '/public';
}

const API_BASE = getApiBase();

console.log('API_BASE configured as:', API_BASE);
if (typeof API_BASE === 'object') {
    if (API_BASE.type === 'custom-server') {
        console.log('Using custom server:', API_BASE.url);
    }
} else {
    console.log('Using local path:', API_BASE);
}

// Constants for multi-select fields (many-to-many relationships and one-to-many like languages)
const MULTI_SELECT_FIELDS = [
    'languages',  // One-to-many (job can require multiple languages)
    'hard_skills', 'soft_skills', 'certifications', 'licenses_required',
    'benefits', 'work_environment', 'professional_development', 
    'work_life_balance', 'physical_requirements', 'work_conditions', 
    'special_requirements'
];

// Configuration constants
const DEFAULT_JOBS_PER_API_PAGE = 100;
