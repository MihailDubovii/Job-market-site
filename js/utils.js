// Utility Functions

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

