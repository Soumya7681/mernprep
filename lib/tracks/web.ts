import type { RoadmapTrack } from "@/lib/roadmaps";

/**
 * Web tracks: frontend, backend and full-stack — the three roles a MERN
 * developer is hired into.
 *
 * Type-only import of RoadmapTrack, so there is no runtime cycle with
 * lib/roadmaps.ts even though that module imports this array.
 *
 * Node ids are the localStorage progress key and must stay unique across every
 * track in the catalogue — hence the per-track prefix on each one.
 */
export const WEB_TRACKS: RoadmapTrack[] = [
  {
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    shortTitle: "Frontend",
    category: "Web & Mobile",
    mark: "FE",
    tagline:
      "Build the part of the product people actually touch: accessible, fast, and correct on every device you cannot test on.",
    market:
      "The largest single hiring pool in web development. Every product company, agency, and enterprise IT department hires for it, and the ceiling is high once you own performance and accessibility rather than just components.",
    timeline: "5-8 months part-time",
    entryBar: "HTML, CSS and JavaScript at working level. No degree expected.",
    updated: "2026-08-31",
    prerequisites: [
      "HTML and CSS you can write without copying",
      "JavaScript fundamentals: closures, promises, array methods",
      "Git and a deployed personal site",
    ],
    stages: [
      {
        id: "fe-s1",
        title: "The language under the framework",
        duration: "4-6 weeks",
        goal: "Interviewers probe JavaScript, not React. Fix the foundation before the framework.",
        build:
          "A vanilla JS single-page app with client-side routing and no build step. No framework allowed.",
        nodes: [
          {
            id: "fe-js-core",
            label: "JavaScript deep dive",
            summary:
              "The questions that decide frontend interviews are almost always plain JavaScript, asked about framework code.",
            topics: [
              "Closures, scope chains and the module pattern",
              "Prototypes, `this` binding, call/apply/bind",
              "Event loop: microtasks vs macrotasks",
              "Immutability, structural sharing, and why it matters to React",
            ],
            ref: { href: "/01-javascript/01-closures", label: "Ch 1 — Closures" },
          },
          {
            id: "fe-dom",
            label: "DOM and events",
            summary:
              "Frameworks are a layer over the DOM. Knowing the layer underneath is what separates senior from mid.",
            topics: [
              "Event delegation, bubbling and capture",
              "Reflow vs repaint, and what triggers layout",
              "MutationObserver, IntersectionObserver, ResizeObserver",
              "Shadow DOM and custom elements",
            ],
          },
          {
            id: "fe-css-arch",
            label: "Modern CSS and layout",
            summary:
              "Flexbox and grid are table stakes. Container queries and cascade layers are the current interview edge.",
            topics: [
              "Grid and flexbox: when each is the right answer",
              "Container queries and `:has()`",
              "Cascade layers, custom properties, specificity",
              "Logical properties and writing-mode-safe layout",
            ],
          },
          {
            id: "fe-typescript",
            label: "TypeScript for UI code",
            summary:
              "Almost every frontend job posting now assumes TypeScript. Generics over component props are the usual test.",
            topics: [
              "Structural typing, unions, narrowing",
              "Generics in component props and hooks",
              "Discriminated unions for UI state",
              "`unknown` vs `any`, and typing third-party data",
            ],
          },
          {
            id: "fe-http",
            label: "The browser as a client",
            summary:
              "How a request actually reaches your component, and everything that can go wrong on the way.",
            topics: [
              "HTTP caching headers and the browser cache",
              "CORS, preflight, and credentialed requests",
              "Cookies: SameSite, Secure, HttpOnly",
              "AbortController and request cancellation",
            ],
          },
        ],
      },
      {
        id: "fe-s2",
        title: "React in depth",
        duration: "5-7 weeks",
        goal: "Move past 'I can build a to-do app' to reasoning about renders, state ownership and data flow.",
        build:
          "A dashboard with server data, optimistic updates, and a table that stays smooth at 10,000 rows.",
        nodes: [
          {
            id: "fe-react-model",
            label: "The rendering model",
            summary:
              "Why a component re-rendered is the single most common React interview question.",
            topics: [
              "Reconciliation, keys, and list identity",
              "When memo, useMemo and useCallback actually help",
              "Referential identity and the dependency array",
              "Batching and transitions",
            ],
            ref: { href: "/02-react/01-functional-components", label: "Ch — Functional Components" },
          },
          {
            id: "fe-state",
            label: "State architecture",
            summary:
              "Most React bugs are state in the wrong place. Interviewers ask you to move it.",
            topics: [
              "Local vs lifted vs global state",
              "Server state vs client state",
              "Reducers and state machines for complex flows",
              "Context: what it costs and when to avoid it",
            ],
          },
          {
            id: "fe-data",
            label: "Data fetching patterns",
            summary:
              "Caching, revalidation and race conditions — the parts a useEffect fetch gets wrong.",
            topics: [
              "TanStack Query: cache keys, staleness, invalidation",
              "Optimistic updates and rollback",
              "Race conditions and stale responses",
              "Suspense and streaming",
            ],
          },
          {
            id: "fe-forms",
            label: "Forms and validation",
            kind: "recommended",
            summary:
              "Every real product is mostly forms. Controlled vs uncontrolled is a standing interview question.",
            topics: [
              "Controlled vs uncontrolled inputs",
              "Schema validation with Zod",
              "Server-side validation and error mapping",
              "Accessible error messaging",
            ],
          },
          {
            id: "fe-ssr",
            label: "SSR, SSG and the server boundary",
            summary:
              "Next.js and friends moved the interview from 'client only' to 'where does this code run'.",
            topics: [
              "Server vs client components",
              "Hydration and hydration mismatches",
              "Static, incremental and dynamic rendering",
              "Data loading on the server, and what leaks to the client",
            ],
          },
        ],
      },
      {
        id: "fe-s3",
        title: "Performance and accessibility",
        duration: "4-5 weeks",
        goal: "The two areas that separate a frontend engineer from someone who can use a framework.",
        build:
          "Take a slow page to green Core Web Vitals and a clean axe audit. Publish the before and after numbers.",
        nodes: [
          {
            id: "fe-vitals",
            label: "Core Web Vitals",
            summary:
              "LCP, INP and CLS are the vocabulary hiring managers use. Know what moves each one.",
            topics: [
              "LCP: the critical request chain",
              "INP: long tasks and input delay",
              "CLS: reserved space and font swapping",
              "Field data vs lab data",
            ],
          },
          {
            id: "fe-bundle",
            label: "Bundles and loading",
            summary:
              "Shipping less JavaScript is the highest-leverage performance work in most codebases.",
            topics: [
              "Code splitting and route-level chunks",
              "Tree shaking and side-effect flags",
              "Preload, prefetch, and priority hints",
              "Image formats, sizing and lazy loading",
            ],
          },
          {
            id: "fe-render-perf",
            label: "Runtime performance",
            summary:
              "Profiling a janky list under time pressure is a common live exercise.",
            topics: [
              "Chrome performance profiler and flame charts",
              "Virtualised lists and windowing",
              "Debounce, throttle, and scheduling work",
              "Web workers for expensive computation",
            ],
          },
          {
            id: "fe-a11y",
            label: "Accessibility",
            summary:
              "Increasingly a hard requirement rather than a nice-to-have, especially in public sector and enterprise.",
            topics: [
              "Semantic HTML and the accessibility tree",
              "Keyboard navigation and focus management",
              "ARIA: roles, states, and when not to use it",
              "WCAG 2.2 AA and colour contrast",
            ],
          },
          {
            id: "fe-i18n",
            label: "Internationalisation",
            kind: "optional",
            summary:
              "Matters at any company with users outside one country. Often a differentiator, rarely a blocker.",
            topics: [
              "Message catalogues and pluralisation",
              "Intl APIs for dates, numbers and currency",
              "RTL layout with logical properties",
              "Locale-aware routing",
            ],
          },
        ],
      },
      {
        id: "fe-s4",
        title: "Testing and tooling",
        duration: "3-4 weeks",
        goal: "Prove your code works without clicking through it, and keep the build honest.",
        build:
          "Add a test suite to an existing project: unit, component and one end-to-end happy path, running in CI.",
        nodes: [
          {
            id: "fe-testing",
            label: "Testing the UI",
            summary:
              "Testing Library's 'test what the user sees' philosophy is the expected answer in interviews.",
            topics: [
              "Testing Library queries and user-event",
              "Mocking the network with MSW",
              "What to unit test vs what to end-to-end test",
              "Snapshot tests and why they rot",
            ],
          },
          {
            id: "fe-e2e",
            label: "End-to-end testing",
            summary:
              "Playwright has become the default answer. Flakiness management is the real skill.",
            topics: [
              "Playwright selectors and auto-waiting",
              "Test isolation and fixtures",
              "Visual regression testing",
              "Running against preview deployments",
            ],
          },
          {
            id: "fe-build",
            label: "Build tooling",
            summary:
              "You will be asked why the build is slow and what you would do about it.",
            topics: [
              "Vite, esbuild and the dev/prod split",
              "Source maps and debugging production",
              "Monorepos: workspaces and task caching",
              "Dependency hygiene and bundle analysis",
            ],
          },
          {
            id: "fe-ci",
            label: "CI and preview deploys",
            summary:
              "Shipping safely is part of the job description at every level above junior.",
            topics: [
              "GitHub Actions for lint, test and build",
              "Preview environments per pull request",
              "Bundle size budgets in CI",
              "Feature flags and safe rollout",
            ],
          },
          {
            id: "fe-errors",
            label: "Monitoring in production",
            kind: "recommended",
            summary:
              "'How would you find out this broke for users?' is a standard senior question.",
            topics: [
              "Error boundaries and error reporting",
              "Source-mapped stack traces",
              "Real user monitoring",
              "Session replay and privacy trade-offs",
            ],
          },
        ],
      },
      {
        id: "fe-s5",
        title: "Interview and portfolio",
        duration: "3-4 weeks",
        goal: "Frontend interviews have their own shape: a machine-coding round and a UI system design round.",
        build:
          "Two polished projects with a written README covering the architecture decisions and the trade-offs you rejected.",
        nodes: [
          {
            id: "fe-machine-coding",
            label: "Machine coding rounds",
            summary:
              "Build a working component in 60-90 minutes. Practised candidates pass; unpractised ones run out of time.",
            topics: [
              "Autocomplete with debounce and cancellation",
              "Infinite scroll and virtualisation",
              "Modal, tabs and accordion with full keyboard support",
              "Star rating, carousel, drag-and-drop list",
            ],
          },
          {
            id: "fe-ui-design",
            label: "Frontend system design",
            summary:
              "Design a feed, a chat, or a design system. Component boundaries and data flow are what is scored.",
            topics: [
              "Component API design and composition",
              "Client caching and pagination strategy",
              "Real-time updates: polling, SSE, WebSocket",
              "Design tokens and theming",
            ],
          },
          {
            id: "fe-dsa",
            label: "DSA for frontend",
            summary:
              "Lighter than backend interviews, but arrays, strings, trees and recursion still appear.",
            topics: [
              "Arrays, strings, hash maps",
              "Tree traversal (the DOM is a tree)",
              "Recursion and memoisation",
              "Complexity analysis in plain language",
            ],
            ref: { href: "/11-dsa-coding-questions", label: "DSA Coding Questions" },
          },
          {
            id: "fe-portfolio",
            label: "Portfolio that survives review",
            summary:
              "Two deep projects beat ten tutorials. Reviewers open the repo before they open the site.",
            topics: [
              "README with architecture and trade-offs",
              "Live deployment with real data",
              "Lighthouse and axe scores in the README",
              "Commit history that shows iteration",
            ],
          },
          {
            id: "fe-behavioural",
            label: "Behavioural round",
            summary:
              "Frontend roles sit next to design and product. Collaboration stories carry real weight.",
            topics: [
              "Disagreeing with a design decision",
              "Shipping under a deadline with known debt",
              "Explaining a technical trade-off to a non-engineer",
              "A bug you caused and what you changed after",
            ],
          },
        ],
      },
    ],
    tools: [
      "TypeScript",
      "React",
      "Next.js",
      "Vite",
      "TanStack Query",
      "Playwright",
      "Testing Library",
      "Lighthouse",
      "axe",
    ],
    proofOfWork: [
      "A deployed app with green Core Web Vitals, numbers shown in the README",
      "A component library with keyboard and screen-reader support documented",
      "A before/after performance case study with real measurements",
      "A machine-coding repo: ten components built to interview time limits",
    ],
  },

  {
    slug: "backend-engineer",
    title: "Backend Engineer",
    shortTitle: "Backend",
    category: "Web & Mobile",
    mark: "BE",
    tagline:
      "Own the data, the contracts and the failure modes: APIs that stay correct under load and under partial failure.",
    market:
      "Consistently the deepest hiring pool alongside frontend, and the usual route into distributed systems and platform work. Node, Java, Python, Go and .NET all hire heavily.",
    timeline: "6-9 months part-time",
    entryBar: "One language at working level and comfort with SQL basics.",
    updated: "2026-08-31",
    prerequisites: [
      "One backend language: Node/TypeScript, Python, Java or Go",
      "SQL: joins, indexes, and reading a query plan",
      "Git, Linux command line, and HTTP fundamentals",
    ],
    stages: [
      {
        id: "be-s1",
        title: "APIs that hold up",
        duration: "4-6 weeks",
        goal: "Design and build an API a second team could consume without asking you questions.",
        build:
          "A REST API with authentication, pagination, validation, and an OpenAPI spec generated from the code.",
        nodes: [
          {
            id: "be-http",
            label: "HTTP and REST properly",
            summary:
              "Most candidates know the verbs. Fewer can explain idempotency or correct status codes under failure.",
            topics: [
              "Verbs, status codes, and idempotency",
              "Caching headers, ETags and conditional requests",
              "Content negotiation and versioning strategies",
              "Pagination: offset vs cursor",
            ],
            ref: { href: "/03-nodejs/01-event-loop", label: "Ch — Node.js Event Loop" },
          },
          {
            id: "be-validation",
            label: "Validation and contracts",
            summary:
              "The boundary between your service and the world is where most production bugs enter.",
            topics: [
              "Schema validation at the edge",
              "OpenAPI / JSON Schema as the contract",
              "Error shapes and problem+json",
              "Backwards-compatible API evolution",
            ],
          },
          {
            id: "be-auth",
            label: "Authentication and authorisation",
            summary:
              "Asked in almost every backend interview, and answered badly in most of them.",
            topics: [
              "Sessions vs JWT, and when each is wrong",
              "OAuth 2.1 and OIDC flows",
              "Refresh token rotation and revocation",
              "RBAC vs ABAC, and enforcing it in one place",
            ],
          },
          {
            id: "be-graphql",
            label: "GraphQL and gRPC",
            kind: "recommended",
            summary:
              "Knowing when not to use REST is a senior signal. Both appear in job specs regularly.",
            topics: [
              "GraphQL schema design and the N+1 problem",
              "DataLoader and batching",
              "gRPC, protobuf and streaming",
              "Choosing between REST, GraphQL and RPC",
            ],
          },
          {
            id: "be-layering",
            label: "Application structure",
            summary:
              "Layering and dependency direction are what code review actually catches you on.",
            topics: [
              "Controllers, services and repositories",
              "Dependency injection and testability",
              "Domain modelling basics",
              "Configuration and the twelve-factor app",
            ],
          },
        ],
      },
      {
        id: "be-s2",
        title: "Databases in anger",
        duration: "5-7 weeks",
        goal: "The single highest-value backend skill: knowing why a query is slow and what to do about it.",
        build:
          "Load ten million rows, find the slow queries, and fix them with indexes and schema changes. Document the plans before and after.",
        nodes: [
          {
            id: "be-sql",
            label: "SQL beyond SELECT",
            summary:
              "Window functions and CTEs come up constantly once you are past the junior filter.",
            topics: [
              "Joins, subqueries and CTEs",
              "Window functions for ranking and running totals",
              "Aggregations and GROUP BY semantics",
              "NULL behaviour and three-valued logic",
            ],
            ref: { href: "/05-mongodb/01-mongoose-schemas", label: "Ch — Mongoose Schemas" },
          },
          {
            id: "be-indexing",
            label: "Indexing and query plans",
            summary:
              "'This query is slow, here is the plan, what would you do?' is a standard live exercise.",
            topics: [
              "B-tree, composite and covering indexes",
              "Reading EXPLAIN ANALYZE",
              "Selectivity, cardinality and index choice",
              "When an index makes things worse",
            ],
          },
          {
            id: "be-transactions",
            label: "Transactions and isolation",
            summary:
              "Isolation levels are where interviews separate people who have run production databases from people who have not.",
            topics: [
              "ACID and the four isolation levels",
              "Lost updates, phantom reads, write skew",
              "Optimistic vs pessimistic locking",
              "Deadlocks: causes and avoidance",
            ],
          },
          {
            id: "be-modelling",
            label: "Data modelling",
            summary:
              "Normalisation, and the deliberate decision to denormalise, with reasons.",
            topics: [
              "Normal forms and when to break them",
              "Soft deletes, audit trails, temporal data",
              "Migrations that run against live traffic",
              "Document vs relational trade-offs",
            ],
          },
          {
            id: "be-nosql",
            label: "NoSQL and caching stores",
            summary:
              "Picking the right store, and being able to defend the choice, is the actual test.",
            topics: [
              "MongoDB document design and indexing",
              "Redis data structures and eviction policies",
              "Cache invalidation strategies",
              "Search engines: when you need one",
            ],
          },
        ],
      },
      {
        id: "be-s3",
        title: "Distributed behaviour",
        duration: "5-6 weeks",
        goal: "Systems that keep working when a dependency is slow, down, or lying to you.",
        build:
          "Split one service in two, connect them with a queue, and make the flow survive a consumer crash without losing or duplicating work.",
        nodes: [
          {
            id: "be-queues",
            label: "Queues and async work",
            summary:
              "Background jobs are in nearly every backend codebase and nearly every backend interview.",
            topics: [
              "Producer/consumer with Kafka, SQS or RabbitMQ",
              "At-least-once delivery and idempotent consumers",
              "Dead letter queues and poison messages",
              "Ordering guarantees and partitioning",
            ],
          },
          {
            id: "be-resilience",
            label: "Failure and resilience",
            summary:
              "Retries without backoff are how one slow service takes down four others.",
            topics: [
              "Timeouts, retries and exponential backoff with jitter",
              "Circuit breakers and bulkheads",
              "Graceful degradation and fallbacks",
              "Backpressure and load shedding",
            ],
          },
          {
            id: "be-consistency",
            label: "Consistency and coordination",
            summary:
              "The vocabulary senior interviews expect: CAP, eventual consistency, and the saga pattern.",
            topics: [
              "CAP and PACELC in practical terms",
              "Eventual consistency and read-your-writes",
              "Sagas and compensating transactions",
              "Outbox pattern for reliable publishing",
            ],
          },
          {
            id: "be-caching",
            label: "Caching strategy",
            summary:
              "Where to cache, how to invalidate, and how to avoid a stampede when it expires.",
            topics: [
              "Cache-aside, write-through, write-behind",
              "TTL choice and cache stampede prevention",
              "CDN and edge caching",
              "Cache key design and hot keys",
            ],
          },
          {
            id: "be-observability",
            label: "Observability",
            summary:
              "'The API is slow' — walk me through how you find out why. Expect this question.",
            topics: [
              "Structured logging with correlation ids",
              "RED and USE metrics",
              "Distributed tracing with OpenTelemetry",
              "Alerting on symptoms, not causes",
            ],
          },
        ],
      },
      {
        id: "be-s4",
        title: "Running it in production",
        duration: "4-5 weeks",
        goal: "Backend engineers are expected to own deployment and operations, not hand them over.",
        build:
          "Containerise a service, deploy it with zero-downtime rollout, and add a dashboard plus one meaningful alert.",
        nodes: [
          {
            id: "be-containers",
            label: "Containers and deployment",
            summary:
              "Docker literacy is assumed. Multi-stage builds and small images are the differentiator.",
            topics: [
              "Dockerfiles and multi-stage builds",
              "Health checks and graceful shutdown",
              "Rolling, blue/green and canary deploys",
              "Configuration and secrets injection",
            ],
          },
          {
            id: "be-security",
            label: "Backend security",
            summary:
              "OWASP Top 10 questions appear in most backend loops and almost all of them in fintech.",
            topics: [
              "Injection, SSRF, IDOR and mass assignment",
              "Password storage and rate limiting",
              "Secrets management and key rotation",
              "Dependency and supply-chain scanning",
            ],
          },
          {
            id: "be-perf",
            label: "Performance and load",
            summary:
              "Numbers beat adjectives. Being able to produce a load test result is a strong signal.",
            topics: [
              "Load testing with k6 and interpreting results",
              "Connection pooling and pool sizing",
              "Profiling CPU and memory",
              "N+1 queries and batch loading",
            ],
          },
          {
            id: "be-testing",
            label: "Testing backends",
            summary:
              "Testcontainers changed the standard answer: test against the real database.",
            topics: [
              "Unit vs integration vs contract tests",
              "Testcontainers for real dependencies",
              "Contract testing between services",
              "Seeding and test data management",
            ],
          },
          {
            id: "be-cost",
            label: "Cost awareness",
            kind: "recommended",
            summary:
              "Increasingly asked at senior level: what does your design cost to run?",
            topics: [
              "Cost of egress, storage and compute",
              "Right-sizing and autoscaling",
              "Query cost and read replicas",
              "Build vs buy for infrastructure",
            ],
          },
        ],
      },
      {
        id: "be-s5",
        title: "System design and interviews",
        duration: "4-6 weeks",
        goal: "The round that decides your level and your offer band.",
        build:
          "Write three design documents for systems you have not built, each with capacity estimates and a rejected alternative.",
        nodes: [
          {
            id: "be-sysdesign",
            label: "System design round",
            summary:
              "Structure beats brilliance. A repeatable method is what interviewers are scoring.",
            topics: [
              "Requirements, scale estimates, and constraints first",
              "API design, then data model, then bottleneck",
              "Sharding, replication and read scaling",
              "Trade-off articulation and rejected options",
            ],
            ref: { href: "/07-system-design/02-scalable-apis", label: "Ch — Scalable APIs" },
          },
          {
            id: "be-dsa",
            label: "DSA for backend",
            summary:
              "Heavier than frontend interviews. Graphs and heaps do appear at product companies.",
            topics: [
              "Arrays, hash maps, two pointers, sliding window",
              "Trees, graphs, BFS and DFS",
              "Heaps and priority queues",
              "Time and space complexity under pressure",
            ],
            ref: { href: "/11-dsa-coding-questions", label: "DSA Coding Questions" },
          },
          {
            id: "be-lld",
            label: "Low-level design",
            summary:
              "Very common in Indian product and service company loops: design classes for a real problem.",
            topics: [
              "SOLID applied to a real feature",
              "Common patterns: strategy, factory, observer",
              "Designing for testability",
              "Concurrency in object design",
            ],
          },
          {
            id: "be-debug",
            label: "Production debugging round",
            summary:
              "An increasingly common format: here is an incident, find the cause.",
            topics: [
              "Reading logs, traces and metrics together",
              "Bisecting a regression",
              "Reproducing under load",
              "Writing the postmortem",
            ],
          },
          {
            id: "be-behavioural",
            label: "Behavioural and ownership",
            summary:
              "Backend interviews weight ownership stories heavily — you are being trusted with data.",
            topics: [
              "An incident you owned end to end",
              "A migration you ran without downtime",
              "Pushing back on an unsafe deadline",
              "Mentoring and code review stories",
            ],
          },
        ],
      },
    ],
    tools: [
      "TypeScript / Python / Go",
      "PostgreSQL",
      "Redis",
      "Kafka",
      "Docker",
      "OpenTelemetry",
      "k6",
      "Testcontainers",
    ],
    proofOfWork: [
      "An API with an OpenAPI spec, auth, and a published rate limit policy",
      "A query optimisation write-up with EXPLAIN plans before and after",
      "A service that survives a chaos test: killed consumer, no lost messages",
      "Three system design documents with capacity estimates",
    ],
  },

  {
    slug: "full-stack-engineer",
    title: "Full-Stack Engineer",
    shortTitle: "Full-Stack",
    category: "Web & Mobile",
    mark: "FS",
    tagline:
      "Own a feature from database to pixel. The default hire at startups and the most common job title in the market.",
    market:
      "The broadest job title in software. Startups hire almost exclusively for it, and agencies and product teams treat it as the baseline. Breadth gets you hired; one deep spike gets you levelled.",
    timeline: "8-12 months part-time",
    entryBar: "Comfortable in JavaScript or Python and willing to be uncomfortable in the other half.",
    updated: "2026-08-31",
    prerequisites: [
      "JavaScript and one backend language",
      "HTML, CSS and basic SQL",
      "Git, GitHub, and a deployed project",
    ],
    stages: [
      {
        id: "fs-s1",
        title: "One vertical slice",
        duration: "5-7 weeks",
        goal: "Ship one feature through every layer before widening. Depth first, then breadth.",
        build:
          "An authenticated CRUD app: database, API, UI, deployed with a real domain and HTTPS.",
        nodes: [
          {
            id: "fs-js-ts",
            label: "JavaScript and TypeScript",
            summary:
              "The shared language across both halves of the stack, and the one interviewers probe hardest.",
            topics: [
              "Closures, promises, async/await",
              "TypeScript generics and narrowing",
              "Module systems and bundling",
              "Error handling across async boundaries",
            ],
            ref: { href: "/01-javascript/01-closures", label: "Ch 1 — Closures" },
          },
          {
            id: "fs-react",
            label: "React fundamentals",
            summary:
              "Component model, state and effects — enough to build product UI without fighting the framework.",
            topics: [
              "Components, props and composition",
              "State, effects and the dependency array",
              "Lists, keys and conditional rendering",
              "Routing and layouts",
            ],
          },
          {
            id: "fs-api",
            label: "Building the API",
            summary:
              "REST, validation and errors. The contract between your two halves.",
            topics: [
              "REST design and status codes",
              "Request validation and error shapes",
              "Middleware, logging and request context",
              "OpenAPI documentation",
            ],
          },
          {
            id: "fs-db",
            label: "Database and ORM",
            summary:
              "Schema design and migrations, plus enough SQL to escape the ORM when it fails you.",
            topics: [
              "Schema design and relationships",
              "Migrations and rollback",
              "ORM query patterns and their SQL output",
              "Indexes and the N+1 problem",
            ],
          },
          {
            id: "fs-auth",
            label: "Auth end to end",
            summary:
              "Sessions or tokens, on both sides of the wire. The most common full-stack take-home.",
            topics: [
              "Session cookies vs JWT",
              "Password hashing and reset flows",
              "Protected routes on client and server",
              "OAuth social login",
            ],
          },
        ],
      },
      {
        id: "fs-s2",
        title: "Production quality",
        duration: "5-6 weeks",
        goal: "The difference between a demo and something a team would let you deploy on a Friday.",
        build:
          "Add tests, CI, error tracking and a staging environment to the app from stage 1.",
        nodes: [
          {
            id: "fs-testing",
            label: "Testing both halves",
            summary:
              "Full-stack testing means knowing what to test at which layer, and not testing everything twice.",
            topics: [
              "Component tests with Testing Library",
              "API integration tests against a real database",
              "One end-to-end happy path with Playwright",
              "Test data and fixtures",
            ],
          },
          {
            id: "fs-cicd",
            label: "CI/CD and environments",
            summary:
              "Being the person who set up the pipeline is a strong signal at startup interviews.",
            topics: [
              "GitHub Actions: lint, test, build, deploy",
              "Staging vs production configuration",
              "Database migrations in the pipeline",
              "Rollback plan",
            ],
          },
          {
            id: "fs-observability",
            label: "Logging and error tracking",
            summary:
              "Knowing something broke before your users tell you.",
            topics: [
              "Structured logs with request ids",
              "Error tracking on client and server",
              "Uptime checks and alerting",
              "Basic dashboards",
            ],
          },
          {
            id: "fs-security",
            label: "Security basics",
            summary:
              "XSS, CSRF, injection and secrets. Enough to not be the reason for the breach.",
            topics: [
              "OWASP Top 10 in practice",
              "CSRF protection and SameSite cookies",
              "Input sanitisation and output encoding",
              "Secrets and environment configuration",
            ],
          },
          {
            id: "fs-perf",
            label: "Performance across the stack",
            summary:
              "The full-stack advantage: you can tell whether the problem is the query or the bundle.",
            topics: [
              "Core Web Vitals on the frontend",
              "Query profiling on the backend",
              "Caching at both layers",
              "Image and asset optimisation",
            ],
          },
        ],
      },
      {
        id: "fs-s3",
        title: "Framework depth",
        duration: "5-6 weeks",
        goal: "Pick one modern full-stack framework and know it properly, including where it runs your code.",
        build:
          "Rebuild your stage 1 app in a server-rendered framework with streaming and server-side data loading.",
        nodes: [
          {
            id: "fs-nextjs",
            label: "Server-rendered React",
            summary:
              "The server/client boundary is the defining full-stack question of the current stack.",
            topics: [
              "Server components vs client components",
              "Data loading and caching on the server",
              "Server actions and mutations",
              "Streaming and Suspense boundaries",
            ],
          },
          {
            id: "fs-nest",
            label: "A structured backend framework",
            summary:
              "NestJS, Django or Rails — one opinionated framework you can defend in interview.",
            topics: [
              "Modules, providers and dependency injection",
              "Guards, interceptors and pipes",
              "Background jobs and scheduling",
              "Framework testing utilities",
            ],
            ref: { href: "/04-express-nestjs/01-express-vs-nestjs", label: "Ch — Express vs NestJS" },
          },
          {
            id: "fs-realtime",
            label: "Real-time features",
            kind: "recommended",
            summary:
              "Chat, notifications and live updates come up in almost every product take-home now.",
            topics: [
              "WebSockets vs SSE vs polling",
              "Presence and reconnection handling",
              "Scaling sockets across instances",
              "Optimistic UI with rollback",
            ],
          },
          {
            id: "fs-files",
            label: "Files, uploads and media",
            summary:
              "Every product needs it, and doing it correctly with presigned URLs is a good signal.",
            topics: [
              "Presigned uploads to object storage",
              "Image resizing and CDN delivery",
              "Virus scanning and content type checks",
              "Large file and resumable uploads",
            ],
          },
          {
            id: "fs-payments",
            label: "Payments and third-party integrations",
            kind: "recommended",
            summary:
              "Webhook handling and idempotency are the parts candidates get wrong.",
            topics: [
              "Stripe checkout and webhooks",
              "Idempotency keys and replay safety",
              "Reconciliation and failed payments",
              "PCI scope awareness",
            ],
          },
        ],
      },
      {
        id: "fs-s4",
        title: "Architecture and scale",
        duration: "4-5 weeks",
        goal: "Answer 'what happens when this has a hundred times the traffic' without hand-waving.",
        build:
          "Take one endpoint to 1,000 requests per second on a load test, and write up what you changed.",
        nodes: [
          {
            id: "fs-sysdesign",
            label: "System design for product engineers",
            summary:
              "Full-stack loops ask product-shaped design questions: design Instagram stories, not design Kafka.",
            topics: [
              "Requirements and scale estimation",
              "Data model and access patterns",
              "Caching and CDN strategy",
              "Identifying the bottleneck",
            ],
            ref: { href: "/07-system-design/02-scalable-apis", label: "Ch — Scalable APIs" },
          },
          {
            id: "fs-caching",
            label: "Caching everywhere",
            summary:
              "Browser, CDN, application and database. Knowing which layer to fix is the skill.",
            topics: [
              "HTTP caching and CDN rules",
              "Redis application cache",
              "Query result caching and invalidation",
              "Stale-while-revalidate patterns",
            ],
          },
          {
            id: "fs-queues",
            label: "Background processing",
            summary:
              "Anything slow belongs off the request path. Interviewers check you know which things.",
            topics: [
              "Job queues and workers",
              "Scheduled and recurring jobs",
              "Retries and dead letter handling",
              "Email, export and report generation",
            ],
          },
          {
            id: "fs-multitenancy",
            label: "Multi-tenancy and permissions",
            kind: "recommended",
            summary:
              "Nearly every B2B product needs it, and getting isolation wrong is a security incident.",
            topics: [
              "Row-level vs schema-level isolation",
              "Role and permission modelling",
              "Tenant-scoped queries by default",
              "Admin impersonation done safely",
            ],
          },
          {
            id: "fs-ai",
            label: "Adding AI features",
            kind: "recommended",
            summary:
              "In 2026 most product roles expect you to wire an LLM into a feature competently.",
            topics: [
              "Calling an LLM API with streaming",
              "Retrieval over your own data",
              "Cost, latency and caching",
              "Evaluating output quality",
            ],
          },
        ],
      },
      {
        id: "fs-s5",
        title: "Interview and evidence",
        duration: "4-6 weeks",
        goal: "Full-stack loops mix a take-home, a system design round, and DSA. Prepare all three.",
        build:
          "One flagship product, deployed, with real users if you can get them, and a written architecture document.",
        nodes: [
          {
            id: "fs-takehome",
            label: "The take-home",
            summary:
              "The most common full-stack filter. Scope control and a good README beat extra features.",
            topics: [
              "Reading the brief for the real requirements",
              "Scoping to the time limit deliberately",
              "README: decisions, trade-offs, what you skipped",
              "Tests that demonstrate judgement",
            ],
          },
          {
            id: "fs-dsa",
            label: "DSA preparation",
            summary:
              "Still a gate at most product companies, even for product-focused roles.",
            topics: [
              "Arrays, strings and hash maps",
              "Two pointers and sliding window",
              "Trees, recursion and BFS/DFS",
              "Complexity analysis",
            ],
            ref: { href: "/11-dsa-coding-questions", label: "DSA Coding Questions" },
          },
          {
            id: "fs-codereview",
            label: "Code review round",
            summary:
              "Increasingly common: review a pull request out loud and say what you would block on.",
            topics: [
              "Spotting security and correctness issues",
              "Distinguishing blocking from nit",
              "Giving feedback that lands",
              "Reading unfamiliar code quickly",
            ],
          },
          {
            id: "fs-portfolio",
            label: "Portfolio and README craft",
            summary:
              "Reviewers spend three minutes. Make the first screen of the README do the work.",
            topics: [
              "Problem, architecture, trade-offs, screenshots",
              "Live demo with seeded data",
              "Setup that works from a clean clone",
              "Honest limitations section",
            ],
          },
          {
            id: "fs-behavioural",
            label: "Behavioural round",
            summary:
              "Startups probe autonomy and judgement more than process. Have stories with numbers.",
            topics: [
              "Shipping something end to end alone",
              "A trade-off you made under time pressure",
              "Working directly with users or stakeholders",
              "Learning an unfamiliar part of the stack fast",
            ],
          },
        ],
      },
    ],
    tools: [
      "TypeScript",
      "React",
      "Next.js",
      "Node.js / NestJS",
      "PostgreSQL",
      "Prisma",
      "Redis",
      "Docker",
      "Playwright",
    ],
    proofOfWork: [
      "One deployed product with authentication, payments and real data",
      "A take-home repo with a README a reviewer can follow in three minutes",
      "A load test result showing a bottleneck found and fixed",
      "An architecture document for your flagship project",
    ],
  }
];
