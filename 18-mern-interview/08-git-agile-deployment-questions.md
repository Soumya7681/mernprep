# Chapter 119 — MERN Interview: Git, Agile, Testing, Deployment & Team Questions

## 📖 Why These Questions Matter

Interviewers want to know you can work **inside a team and a delivery process**, not only write code. These questions are quick to answer if you've prepared, and losing points here is common.

---

## 🌿 Git

### 1. Which branching strategy did you follow?

> "We used a feature-branch workflow: `main` is always deployable, `develop` for integration, and `feature/JIRA-123-short-name` branches for each story. After review, PRs merge into `develop`; releases go from `develop` to `main` with a tag. Hotfixes branch from `main`."

### 2. `git merge` vs `git rebase`?

Merge combines branches with a merge commit and keeps history as it happened. Rebase replays your commits on top of another branch for a linear history. Rule: rebase your **own** local branch to update it; never rebase shared/public branches.

### 3. How do you resolve merge conflicts?

Pull the latest target branch, merge or rebase, open conflicted files, decide the correct combined code (talk to the other developer if unsure), run tests, then commit. Avoid conflicts with small, frequent PRs.

### 4. `git reset` vs `git revert`?

`reset` moves the branch pointer back (rewrites history — local only). `revert` creates a new commit that undoes a previous one — safe for shared branches.

### 5. `git stash`, `cherry-pick`?

`stash` saves uncommitted changes temporarily. `cherry-pick` applies a specific commit to another branch (e.g. a hotfix to a release branch).

### 6. What makes a good pull request?

Small and focused, clear title and description (what, why, how to test), linked ticket, screenshots for UI, tests included, self-reviewed before requesting review.

### 7. What do you look for in code reviews?

Correctness and edge cases, security (validation, auth checks), performance (N+1, missing indexes), readability and naming, tests, consistency with project patterns. Comments are polite and specific.

---

## 🏃 Agile / Scrum

### 8. What is your sprint process?

> "Two-week sprints: sprint planning to pick and estimate stories, daily stand-up (yesterday, today, blockers), development with PR reviews, QA testing, sprint review/demo with the product owner, and a retrospective."

### 9. What do you say in a daily stand-up?

What I completed yesterday, what I'll do today, and any blockers — in under a minute. Details are discussed after the stand-up.

### 10. How do you estimate stories? Story points?

Relative effort (complexity + uncertainty), often Fibonacci (1, 2, 3, 5, 8). The team agrees using planning poker. Large stories (13+) are split.

### 11. What is the Definition of Done?

Code complete, reviewed, tests written and passing, deployed to QA/staging, acceptance criteria met, documentation updated where needed.

### 12. How do you handle a task you can't finish in the sprint?

Raise it early in stand-up with the reason, discuss splitting or re-prioritising with the lead/PO; don't wait until the last day.

### 13. Which tools have you used?

Jira/Azure Boards for tickets, Confluence for docs, GitHub/GitLab/Bitbucket for code, Slack/Teams for communication, Postman for APIs, Figma for designs.

---

## 🧪 Testing

### 14. What testing have you done?

> "Unit tests with Jest for services and utility functions, API integration tests with Supertest and an in-memory MongoDB, React component tests with React Testing Library, and API mocking with MSW. QA did manual and some Cypress end-to-end tests."

### 15. Unit vs integration vs end-to-end tests?

Unit tests one function in isolation (fast). Integration tests several parts together (API + DB). E2E tests the whole app through the browser (slow, few, for critical flows like login and checkout).

### 16. What is code coverage and is 100% needed?

The % of code executed by tests. 100% isn't required; aim for meaningful coverage of business logic and critical paths (often 70–80%).

### 17. How do you mock an API in tests?

Jest mocks (`jest.mock`) for modules, MSW for network requests in frontend tests, Supertest + in-memory DB for backend tests instead of mocking Mongoose.

---

## 🚀 Deployment & DevOps

### 18. How was your application deployed?

> "Frontend: React build deployed to S3 + CloudFront (or Vercel). Backend: Dockerised Node API on AWS ECS behind an Application Load Balancer, MongoDB Atlas, secrets in AWS Secrets Manager. GitHub Actions ran lint, tests and build on every PR, and deployed to staging on merge to `develop` and to production on a release tag."

### 19. What is CI/CD?

Continuous Integration: every push is automatically built and tested. Continuous Delivery/Deployment: passing builds are automatically deployed to staging/production. Benefits: fast feedback, fewer manual errors, frequent safe releases.

### 20. Write a simple Dockerfile for a Node API.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
```

For TypeScript, use a multi-stage build: compile in the first stage, copy only `dist` and production dependencies into the final image.

### 21. How do you manage environments (dev, QA, staging, production)?

Separate databases and configs per environment, env variables for secrets and URLs, the same Docker image promoted from staging to production, and restricted production access.

### 22. What is PM2?

A process manager for Node: keeps the app running, restarts on crash, cluster mode across CPU cores, log management, zero-downtime reloads. Used on VMs; in containers the orchestrator does this instead.

### 23. Nginx — why use it in front of Node?

Reverse proxy: HTTPS termination, gzip, serving static files, load balancing across Node instances, request size limits and basic rate limiting.

### 24. How do you monitor production?

Logs (CloudWatch/ELK), errors (Sentry), metrics and alerts (CPU, memory, latency, error rate), uptime checks, and dashboards; on-call rotation for critical alerts.

---

## 🤝 Team & Communication

### 25. How do you communicate with clients or onsite teams in different time zones?

Clear written updates at the end of my day (done, in progress, blockers, questions), overlap hours for calls, notes from meetings shared in Teams/Slack and Jira, and asking questions early so I'm not blocked overnight.

### 26. What do you do if you're blocked?

Try for a reasonable time (research, logs, docs), then ask a teammate or lead with what I tried and what I suspect. Meanwhile pick another task so time isn't wasted.

### 27. How do you handle disagreement on a technical approach?

Understand the other view, compare options with facts (performance, effort, risk), maybe build a small proof of concept, and agree with the lead. Once decided, commit fully even if my option wasn't chosen.

### 28. Have you mentored juniors or done KT (knowledge transfer)?

> "Yes — I onboarded two new developers: walked them through the architecture and code structure, paired on their first stories, and wrote a setup and module guide in Confluence that reduced onboarding time."

### 29. How do you keep your skills up to date?

Official docs and release notes (React, Node, MongoDB), building small side projects, reading engineering blogs, and applying new learning at work when useful — for example I introduced RTK Query in our project after trying it in a side project.

### 30. Are you comfortable working on both frontend and backend? Any preference?

Answer honestly, e.g.: "Yes, I've delivered features end to end. I'm slightly stronger on the backend — API design and MongoDB performance — but I'm comfortable owning React screens as well."

---

[← Live Coding Tasks](07-live-coding-tasks.md) | [Index](../README.md) | [Next: Frontend Tasks →](../06-machine-coding/01-frontend-tasks.md)
