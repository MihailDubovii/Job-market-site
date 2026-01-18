// Test: Filtered Analysis OR Logic

// This test demonstrates how the OR logic works in FilteredAnalysisState

// Example 1: Single field, single value
// Filter: city == "Chisinau"
// Expected SQL: WHERE ci.name = ?
// Parameters: ["Chisinau"]

// Example 2: Single field, multiple values  
// Filters: 
//   - city == "Chisinau"
//   - city == "Balti"
// Expected SQL: WHERE (ci.name = ? OR ci.name = ?)
// Parameters: ["Chisinau", "Balti"]

// Example 3: Multiple fields, single values each
// Filters:
//   - city == "Chisinau" 
//   - remote_work == "Fully Remote"
// Expected SQL: WHERE (ci.name = ?) OR (rw.name = ?)
// Parameters: ["Chisinau", "Fully Remote"]

// Example 4: Multiple fields, multiple values
// Filters:
//   - city == "Chisinau"
//   - city == "Balti"
//   - remote_work == "Fully Remote"
//   - seniority_level == "Senior"
// Expected SQL: WHERE (ci.name = ? OR ci.name = ?) OR (rw.name = ?) OR (sl.name = ?)
// Parameters: ["Chisinau", "Balti", "Fully Remote", "Senior"]

// Example 5: Many-to-many relationships (hard_skills)
// Filters:
//   - hard_skills == "Python"
//   - hard_skills == "JavaScript"
// Expected SQL: WHERE jd.id IN (
//   SELECT jm.job_details_id 
//   FROM job_details_hard_skills jm
//   JOIN hard_skills mt ON jm.hard_skills_id = mt.id
//   WHERE mt.name IN (?, ?)
// )
// Parameters: ["Python", "JavaScript"]

// Example 6: Mixed many-to-one and many-to-many
// Filters:
//   - city == "Chisinau"
//   - hard_skills == "Python"
// Expected SQL: WHERE (ci.name = ?) OR jd.id IN (
//   SELECT jm.job_details_id 
//   FROM job_details_hard_skills jm
//   JOIN hard_skills mt ON jm.hard_skills_id = mt.id
//   WHERE mt.name IN (?)
// )
// Parameters: ["Chisinau", "Python"]

// Test Cases for buildOrWhereClause()

const testCases = [
    {
        name: "Empty filters",
        filters: {},
        expected: {
            whereClause: "",
            params: []
        }
    },
    {
        name: "Single city filter",
        filters: {
            city: [{ value: "Chisinau", label: "City" }]
        },
        expectedPattern: /WHERE.*ci\.name = \?/,
        paramCount: 1
    },
    {
        name: "Multiple cities (same field)",
        filters: {
            city: [
                { value: "Chisinau", label: "City" },
                { value: "Balti", label: "City" }
            ]
        },
        expectedPattern: /WHERE.*ci\.name = \? OR ci\.name = \?/,
        paramCount: 2
    },
    {
        name: "Multiple fields (city and remote_work)",
        filters: {
            city: [{ value: "Chisinau", label: "City" }],
            remote_work: [{ value: "Fully Remote", label: "Remote Work" }]
        },
        expectedPattern: /WHERE.*OR/,
        paramCount: 2
    },
    {
        name: "Many-to-many relationship (hard_skills)",
        filters: {
            hard_skills: [
                { value: "Python", label: "Hard Skills" },
                { value: "JavaScript", label: "Hard Skills" }
            ]
        },
        expectedPattern: /WHERE jd\.id IN.*hard_skills/,
        paramCount: 2
    },
    {
        name: "Complex mix of filters",
        filters: {
            city: [
                { value: "Chisinau", label: "City" },
                { value: "Balti", label: "City" }
            ],
            remote_work: [{ value: "Fully Remote", label: "Remote Work" }],
            seniority_level: [
                { value: "Senior", label: "Seniority Level" },
                { value: "Mid-level", label: "Seniority Level" }
            ],
            hard_skills: [{ value: "Python", label: "Hard Skills" }]
        },
        expectedPattern: /WHERE.*OR.*OR/,
        paramCount: 6
    }
];

// Visual representation of namespace-style filter display
const namespaceExamples = [
    "city == \"Chisinau\"",
    "remote_work == \"Fully Remote\"",
    "seniority_level == \"Senior\"",
    "job_function == \"Software Development\"",
    "hard_skills == \"Python\"",
    "company_size == \"51-200\"",
    "employment_type == \"Full-time\"",
    "industry == \"Information Technology\"",
    "education_level == \"Bachelor's Degree\"",
    "company == \"Google\""
];

console.log("=== Filtered Analysis OR Logic Test ===\n");
console.log("Namespace-style filter examples:");
namespaceExamples.forEach(ex => console.log("  - " + ex));

console.log("\n=== OR Logic Behavior ===");
console.log("Jobs matching ANY of the selected filters will be included");
console.log("Example: city == \"Chisinau\" OR remote_work == \"Fully Remote\"");
console.log("Result: All jobs in Chisinau + All fully remote jobs (regardless of location)");

console.log("\n=== Implementation Notes ===");
console.log("1. Filters within same field use OR: city == 'A' OR city == 'B'");
console.log("2. Filters across fields use OR: city == 'A' OR seniority == 'B'");
console.log("3. Many-to-many uses IN subquery for efficiency");
console.log("4. All filter conditions are combined with OR at top level");

// Key differences from Jobs Page (AND logic)
console.log("\n=== Key Differences from Jobs Page ===");
console.log("Jobs Page (AND logic):");
console.log("  - city == 'Chisinau' AND remote_work == 'Fully Remote'");
console.log("  - Result: Only remote jobs IN Chisinau");
console.log("");
console.log("Filtered Analysis Page (OR logic):");
console.log("  - city == 'Chisinau' OR remote_work == 'Fully Remote'");
console.log("  - Result: All Chisinau jobs + All remote jobs");

// Export for documentation
if (typeof module !== 'undefined') {
    module.exports = { testCases, namespaceExamples };
}
