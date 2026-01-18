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
