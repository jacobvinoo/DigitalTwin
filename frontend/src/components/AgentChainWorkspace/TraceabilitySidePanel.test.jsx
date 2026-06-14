import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TraceabilitySidePanel from './TraceabilitySidePanel';

describe('TraceabilitySidePanel', () => {
  const mockTraceData = {
    agentName: 'Web Researcher',
    status: 'completed',
    input_payload: { url: 'https://example.com' },
    prompt_snapshot: 'System: You are a researcher. Input: https://example.com',
    output_payload: { summary: 'This is a summary.' }
  };

  it('renders the empty state when no trace data is selected', () => {
    render(<TraceabilitySidePanel selectedTrace={null} />);
    expect(screen.getByText('Select a node to view its execution trace')).toBeInTheDocument();
  });

  it('renders trace data correctly when provided', () => {
    render(<TraceabilitySidePanel selectedTrace={mockTraceData} />);
    
    // Check header
    expect(screen.getByText('Execution Trace')).toBeInTheDocument();
    expect(screen.getByText('Web Researcher')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();

    // Check payload tabs
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
    
    // Check initial input payload content
    expect(screen.getByText(/"url": "https:\/\/example.com"/)).toBeInTheDocument();
  });

  it('switches tabs between Input, Prompt, and Output', () => {
    render(<TraceabilitySidePanel selectedTrace={mockTraceData} />);
    
    const promptTab = screen.getByText('Prompt');
    fireEvent.click(promptTab);
    expect(screen.getByText(/You are a researcher/)).toBeInTheDocument();

    const outputTab = screen.getByText('Output');
    fireEvent.click(outputTab);
    expect(screen.getByText(/"summary": "This is a summary."/)).toBeInTheDocument();
  });
});
