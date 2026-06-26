import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AgentChainWorkspace from './AgentChainWorkspace';
import { BrowserRouter } from 'react-router-dom';
import { waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../api';

vi.mock('../../api');

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('./AgentDetailPanel', () => ({
  default: ({ onRunComplete }) => (
    <div data-testid="mock-agent-detail">
      <button onClick={() => onRunComplete({ id: 99, agent_name: 'Test' })} data-testid="run-complete-btn">
        Trigger Run Complete
      </button>
    </div>
  )
}));

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ onNodeClick, nodes }) => (
    <div data-testid="mock-react-flow">
      {nodes.map(node => (
        <button key={node.id} onClick={(e) => onNodeClick(e, node)} data-testid={`node-${node.id}`}>
          {node.data.name}
        </button>
      ))}
    </div>
  ),
  Background: () => <div />,
  Controls: () => <div />,
  MarkerType: { ArrowClosed: 'ArrowClosed' },
  useNodesState: (initial) => React.useState(initial),
  useEdgesState: (initial) => React.useState(initial),
}));

describe('AgentChainWorkspace', () => {
  it('renders the workspace with Graph Canvas', () => {
    render(
      <BrowserRouter>
        <AgentChainWorkspace topicId="25" />
      </BrowserRouter>
    );
    
    // Check for main layout elements
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
  });

  it('fetches chain versions on load', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/topics/25/') return Promise.resolve({ data: { title: 'Topic 25' } });
      if (url === '/api/topics/25/agent-graph/') return Promise.resolve({ data: { nodes: [], edges: [] } });
      if (url === '/api/topics/25/chain-versions/') return Promise.resolve({ data: [{ id: 10, version_number: 1, status: 'draft' }] });
      if (url === '/api/chain-versions/10/trace/') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AgentChainWorkspace topicId="25" />
      </BrowserRouter>
    );

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/topics/25/chain-versions/'));
  });

  it('reloads traces and graph when a node run completes', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/topics/25/') return Promise.resolve({ data: { title: 'Topic 25' } });
      if (url === '/api/topics/25/agent-graph/') return Promise.resolve({ data: { nodes: [{ id: 1, name: 'Test Node', position_x: 0, position_y: 0 }], edges: [] } });
      if (url === '/api/topics/25/chain-versions/') return Promise.resolve({ data: [{ id: 10, version_number: 1, status: 'draft' }] });
      if (url === '/api/chain-versions/10/trace/') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    render(
      <BrowserRouter>
        <AgentChainWorkspace topicId="25" />
      </BrowserRouter>
    );

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/topics/25/agent-graph/'));
    
    // Clear mocks to track new calls
    api.get.mockClear();

    // Since we can't easily click ReactFlow nodes, we will manually set selectedNode state if possible.
    // Wait, mock-agent-detail won't render unless selectedNode is set!
    // How to set selectedNode? Let's just mock ReactFlow to pass selectedNode automatically, or mock the button.
    // Actually, ReactFlow nodes are rendered. Let's click the node to open AgentDetailPanel!
    const nodeButton = screen.getByTestId('node-1');
    fireEvent.click(nodeButton);

    // Now AgentDetailPanel should render
    await waitFor(() => expect(screen.getByTestId('mock-agent-detail')).toBeInTheDocument());

    // Trigger Run Complete
    fireEvent.click(screen.getByTestId('run-complete-btn'));

    // We expect both loadTraces and loadGraph to be called
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/chain-versions/10/trace/');
      
      // Ensure loadGraph was called again
      const graphCalls = api.get.mock.calls.filter(call => call[0] === '/api/topics/25/agent-graph/');
      expect(graphCalls.length).toBeGreaterThan(0);
    });
  });
});
