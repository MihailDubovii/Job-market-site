# Moldova Job Market - Frontend SPA

A single-page application (SPA) built with Mithril.js and DaisyUI for browsing jobs and viewing market analytics.

## Architecture

The frontend is now organized as a modular application with 20 focused JavaScript modules. See [js/README.md](js/README.md) for detailed documentation of the module structure.

## Technology Stack

- **Mithril.js** - Lightweight SPA framework (via CDN)
- **DaisyUI + Tailwind CSS** - UI components and styling (via CDN)
- **Chart.js** - Data visualizations (via CDN)
- **SQL.js** - Client-side SQLite via WebAssembly (via CDN)

## Features

### Core Functionality
- ✅ Extra slim job listings (Hacker News style)
- ✅ Client-side filtering on multiple fields
- ✅ Job detail view with parsed/raw tabs
- ✅ Analysis dashboard
- ✅ Responsive mobile design
- ✅ Dark/light theme toggle
- ✅ Fast client-side routing

### Job Browsing
- Paginated job listings (100 jobs per page)
- Filters: Job Function, Seniority, City, Remote Work, Industry, Company
- Extra slim design for quick browsing
- Click any job to view full details

### Job Details
- **Parsed Tab**: Structured, clean view of job information
  - Salary, requirements, responsibilities
  - Skills and language requirements
  - Benefits and perks
- **Raw Tab**: Original scraped data
  - Original job title and company name
  - **Complete original job description text** (from `job_description` field in database)
  - Source information and link to original posting
  - **Note**: The raw description is pulled from the `job_description` column in the `job_details` table. If jobs show empty descriptions, ensure this field is populated during LLM processing.

### Analysis Dashboard
- **Custom Analysis Builder**: SQL.js + Chart.js for custom queries
  - 15+ predefined analyses (skills, salary, trends, distributions)
  - Custom SQL query builder with live visualization
  - Multiple chart types (bar, line, doughnut, pie)
  - Save queries to browser localStorage
  - Database structure documentation and query help
  - No backend required - all analysis runs client-side
- See [CUSTOM_ANALYSIS_GUIDE.md](../CUSTOM_ANALYSIS_GUIDE.md) for detailed documentation

## Usage

### Development
Simply open `index.html` in a web browser or use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

### Production
The frontend is a static site that can be deployed to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

Just copy the `frontend/` directory contents to your web server.

**Note:** The API base path is automatically detected based on the deployment environment:
- **Localhost**: Uses `/api` (e.g., `http://localhost:8000/api/data.db`)
- **GitHub Pages**: Uses `/repo-name/api` (e.g., `https://username.github.io/Job-Market-Frontend/api/data.db`)

The detection is handled automatically in `js/config.js` - no configuration needed!

## API Structure

The SPA now uses SQLite databases loaded client-side for instant filtering and querying:

```
/api/
├── data.db                  - SQLite database with job data (user must copy this)
```

**Note:** The analysis folder with JSON files is no longer needed. All analysis is now done client-side using the Custom Analysis Builder.

### Database Setup

**Important:** You must copy the `data.db` database file to `frontend/api/` before deployment:

```bash
# Copy database to frontend
cp databases/data.db frontend/api/
```

The database is loaded once when the application initializes and all job queries and analysis are performed client-side using SQL.js (WebAssembly SQLite).

## Customization

### Theming
DaisyUI themes can be changed by modifying the `data-theme` attribute:
- `light` (default)
- `dark`
- `cupcake`, `bumblebee`, `emerald`, and many more

### Styling
Custom styles are in `index.html`:
- `.job-item` - Job list item styling
- `.job-title` - Job title styling
- `.job-meta` - Job metadata styling

### Features
To add more filters, edit the `FilterPanel` component in `app.js`

## Performance

- **Initial database load**: Depends on database size (~1-5 seconds for 5-10MB)
- **Filtering updates**: Instant (<50ms) - client-side SQL queries
- **Sorting/pagination**: Instant - SQL ORDER BY and LIMIT
- All assets loaded via CDN
- Minimal dependencies
- Client-side routing (no page reloads)
- Database cached in memory after first load

**Database Caching:**
The SQLite database is loaded once on application startup and cached in browser memory. All subsequent queries execute instantly against the cached database. For large databases (>10MB), consider:
- Using browser cache headers to cache the database file
- Implementing service workers for offline support
- Splitting into multiple smaller databases if needed

## Browser Support

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Project Structure

```
frontend/
├── index.html          - Main HTML file with CDN links
├── app.js              - Mithril.js application code
└── README.md           - This file
```

## Recent Improvements

### 🚀 URL Parameters for Filters and Sorting

The frontend now supports comprehensive URL parameter management for enhanced user experience:

**Key Features:**
- ✅ **URL State Management**: Complete synchronization between application state and URL parameters
- ✅ **Filter Persistence**: All 50+ filters are preserved in URL for shareable searches
- ✅ **Sorting Integration**: 8 different sort options with URL parameter support
- ✅ **Global Search**: Real-time search with URL parameter integration
- ✅ **Pagination**: Page numbers and items per page preserved in URL
- ✅ **Bookmarkable States**: Save complex filter combinations as browser bookmarks
- ✅ **Shareable URLs**: Share exact search criteria with colleagues and candidates

**Supported URL Parameters:**
- `?page=N` - Current page number
- `?limit=N` - Items per page (10, 20, 50, 100)
- `?sort=VALUE` - Sorting option (8 types available)
- `?q=TERM` - Global search term
- `?FIELD=VALUE` - Any filter field (e.g., `?city=Chisinau`, `?salaryMin=15000`)

**Example URLs:**
```
# Filtered jobs with sorting
/jobs?page=2&limit=20&sort=salary_desc&city=Chisinau&salaryMin=15000

# Search with pagination
/jobs?page=1&q=developer&employment_type=Full-time

# Complex filtering
/jobs?industry=IT&seniority_level=Senior&remote_work=Yes&page=3
```

**Enhanced UI Elements:**
- Sort controls with 8 different sorting options
- Prominent search box with real-time filtering
- Clear filters button for easy reset
- Improved pagination with URL synchronization

**Benefits:**
- Users can share links that preserve their exact search criteria
- Browser back/forward buttons work correctly
- Page refreshes preserve filter state
- No lost search context
- Professional, modern web application experience

## Success Criteria

- [x] Extra slim job listings (Hacker News style)
- [x] DaisyUI themes work correctly (light/dark toggle)
- [x] Initial page load <2 seconds
- [x] Filtering updates <100ms (client-side)
- [x] Mobile responsive
- [x] Client-side filtering functional on multiple fields
- [x] Hierarchical filtering (dynamic filter options)
- [x] Parsed/raw tabs functional
- [x] Works in modern browsers
- [x] Advanced filters (collapsible/expandable)
- [x] URL parameter support for filters and sorting
- [x] Global search with URL integration
- [x] All 30+ database fields filterable (19 single-select + 11 multi-select)
- [x] Multi-select support for many-to-many relationships
- [x] Charts render correctly (custom analysis builder implemented)
- [x] Custom SQL query builder with Chart.js visualization
- [x] Predefined analysis queries for common insights
- [x] Local storage for saved custom queries

## Recent Filter Enhancements (2026-01)

### Comprehensive Filtering System

The frontend now supports **34 filterable fields** covering almost all data in the job_details table:

**Single-Select Filters (19 fields)**:
- Job Classification: title, job_function, seniority_level, industry, department, job_family, specialization
- Work Arrangement: employment_type, contract_type, work_schedule, shift_details, remote_work, travel_required
- Location: city, region, country
- Company: company, company_size
- Requirements: education_level

**Multi-Select Filters (11 fields)**:
- Technical: hard_skills, soft_skills, certifications, licenses_required
- Benefits: benefits, work_environment, professional_development, work_life_balance
- Conditions: physical_requirements, work_conditions, special_requirements

**Range Filters (4 fields)**:
- Salary range (min/max) and Experience (min/max)

### Key Features

- **Multi-Select with AND Logic**: When multiple items are selected in multi-select fields, jobs must have ALL selected items
- **Dynamic Filter Counts**: Filter options show job counts that update based on current selections
- **URL Persistence**: All filter selections are saved in URL for sharing and bookmarking
- **Real-Time Updates**: Instant filtering on client-side with SQL.js
- **Smart UI**: Multi-select fields show selection count badges

### Documentation

- **[FILTER_USAGE_GUIDE.md](../FILTER_USAGE_GUIDE.md)** - User guide with examples
- **[FILTER_ENHANCEMENT_SUMMARY.md](../FILTER_ENHANCEMENT_SUMMARY.md)** - Technical implementation details

## Future Enhancements

1. **OR Logic Toggle**: Allow users to choose AND/OR for multi-select filters
2. **Hierarchical Filtering**: Dynamic filtering where selecting industry filters departments
3. **Advanced Search**: Full-text search across job descriptions
4. **Saved Filters**: Save and restore filter preferences
5. **Job Alerts**: Email notifications for matching jobs
6. **Export**: Download filtered results as CSV
7. **Comparison**: Compare multiple jobs side-by-side

## Contributing

This is part of the Moldova Job Market project. See the main README for contribution guidelines.
