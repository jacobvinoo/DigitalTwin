# StrategyPad System Design

## Architecture Overview
StrategyPad is a modern web application separated into a React frontend and a Django backend, connected via REST APIs.

### 1. Frontend (Client)
- **Framework:** React 19 via Vite.
- **Language:** TypeScript.
- **Routing:** React Router v7.
- **Styling:** Tailwind CSS.
- **Testing:** Vitest, React Testing Library, and Playwright for E2E testing.
- **Key Components:**
  - `TopicCreateWizard`: Wizard for defining topic parameters.
  - `TopicCommandCentre`: Main dashboard and state coordinator.
  - `MemoryReview`: Interface for approving/rejecting memory rules.
  - Sub-panels: `ApprovalFlow`, `FeedbackScorecard`, `TraceabilityPanel`.

### 2. Backend (Server)
- **Framework:** Django (Python 3.12).
- **App Structure:** The primary app is `strategy`, which houses core business logic, APIs, and models.
- **Testing:** Pytest with Django plugins.
- **Core Models:**
  - `Topic`, `Objective`, `Workstream`
  - `TaskLedgerEntry` (tracks individual tasks, risk, approval status)
  - `FeedbackRecord`, `EvaluationScorecard` (tracks user feedback and ratings)
  - `MemoryRecord` (tracks reusable strategic context)

### 3. Data & State Flow
- **Topic Creation:** User submits form -> POST to backend -> Redirect to Command Centre.
- **Task Governance:** Tasks fetched from backend. Users interact with the Task Ledger to approve/reject tasks via `POST /api/tasks/{id}/approve/`.
- **Scorecards & Feedback:** Interactions trigger isolated API calls (`/score/` and `/feedback/`) which update the central task metrics.
- **Client State:** Primarily handled locally within the components (e.g., `TopicCommandCentre`). (Note: Phase 1 E2E tests currently utilize `localStorage` to mock persistence across routes).

## Quality Assurance
- **E2E Testing:** Playwright is configured to test the critical user path sequentially, verifying UI state and transitions.
- **Unit Testing:** Vitest and RTL provide component-level isolation tests for key user interactions.

## Future Architecture Considerations
*(To be updated as the project progresses)*
