# JavaScript Module Structure

This document describes the modular structure of the refactored frontend application.

## Overview

The original monolithic `app.js` file (4650 lines) has been refactored into 20 focused, maintainable modules organized in a clear directory structure.

## Directory Structure

```
js/
├── config.js                          # Configuration constants
├── database.js                        # DatabaseManager for SQL.js
├── api.js                             # URL state management & API client
├── dbApi.js                           # SQL-based data access functions
├── state.js                           # Global application state
├── utils.js                           # Utility functions
├── components/                        # Reusable UI components
│   ├── Header.js                      # Navigation header
│   ├── Footer.js                      # Page footer
│   ├── Loading.js                     # Loading spinner component
│   ├── JobListItem.js                 # Job list item display
│   └── FilterPanel.js                 # Advanced job filtering UI
├── pages/                             # Full page components
│   ├── HomePage.js                    # Landing page
│   ├── JobsPage.js                    # Job listings with filters
│   ├── JobDetailPage.js               # Individual job details
│   └── AnalysisDetailPage.js          # Analysis detail view
├── analysis/                          # Analysis and charting features
│   ├── ChartHelpers.js                # Chart utility functions
│   ├── CustomAnalysisState.js         # Analysis state management
│   ├── PredefinedAnalyses.js          # Pre-built analysis queries
│   └── AnalysisPage.js                # Custom SQL analysis builder
└── main.js                            # Application initialization & routing
```

## Module Descriptions

### Core Modules

**config.js** (549 bytes)
- API base URL configuration
- Multi-select field constants
- Default pagination settings

**database.js** (3.0 KB)
- DatabaseManager singleton
- SQL.js initialization and database loading
- Query execution methods

**api.js** (3.4 KB)
- URLState management (parsing and updating URL parameters)
- Basic API client for JSON endpoints

**dbApi.js** (35 KB)
- SQL query builder for filtering and sorting
- Job data retrieval and formatting
- Metadata and filter count queries

**state.js** (1.5 KB)
- Global application state
- Filter state management
- Sort and pagination options

**utils.js** (5.5 KB)
- Filter matching utilities
- Data formatting functions (salary, date)
- Sorting functions
- Helper functions for field value extraction

### Components

**Header.js** (2.5 KB)
- Navigation bar with routing links
- Theme toggle (dark/light mode)

**Footer.js** (236 bytes)
- Simple page footer with copyright

**Loading.js** (175 bytes)
- Loading spinner component

**JobListItem.js** (1.2 KB)
- Compact job list item display (Hacker News style)
- Shows job title, company, location, salary, date

**FilterPanel.js** (44 KB)
- Complex multi-filter UI component
- Dynamic filter rendering based on metadata
- Real-time filter count updates
- Multi-select support for skills, benefits, etc.

### Pages

**HomePage.js** (3.0 KB)
- Landing page with database initialization
- Total jobs count display
- Navigation to jobs page

**JobsPage.js** (6.5 KB)
- Main job listings page
- Filter panel integration
- Pagination and sorting controls
- Search functionality

**JobDetailPage.js** (14 KB)
- Individual job detail view
- Tabbed interface (Parsed/Raw views)
- Skill requirements display
- Benefits and compensation details

**AnalysisDetailPage.js** (894 bytes)
- Simple redirect page for old analysis routes
- Guides users to new analysis builder

### Analysis

**ChartHelpers.js** (1.2 KB)
- Chart color generation utilities
- Common chart configuration helpers

**CustomAnalysisState.js** (5.5 KB)
- Analysis state management
- Query execution logic
- LocalStorage for saving queries

**PredefinedAnalyses.js** (32 KB)
- 40+ pre-built analysis queries
- Categorized analyses (skills, salary, companies, etc.)
- SQL query templates with chart configurations

**AnalysisPage.js** (33 KB)
- Custom SQL query builder UI
- Live chart rendering with Chart.js
- Multiple chart type support
- Database structure documentation
- Query saving and loading

### Application Initialization

**main.js** (692 bytes)
- Layout component definition
- Mithril.js router configuration
- Route definitions for all pages

## Loading Order

The modules are loaded in a specific order in `index.html` to ensure dependencies are available:

1. **Core configuration & utilities** - config, database, api, dbApi, state, utils
2. **Components** - Header, Footer, Loading, JobListItem, FilterPanel
3. **Pages** - HomePage, JobsPage, JobDetailPage, AnalysisDetailPage
4. **Analysis** - ChartHelpers, CustomAnalysisState, PredefinedAnalyses, AnalysisPage
5. **App initialization** - main

## Benefits of Modular Structure

1. **Maintainability**: Each module has a clear, focused responsibility
2. **Readability**: Smaller files are easier to understand and navigate
3. **Testability**: Individual modules can be tested in isolation
4. **Reusability**: Components can be easily reused across the application
5. **Scalability**: New features can be added as new modules without affecting existing code
6. **Collaboration**: Multiple developers can work on different modules simultaneously

## Development Notes

- All modules use global variable declarations (const) as they're loaded via script tags
- No module bundler is required - files are loaded directly in the browser
- Dependencies between modules are managed through loading order in index.html
- Original `app.js` is preserved as backup (but not loaded)

## Future Improvements

Potential enhancements for the module structure:

1. Convert to ES6 modules with import/export
2. Add a module bundler (Webpack, Rollup, or Vite)
3. Implement TypeScript for type safety
4. Add unit tests for individual modules
5. Create a development build process with hot reloading
