import { describe, it, expect } from 'vitest';
import { mapBackendToReactFlow } from './agentGraphMapper';

describe('agentGraphMapper', () => {
  it('maps backend agent definitions to React Flow nodes', () => {
    const backendData = {
      nodes: [
        { id: 1, name: 'Researcher', is_entrypoint: true, position_x: 100, position_y: 200 },
        { id: 2, name: 'Writer', is_entrypoint: false, position_x: 300, position_y: 400 }
      ],
      edges: []
    };

    const { initialNodes } = mapBackendToReactFlow(backendData);
    
    expect(initialNodes).toHaveLength(2);
    expect(initialNodes[0].id).toBe('1');
    expect(initialNodes[0].type).toBe('agentNode');
    expect(initialNodes[0].position).toEqual({ x: 100, y: 200 });
    expect(initialNodes[0].data.name).toBe('Researcher');
    expect(initialNodes[0].data.isEntrypoint).toBe(true);
  });

  it('maps backend edges to React Flow edges', () => {
    const backendData = {
      nodes: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ],
      edges: [
        { id: 99, source_agent: 1, target_agent: 2, label: 'Mapping' }
      ]
    };

    const { initialEdges } = mapBackendToReactFlow(backendData);
    
    expect(initialEdges).toHaveLength(1);
    expect(initialEdges[0].id).toBe('e-99');
    expect(initialEdges[0].source).toBe('1');
    expect(initialEdges[0].target).toBe('2');
    expect(initialEdges[0].label).toBe('Mapping');
  });
});
