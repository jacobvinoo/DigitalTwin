# StrategyPad PRD (Product Requirements Document)

## Product Vision
StrategyPad is an intelligent governance and strategy execution platform. It transforms high-level objectives into structured workstreams, task ledgers, and autonomous actions, complete with traceability, evaluation, and memory persistence. 

## Current Status: Phase 3 Completed
Phase 1 established the core UI and basic backend models.
Phase 2 implemented simulated deterministic workflows to mock the intended user flows.
Phase 3 fully wired the frontend UI to the real Python Django backend endpoints, introducing active state persistence and live connectivity to real AI agent workflows (LangGraph).

## Key Features (Phase 1 & 2)
1. **Topic Workspace Creation:**
   - Users can define a topic, objective, and strategic context.
   - The system automatically provisions a workspace with relevant workstreams.

2. **Command Centre Dashboard:**
   - **Workstreams:** Visual grouping of tasks.
   - **Approval Queue:** Dedicated queue for tasks requiring manual sign-off due to risk levels.
   - **Metrics:** Track active tasks, completed tasks, pending approvals, and average quality scores.
   - **Task Ledger:** A tabular view of all tasks, their status, risk level, and required approvals.

3. **Task Governance & Feedback:**
   - **Risk-based Approvals:** Low-risk tasks can be auto-executed. Medium/High-risk tasks require user approval.
   - **Task Details Drawer:** View task execution lineage, governance constraints, inputs/outputs, and traceability.
   - **Feedback Loop:** Users can leave specific feedback on tasks.
   - **Scorecards:** Users can rate the quality of executed tasks (1-10 scale), which feeds into the workspace's average quality score.

4. **Memory Review:**
   - Users can review proposed "memory candidates" (extracted from feedback/tasks).
   - Users can approve or reject these memories to build a persistent knowledge base for future autonomous execution.

## Key Features (Phase 3 Integration)
1. **Live Backend Connectivity:**
   - Removed `localStorage` state simulation.
   - Replaced mocked fetch logic with live API integration to the Django `/api/tasks/`, `/api/topics/`, and `/api/workflows/` endpoints.
2. **Deterministic Execution Engine:**
   - Enabled real execution tracing and telemetry logging directly from the live backend services.

## Future Phases
*(To be updated as the project progresses)*
