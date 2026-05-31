import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('TraceabilityPanel', () => {
  it('displays traceability and telemetry placeholders', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);

    // 1. TaskDetailDrawer shows TraceabilityPanel
    const taskRow = screen.getAllByText(/Create Algolia implementation plan/i)[1];
    await user.click(taskRow);

    const drawer = screen.getByRole('dialog', { name: /Task Detail/i });
    expect(drawer).toBeInTheDocument();

    const traceabilitySection = screen.getByText(/Traceability/i).parentElement;
    expect(traceabilitySection).toBeInTheDocument();
    
    // 2. TraceabilityPanel displays specific placeholders
    expect(within(traceabilitySection!).getByText(/parent_plan_id/i)).toBeInTheDocument();
    expect(within(traceabilitySection!).getByText(/prompt_version/i)).toBeInTheDocument();
    expect(within(traceabilitySection!).getByText(/model_version/i)).toBeInTheDocument();
    expect(within(traceabilitySection!).getByText(/source documents/i)).toBeInTheDocument();
    // 3. Empty telemetry should display "No agent runs recorded"
    expect(within(traceabilitySection!).getByText(/No agent runs recorded/i)).toBeInTheDocument();

    // 4. Inputs JSON should be human-readable
    // The query looks for the parent element containing "Inputs" header
    const inputsHeader = screen.getByRole('heading', { name: /Inputs/i });
    const inputsSection = inputsHeader.parentElement;
    const inputsPre = inputsSection!.querySelector('pre');
    expect(inputsPre).toBeInTheDocument();

    // 5. Outputs JSON should be human-readable
    const outputsHeader = screen.getByRole('heading', { name: /Outputs/i });
    expect(outputsHeader).toBeInTheDocument();
  });
});
