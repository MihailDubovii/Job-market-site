// Example configuration for using a custom database server
// This file shows the production configuration for database.catalinplesu.xyz

const API_CONFIG = {
    // Using custom database server (production)
    type: "custom-server",
    
    // Custom server configuration for database.catalinplesu.xyz
    customServer: {
        url: "https://database.catalinplesu.xyz",  // Your database server URL
        path: "/db"  // API endpoint path (default: /db)
    }
};

// This function is already in config.js - shown here for reference
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

