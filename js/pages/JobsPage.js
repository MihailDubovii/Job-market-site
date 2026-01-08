const JobsPage = {
    displayPage: 1, // Current display page for filtered results
    loadingMore: false,
    
    oninit: async () => {
        // Initialize URL state before loading data
        const urlState = URLState.initialize();
        
        // Apply URL state to our state objects
        if (urlState) {
            Object.assign(state.filters, urlState.filters);
            JobsPage.displayPage = urlState.page;
            state.itemsPerPage = urlState.itemsPerPage;
            state.sort = urlState.sort;
            state.search = urlState.search;
        }
        
        // Ensure database is loaded
        state.loading = true;
        try {
            await DatabaseManager.init();
            state.dbLoaded = true;
            
            // Load metadata if not already loaded
            if (!state.jobsIndex) {
                const metadata = await dbApi.getMetadata();
                state.jobsIndex = metadata;
            }
            
            // Load initial jobs
            await JobsPage.loadJobs();
            
            state.loading = false;
            m.redraw();
        } catch (err) {
            console.error('Error loading jobs:', err);
            state.dbError = err;
            state.loading = false;
            m.redraw();
        }
    },
    
    loadJobs: async () => {
        try {
            const result = await dbApi.getJobs(
                JobsPage.displayPage,
                state.itemsPerPage,
                state.filters,
                state.search,
                state.sort
            );
            
            state.jobs = result.jobs;
            state.totalJobs = result.total;
            state.totalPages = result.totalPages;
            
        } catch (err) {
            console.error('Error loading jobs:', err);
            state.jobs = [];
        }
    },
    
    navigateToPage: async (pageNumber) => {
        JobsPage.displayPage = pageNumber;
        window.scrollTo(0, 0);
        
        // Update URL with new page number
        URLState.update();
        
        // Load jobs for this page
        await JobsPage.loadJobs();
        m.redraw();
    },
    
    renderPagination: (totalPages) => {
        if (totalPages <= 1) return null;
        
        const currentPage = JobsPage.displayPage;
        const pageButtons = [];
        
        // First page button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === 1 ? 'btn-disabled' : ''}`,
                disabled: currentPage === 1,
                onclick: () => JobsPage.navigateToPage(1)
            }, '« First')
        );
        
        // Previous button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === 1 ? 'btn-disabled' : ''}`,
                disabled: currentPage === 1,
                onclick: () => JobsPage.navigateToPage(currentPage - 1)
            }, '‹ Prev')
        );
        
        // Page number buttons: show current, -3 to +3
        const startPage = Math.max(1, currentPage - 3);
        const endPage = Math.min(totalPages, currentPage + 3);
        
        if (startPage > 1) {
            pageButtons.push(m('div', { class: 'px-2 py-1 text-sm text-gray-500' }, '...'));
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pageButtons.push(
                m('button', {
                    class: `btn btn-sm ${i === currentPage ? 'btn-primary' : ''}`,
                    onclick: () => JobsPage.navigateToPage(i)
                }, i)
            );
        }
        
        if (endPage < totalPages) {
            pageButtons.push(m('div', { class: 'px-2 py-1 text-sm text-gray-500' }, '...'));
        }
        
        // Next button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : ''}`,
                disabled: currentPage === totalPages,
                onclick: () => JobsPage.navigateToPage(currentPage + 1)
            }, 'Next ›')
        );
        
        // Last page button
        pageButtons.push(
            m('button', {
                class: `btn btn-sm ${currentPage === totalPages ? 'btn-disabled' : ''}`,
                disabled: currentPage === totalPages,
                onclick: () => JobsPage.navigateToPage(totalPages)
            }, 'Last »')
        );
        
        return m('div', { class: 'flex justify-center gap-1 items-center flex-wrap' }, pageButtons);
    },
    
    view: () => {
        const jobs = state.jobs || [];
        const total = state.totalJobs || 0;
        const totalPages = state.totalPages || 0;
        
        return m('div', { class: 'flex min-h-0 flex-1' }, [
            // Left Sidebar - Filters
            state.jobsIndex && m('div', { class: 'w-80 border-r border-base-300 overflow-y-auto' }, [
                m(FilterPanel)
            ]),
            
            // Main Content Area
            m('div', { class: 'flex-1 overflow-y-auto min-h-0' }, [
                m('div', { class: 'container mx-auto px-4 py-8' }, [
                    state.loading ? m(Loading) : [
                        JobsPage.renderPagination(totalPages),
                        
                        m('div', { class: 'bg-base-100 rounded-lg shadow my-4' }, [
                            jobs.length > 0 ? 
                                jobs.map((job, idx) => m(JobListItem, { 
                                    job, 
                                    index: ((JobsPage.displayPage - 1) * state.itemsPerPage) + idx + 1 
                                })) :
                                m('div', { class: 'text-center py-8 opacity-70' }, 
                                    hasActiveFilters(state.filters) || state.search ? 'No jobs match your filters. Try adjusting your criteria.' : 'No jobs found'
                                )
                        ]),
                        
                        // Bottom pagination
                        JobsPage.renderPagination(totalPages),
                        
                        // Stats footer
                        m('div', { class: 'text-center text-sm opacity-70 mt-4' }, 
                            `Showing ${jobs.length > 0 ? ((JobsPage.displayPage - 1) * state.itemsPerPage) + 1 : 0} - ${((JobsPage.displayPage - 1) * state.itemsPerPage) + jobs.length} of ${total.toLocaleString()} jobs`
                        )
                    ]
                ])
            ])
        ]);
    }
};

