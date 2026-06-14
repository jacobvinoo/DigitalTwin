import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AgentChainWorkspace from './AgentChainWorkspace';
import { BrowserRouter } from 'react-router-dom';

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('AgentChainWorkspace', () => {
  it('renders the workspace with Graph Canvas and Config Panel', () => {
    render(
      <BrowserRouter>
        <AgentChainWorkspace />
      </BrowserRouter>
    );
    
    // Check for main layout elements
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('config-panel')).toBeInTheDocument();
  });
});
