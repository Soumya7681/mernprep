export type Chapter = {
  num: string;
  file: string;   // filename within the folder, e.g. "01-closures.md"
  title: string;
};

export type Section = {
  title: string;
  folder: string; // "" for root-level files
  chapters: Chapter[];
};

export const MANIFEST: Section[] = [
  {
    title: "Getting Started",
    folder: "",
    chapters: [
      { num: "•", file: "README.md", title: "Home / Index" },
    ],
  },
  // ── Part 0 · What the MERN role asks for ──
  {
    title: "Role Requirements",
    folder: "00-requirements",
    chapters: [
      { num: "01", file: "01-mern-role-requirements.md", title: "MERN Role Requirements & Skill Matrix" },
      { num: "02", file: "02-interview-process.md",      title: "How MERN Interviews Run" },
      { num: "03", file: "03-study-plan.md",             title: "8-Week Study Plan" },
    ],
  },
  // ── Part 1 · Core + advanced, in the order it is usually learned ──
  {
    title: "JavaScript",
    folder: "01-javascript",
    chapters: [
      { num: "04", file: "01-closures.md",          title: "Closures" },
      { num: "05", file: "02-hoisting.md",          title: "Hoisting" },
      { num: "06", file: "03-scope.md",             title: "Scope" },
      { num: "07", file: "04-this-keyword.md",      title: "`this` Keyword" },
      { num: "08", file: "05-prototype.md",         title: "Prototype" },
      { num: "09", file: "06-equality.md",          title: "Equality" },
      { num: "10", file: "07-event-handling.md",    title: "Event Handling" },
      { num: "11", file: "08-array-methods.md",     title: "Array Methods" },
      { num: "12", file: "09-promises.md",          title: "Promises" },
      { num: "13", file: "11-event-loop.md",        title: "Event Loop & Task Queues" },
      { num: "14", file: "10-debounce-throttle.md", title: "Debounce / Throttle" },
    ],
  },
  {
    title: "JavaScript Advanced",
    folder: "20-javascript-advanced",
    chapters: [
      { num: "15", file: "01-execution-context-memory.md", title: "Execution Context, Memory & GC" },
      { num: "16", file: "02-iterators-generators.md",     title: "Iterators & Generators" },
      { num: "17", file: "03-proxy-reflect-symbols.md",    title: "Proxy, Reflect & Symbols" },
      { num: "18", file: "04-modules-esm-cjs.md",          title: "Modules: ESM vs CommonJS" },
      { num: "19", file: "05-functional-patterns.md",      title: "Functional Patterns & Immutability" },
      { num: "20", file: "06-classes-design-patterns.md",  title: "Classes & Design Patterns" },
      { num: "21", file: "07-async-advanced.md",           title: "Advanced Async Patterns" },
      { num: "22", file: "08-browser-apis-performance.md", title: "Browser APIs & Web Performance" },
    ],
  },
  {
    title: "React",
    folder: "02-react",
    chapters: [
      { num: "23", file: "01-functional-components.md",      title: "Functional Components" },
      { num: "24", file: "02-props-vs-state.md",             title: "Props vs State" },
      { num: "25", file: "03-useeffect.md",                  title: "useEffect" },
      { num: "26", file: "04-usememo-usecallback.md",        title: "useMemo / useCallback" },
      { num: "27", file: "05-useref.md",                     title: "useRef" },
      { num: "28", file: "06-controlled-uncontrolled.md",    title: "Controlled / Uncontrolled" },
      { num: "29", file: "07-context-api.md",                title: "Context API" },
      { num: "30", file: "08-custom-hooks.md",               title: "Custom Hooks" },
      { num: "31", file: "09-virtual-dom-reconciliation.md", title: "Virtual DOM & Reconciliation" },
      { num: "32", file: "10-performance-optimization.md",   title: "Performance Optimization" },
    ],
  },
  {
    title: "React Advanced",
    folder: "21-react-advanced",
    chapters: [
      { num: "33", file: "01-react-19-features.md",             title: "React 19: Actions, use & Server Components" },
      { num: "34", file: "02-concurrent-rendering-suspense.md", title: "Concurrent Rendering & Suspense" },
      { num: "35", file: "03-advanced-patterns.md",             title: "Advanced Component Patterns" },
      { num: "36", file: "04-server-state-data-fetching.md",    title: "Server State & Data Fetching" },
      { num: "37", file: "05-forms-routing.md",                 title: "Forms & Routing" },
      { num: "38", file: "06-testing-react.md",                 title: "Testing React Apps" },
      { num: "39", file: "07-security-accessibility.md",        title: "Frontend Security & Accessibility" },
    ],
  },
  {
    title: "Redux",
    folder: "16-redux",
    chapters: [
      { num: "40", file: "01-redux-core-concepts.md",             title: "Redux Core Concepts" },
      { num: "41", file: "02-redux-toolkit-typescript.md",        title: "Redux Toolkit with TypeScript" },
      { num: "42", file: "03-async-thunks.md",                    title: "Async Logic with Thunks" },
      { num: "43", file: "04-rtk-query.md",                       title: "RTK Query" },
      { num: "44", file: "05-selectors-normalization.md",         title: "Selectors & Normalised State" },
      { num: "45", file: "06-middleware-testing-alternatives.md", title: "Middleware, Testing & Alternatives" },
    ],
  },
  {
    title: "Node.js",
    folder: "03-nodejs",
    chapters: [
      { num: "46", file: "01-event-loop.md",          title: "Event Loop" },
      { num: "47", file: "02-async-await.md",         title: "async/await" },
      { num: "48", file: "03-middleware.md",          title: "Middleware" },
      { num: "49", file: "04-jwt-auth.md",            title: "JWT Authentication" },
      { num: "50", file: "05-rest-best-practices.md", title: "REST Best Practices" },
      { num: "51", file: "06-mvc-architecture.md",    title: "MVC Architecture" },
      { num: "52", file: "07-error-handling.md",      title: "Error Handling" },
      { num: "53", file: "08-file-upload-s3.md",      title: "File Upload (S3)" },
      { num: "54", file: "09-pagination.md",          title: "Pagination" },
      { num: "55", file: "10-rate-limiting.md",       title: "Rate Limiting" },
    ],
  },
  {
    title: "Node.js Advanced",
    folder: "22-node-advanced",
    chapters: [
      { num: "56", file: "01-streams-buffers.md",                title: "Streams, Buffers & Backpressure" },
      { num: "57", file: "02-scaling-cluster-workers.md",        title: "Cluster, Worker Threads & Scaling" },
      { num: "58", file: "03-websockets-realtime.md",            title: "WebSockets & Real-Time" },
      { num: "59", file: "04-redis-caching-queues.md",           title: "Redis Caching & Job Queues" },
      { num: "60", file: "05-security-owasp.md",                 title: "Node Security (OWASP)" },
      { num: "61", file: "06-logging-observability-shutdown.md", title: "Logging, Observability & Graceful Shutdown" },
      { num: "62", file: "07-performance-memory-leaks.md",       title: "Performance & Memory Leaks" },
      { num: "63", file: "08-testing-node-apis.md",              title: "Testing Node APIs" },
    ],
  },
  {
    title: "Express / NestJS",
    folder: "04-express-nestjs",
    chapters: [
      { num: "64", file: "01-express-vs-nestjs.md",              title: "Express vs NestJS" },
      { num: "65", file: "02-dependency-injection.md",           title: "Dependency Injection" },
      { num: "66", file: "03-dtos-validation.md",                title: "DTOs & Validation" },
      { num: "67", file: "04-guards-middleware-interceptors.md", title: "Guards / Interceptors" },
      { num: "68", file: "05-swagger.md",                        title: "Swagger / OpenAPI" },
    ],
  },
  {
    title: "MongoDB",
    folder: "05-mongodb",
    chapters: [
      { num: "69", file: "05-sql-vs-nosql.md",                title: "SQL vs NoSQL" },
      { num: "70", file: "06-crud-query-operators.md",        title: "CRUD & Query Operators" },
      { num: "71", file: "07-data-modeling-patterns.md",      title: "Data Modelling & Schema Patterns" },
      { num: "72", file: "01-mongoose-schemas.md",            title: "Mongoose Schemas" },
      { num: "73", file: "02-indexing.md",                    title: "Indexing" },
      { num: "74", file: "03-aggregation.md",                 title: "Aggregation Pipeline" },
      { num: "75", file: "04-populate-vs-lookup.md",          title: "populate vs $lookup" },
      { num: "76", file: "08-transactions-consistency.md",    title: "Transactions & Consistency" },
      { num: "77", file: "10-performance-tuning.md",          title: "Performance Tuning" },
      { num: "78", file: "09-replication-sharding.md",        title: "Replication & Sharding" },
      { num: "79", file: "11-advanced-features.md",           title: "Advanced Features" },
      { num: "80", file: "12-query-practice.md",              title: "Query Practice Problems" },
      { num: "81", file: "13-mongodb-interview-questions.md", title: "MongoDB Rapid-Fire Q&A" },
    ],
  },
  // ── Part 2 · Putting the stack together with TypeScript ──
  {
    title: "MERN Stack + TypeScript",
    folder: "15-mern-typescript",
    chapters: [
      { num: "82", file: "01-typescript-essentials.md",         title: "TypeScript Essentials" },
      { num: "83", file: "02-project-setup-architecture.md",    title: "Project Setup & Architecture" },
      { num: "84", file: "03-typed-express-server.md",          title: "Typed Express Server" },
      { num: "85", file: "04-mongoose-typescript.md",           title: "Mongoose with TypeScript" },
      { num: "86", file: "05-authentication-end-to-end.md",     title: "Authentication End-to-End" },
      { num: "87", file: "06-react-with-typescript.md",         title: "React with TypeScript" },
      { num: "88", file: "07-fullstack-feature-walkthrough.md", title: "Full-Stack Feature Walkthrough" },
      { num: "89", file: "08-testing-mern-typescript.md",       title: "Testing MERN + TypeScript" },
      { num: "90", file: "09-production-deployment.md",         title: "Production & Deployment" },
      { num: "91", file: "10-mern-interview-questions.md",      title: "MERN + TS Rapid-Fire Q&A" },
    ],
  },
  // ── Part 3 · Interview rounds ──
  {
    title: "Coding Questions",
    folder: "23-coding-questions",
    chapters: [
      { num: "92", file: "01-js-output-questions.md",    title: "JS Predict-the-Output" },
      { num: "93", file: "02-js-polyfills.md",           title: "JS Polyfills & Implementations" },
      { num: "94", file: "03-js-problem-solving.md",     title: "JS Problem Solving" },
      { num: "95", file: "04-react-coding-questions.md", title: "React Coding Questions" },
      { num: "96", file: "05-node-express-coding.md",    title: "Node & Express Coding Questions" },
    ],
  },
  {
    title: "Scenario-Based Questions",
    folder: "24-scenario-questions",
    chapters: [
      { num: "97", file: "01-javascript-scenarios.md",          title: "JavaScript Scenarios" },
      { num: "98", file: "02-react-scenarios.md",               title: "React Scenarios" },
      { num: "99", file: "03-node-express-scenarios.md",        title: "Node & Express Scenarios" },
      { num: "100", file: "04-mongodb-scenarios.md",             title: "MongoDB Scenarios" },
      { num: "101", file: "05-production-incident-scenarios.md", title: "Production Incident Scenarios" },
      { num: "102", file: "06-mern-system-design-scenarios.md",  title: "MERN System Design Scenarios" },
    ],
  },
  {
    title: "MERN Interview",
    folder: "18-mern-interview",
    chapters: [
      { num: "103", file: "01-project-experience.md",              title: "MERN Self-Intro & Project Questions" },
      { num: "104", file: "02-javascript-typescript-questions.md", title: "JavaScript & TypeScript Questions" },
      { num: "105", file: "03-react-redux-questions.md",           title: "React & Redux Questions" },
      { num: "106", file: "04-node-express-questions.md",          title: "Node.js & Express Questions" },
      { num: "107", file: "05-mongodb-questions.md",               title: "MongoDB & Mongoose Questions" },
      { num: "108", file: "06-scenario-debugging-questions.md",    title: "Scenario & Debugging Questions" },
      { num: "109", file: "07-live-coding-tasks.md",               title: "Live Coding Tasks" },
      { num: "110", file: "08-git-agile-deployment-questions.md",  title: "Git, Agile, Testing & Deployment" },
    ],
  },
  {
    title: "Machine Coding",
    folder: "06-machine-coding",
    chapters: [
      { num: "111", file: "01-frontend-tasks.md", title: "Frontend Tasks" },
      { num: "112", file: "02-backend-tasks.md",  title: "Backend Tasks" },
    ],
  },
  {
    title: "System Design",
    folder: "07-system-design",
    chapters: [
      { num: "113", file: "01-authentication.md",            title: "Authentication" },
      { num: "114", file: "02-scalable-apis.md",             title: "Scalable APIs" },
      { num: "115", file: "03-caching.md",                   title: "Caching" },
      { num: "116", file: "04-monolith-vs-microservices.md", title: "Monolith vs Microservices" },
      { num: "117", file: "05-api-security.md",              title: "API Security" },
    ],
  },
  {
    title: "DSA & Coding",
    folder: "",
    chapters: [
      { num: "118", file: "11-dsa-coding-questions.md", title: "Coding Question Tracker" },
    ],
  },
  {
    title: "HR & Behavioral",
    folder: "08-hr-behavioral",
    chapters: [
      { num: "119", file: "01-self-introduction.md", title: "Self-Introduction" },
      { num: "120", file: "02-common-questions.md",  title: "Common Questions" },
    ],
  },
  // ── Part 4 · Revision ──
  {
    title: "Reference",
    folder: "",
    chapters: [
      { num: "121", file: "09-revision-sheet.md", title: "Night-Before Revision" },
      { num: "122", file: "10-appendix.md",       title: "Documents & Q&A" },
    ],
  },
];

// The DSA chapter is rendered as an interactive checklist instead of static
// markdown, so a few modules need to recognise it by path.
export const DSA_PATH = "11-dsa-coding-questions.md";

export type FlatChapter = Chapter & {
  section: string;
  folder: string;
  path: string;     // "01-javascript/01-closures.md" or "README.md"
  slug: string[];   // ["01-javascript", "01-closures"] or ["readme"]
};

export const FLAT: FlatChapter[] = MANIFEST.flatMap((section) =>
  section.chapters.map((ch) => {
    const path = section.folder ? `${section.folder}/${ch.file}` : ch.file;
    const base = ch.file.replace(/\.md$/, "").toLowerCase();
    const slug = section.folder
      ? [section.folder, base]
      : [base];
    return { ...ch, section: section.title, folder: section.folder, path, slug };
  }),
);

export function findBySlug(slug: string[]): FlatChapter | undefined {
  const key = slug.join("/").toLowerCase();
  return FLAT.find((f) => f.slug.join("/") === key);
}
