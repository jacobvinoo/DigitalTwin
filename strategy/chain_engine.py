from collections import defaultdict
from strategy.models import AgentDefinition, AgentEdge

class AgentChainValidator:
    def __init__(self, topic):
        self.topic = topic

    def validate(self):
        errors = []
        agents = list(AgentDefinition.objects.filter(topic=self.topic))
        edges = list(AgentEdge.objects.filter(topic=self.topic))

        if not agents:
            errors.append("Graph must contain at least one agent")
            return False, errors

        entrypoints = [a for a in agents if a.is_entrypoint]
        if len(entrypoints) != 1:
            errors.append("Graph must have exactly one entrypoint agent")

        # Check for cycles using DFS
        adj = defaultdict(list)
        for edge in edges:
            adj[edge.source_agent_id].append(edge.target_agent_id)

        visited = set()
        rec_stack = set()
        
        def is_cyclic(node_id):
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for neighbor in adj[node_id]:
                if neighbor not in visited:
                    if is_cyclic(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
            
            rec_stack.remove(node_id)
            return False

        for a in agents:
            if a.id not in visited:
                if is_cyclic(a.id):
                    errors.append("Graph contains a cycle")
                    break

        # Check schema matching
        agent_map = {a.id: a for a in agents}
        for edge in edges:
            source = agent_map.get(edge.source_agent_id)
            target = agent_map.get(edge.target_agent_id)
            
            if not source or not target:
                continue
                
            required_inputs = target.input_schema.get("required", [])
            mapped_targets = list(edge.data_mapping.values())
            
            for req in required_inputs:
                if req not in mapped_targets:
                    errors.append(f"Missing required mapped input '{req}' for target agent {target.name}")

        return len(errors) == 0, errors

import json
from django.utils import timezone
from strategy.models import ChainExecutionVersion, AgentRunTrace, AgentPromptAssignment, PromptExecutionTrace
from jsonschema import validate as validate_json_schema

def get_llm_client():
    from strategy.agents.client import LLMClient
    return LLMClient()

class AgentChainExecutor:
    def execute(self, *, topic, user, trigger_input):
        validator = AgentChainValidator(topic)
        is_valid, errors = validator.validate()
        if not is_valid:
            raise ValueError(f"Invalid graph: {errors}")

        agents = list(AgentDefinition.objects.filter(topic=topic))
        edges = list(AgentEdge.objects.filter(topic=topic))

        # Snapshot
        graph_snapshot = {
            "agents": [{"id": a.id, "name": a.name, "system_prompt": a.system_prompt} for a in agents],
            "edges": [{"source": e.source_agent_id, "target": e.target_agent_id, "mapping": e.data_mapping} for e in edges]
        }

        # Calculate next version
        last_v = ChainExecutionVersion.objects.filter(topic=topic).order_by('-version_number').first()
        version_num = (last_v.version_number + 1) if last_v else 1

        version = ChainExecutionVersion.objects.create(
            topic=topic,
            version_number=version_num,
            status="running",
            trigger_input=trigger_input,
            graph_snapshot=graph_snapshot,
            started_by=user
        )

        # Topological Sort
        adj = defaultdict(list)
        in_degree = defaultdict(int)
        agent_map = {a.id: a for a in agents}

        for e in edges:
            adj[e.source_agent_id].append(e.target_agent_id)
            in_degree[e.target_agent_id] += 1

        queue = [a.id for a in agents if in_degree[a.id] == 0]
        sorted_ids = []
        
        while queue:
            curr = queue.pop(0)
            sorted_ids.append(curr)
            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # Execution
        completed_outputs = {}
        run_order = 1
        
        for agent_id in sorted_ids:
            agent = agent_map[agent_id]
            
            # Build input payload
            input_payload = {}
            if agent.is_entrypoint:
                input_payload = trigger_input
            else:
                # Find incoming edges
                incoming = [e for e in edges if e.target_agent_id == agent.id]
                for edge in incoming:
                    src_out = completed_outputs.get(edge.source_agent_id, {})
                    for src_field, tgt_field in edge.data_mapping.items():
                        if src_field in src_out:
                            input_payload[tgt_field] = src_out[src_field]
                            
            # Compose Prompt
            assignments = list(AgentPromptAssignment.objects.filter(agent=agent, enabled=True).order_by('sort_order'))
            composed_prompt_parts = []
            
            for assignment in assignments:
                composed_prompt_parts.append(f"--- {assignment.prompt_template.name} ---\n{assignment.prompt_template.prompt_body}")
                
            composed_prompt_parts.append(f"--- System Instructions ---\n{agent.system_prompt}")
            
            full_prompt_instructions = "\n\n".join(composed_prompt_parts)

            prompt = f"{full_prompt_instructions}\n\nInput Data: {json.dumps(input_payload)}"
            
            trace = AgentRunTrace.objects.create(
                execution_version=version,
                agent=agent,
                run_order=run_order,
                status="running",
                input_payload=input_payload,
                prompt_snapshot=prompt,
                started_at=timezone.now()
            )
            
            # Record Prompt Traces
            for i, assignment in enumerate(assignments, start=1):
                PromptExecutionTrace.objects.create(
                    agent_trace=trace,
                    prompt_template=assignment.prompt_template,
                    version_number=assignment.prompt_template.version,
                    prompt_snapshot=assignment.prompt_template.prompt_body,
                    execution_order=i
                )
            
            try:
                llm = get_llm_client()
                # If using mock, our test LLM doesn't have true schema validation, but we expect dict back.
                # Standard LLMClient in product has .execute or .complete_json
                if hasattr(llm, "complete_json"):
                    output = llm.complete_json(prompt=prompt, output_schema=agent.output_schema, model=agent.model_name)
                else:
                    output = llm.execute(prompt=prompt, schema_class=agent.output_schema, model=agent.model_name)
                    # For tests where LLM is completely mocked out, we might just get dict
                    if not isinstance(output, dict):
                        output = getattr(output, "data", {})
                
                trace.output_payload = output
                trace.status = "completed"
                trace.completed_at = timezone.now()
                trace.save()
                
                completed_outputs[agent.id] = output
                
            except Exception as e:
                trace.status = "failed"
                trace.validation_result = {"error": str(e)}
                trace.completed_at = timezone.now()
                trace.save()
                
                version.status = "failed"
                version.completed_at = timezone.now()
                version.save()
                return version
            
            run_order += 1

        version.status = "completed"
        version.completed_at = timezone.now()
        version.save()

        return version
