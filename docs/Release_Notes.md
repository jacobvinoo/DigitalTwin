# Release Notes

## [v1.3.0] Phase 3: Real Agents Integration

**Date:** May 31, 2026

We are thrilled to announce the completion of Phase 3, which successfully wires the StrategyPad UI directly into our live Python/Django backend agents! 

### Enhancements & New Features
*   **Live Backend Integration:** The simulated deterministic UI flows have been entirely replaced with live API calls.
    *   `TopicCommandCentre` now fetches real workspace data via `/api/topics/{id}/command-centre/` and `/api/tasks/`.
    *   `WorkflowExecutionPanel` now connects directly to the `/api/workflows/` endpoint.
*   **Task Ledger Connectivity:** 
    *   Accepting Revisions, Rerunning Agents, and Submitting Task Feedbacks now map to the live database, allowing execution logic to be permanently persisted.
*   **Removed Local Simulation:** Stripped out `localStorage` logic that was used to mock Phase 2 behaviors. The UI now fully relies on standard DB persistence.
*   **Testing Infrastructure Upgrades:** Integrated rigorous Test-Driven Development (TDD) using Vitest and Mock Service Worker principles to enforce strict contract testing between frontend requests and backend agent logic.
