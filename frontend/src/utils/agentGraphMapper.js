export const mapBackendToReactFlow = (backendData) => {
  if (!backendData) return { initialNodes: [], initialEdges: [] };

  const initialNodes = (backendData.nodes || []).map(agent => ({
    id: String(agent.id),
    type: 'agentNode',
    position: { x: agent.position_x || 0, y: agent.position_y || 0 },
    data: {
      name: agent.name,
      role: agent.role,
      systemPrompt: agent.system_prompt,
      isEntrypoint: agent.is_entrypoint,
      modelName: agent.model_name,
      metrics: agent.metrics
    }
  }));

  const initialEdges = (backendData.edges || []).map(edge => ({
    id: `e-${edge.id}`,
    source: String(edge.source_agent),
    target: String(edge.target_agent),
    label: edge.label,
    data: { mapping: edge.data_mapping }
  }));

  return { initialNodes, initialEdges };
};
