from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Topic, AgentDefinition, AgentEdge, AgentPromptAssignment, EvaluationAssignment, AgentRunTrace, AgentArtifact, SourceRecord, ChainExecutionVersion, EvaluationRun, AgentEvaluationHistory, AgentImprovementRecommendation, WebpageArtifact
from .agent_serializers import AgentDefinitionSerializer, AgentEdgeSerializer
from .webpage_serializers import WebpageBuilderRequestSerializer, WebpageArtifactSerializer
from strategy.agents.client import LLMClient
from pydantic import BaseModel, Field
from typing import List

class SearchQuerySchema(BaseModel):
    queries: List[str] = Field(description="A list of targeted search queries to execute on the web.")

class SimulatedSearchResult(BaseModel):
    title: str
    href: str
    body: str

class SimulatedSearchResponse(BaseModel):
    results: List[SimulatedSearchResult]

class EvaluationResultSchema(BaseModel):
    score: int = Field(description="An integer score from 1 to 10 based on the rubric.")
    feedback: str = Field(description="Detailed rationale and feedback justifying the score.")

class ImprovementRecommendationSchema(BaseModel):
    recommendation: str = Field(description="The concrete change to the agent's prompt or rules to address the feedback.")

class SourceSchema(BaseModel):
    title: str = Field(description="Title of the source or document")
    url: str = Field(default="", description="URL of the source if applicable")
    publisher: str = Field(default="", description="Publisher or author of the source")
    source_type: str = Field(default="web", description="Type of source e.g. web, internal, report")

class AgentExecutionOutputSchema(BaseModel):
    markdown_content: str = Field(description="The full rendered output document in Markdown format. This must be the primary readable content.")
    sources: List[SourceSchema] = Field(description="A list of all sources cited or reviewed during this execution.", default_factory=list)

class AgentDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = AgentDefinitionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AgentDefinition.objects.filter(topic__owner=self.request.user)

    @action(detail=True, methods=['post'])
    def build_webpage(self, request, pk=None):
        agent = self.get_object()
        serializer = WebpageBuilderRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        artifact = WebpageArtifact.objects.create(
            agent=agent,
            topic=agent.topic,
            html_content=serializer.validated_data['html_content'],
            css_content=serializer.validated_data.get('css_content', ''),
            js_content=serializer.validated_data.get('js_content', '')
        )
        return Response(WebpageArtifactSerializer(artifact).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        try:
            agent = self.get_object()
            
            # 1. Compose the Agent's Generation Prompt
            prompt_traces = []
            prompt_parts = []
            
            # Add assigned prompt templates
            assignments = AgentPromptAssignment.objects.filter(agent=agent, enabled=True).order_by('sort_order')
            for assignment in assignments:
                prompt_parts.append(f"--- {assignment.prompt_template.name} ---\n{assignment.prompt_template.prompt_body}")
                prompt_traces.append({
                    "template_name": assignment.prompt_template.name,
                    "version": assignment.prompt_template.version,
                    "snapshot": assignment.prompt_template.prompt_body
                })
                
            # Add base system prompt
            prompt_parts.append(f"--- System Instructions ---\n{agent.system_prompt}")
            prompt_traces.append({
                "template_name": "System Instructions",
                "version": 1,
                "snapshot": agent.system_prompt
            })
            
            full_prompt = "\n\n".join(prompt_parts)
            
            # Ensure a ChainExecutionVersion exists for this topic
            execution_version, _ = ChainExecutionVersion.objects.get_or_create(
                topic=agent.topic,
                version_number=1,
                defaults={"status": "draft", "started_by": request.user}
            )
            
            # Look for previous artifact to pass state
            previous_artifact = AgentArtifact.objects.filter(
                agent_trace__agent=agent,
                execution_version=execution_version
            ).order_by('-created_at').first()

            # Add user specific task instruction
            task_query = agent.instructions or "Execute your assigned role."
            final_prompt = f"{full_prompt}\n\nUser Task: {task_query}"
            
            prompt_traces.append({
                "template_name": "User Objective",
                "version": 1,
                "snapshot": task_query,
                "content": task_query
            })
            
            # Inject previous state if it exists
            if previous_artifact and previous_artifact.content:
                final_prompt += f"\n\n--- PREVIOUS OUTPUT VERSION (STARTING POINT) ---\n{previous_artifact.content}\n\n"
                final_prompt += "CRITICAL REQUIREMENT: You MUST review your previous output above. You MUST perform fresh searches to validate all sources. Ensure the final document is updated with the latest information. Do NOT blindly copy outdated facts. Output the updated document."
                
                # Agentic Self-Correction: Inject previous low scores
                if previous_artifact.agent_trace and previous_artifact.agent_trace.validation_result:
                    prev_evals = previous_artifact.agent_trace.validation_result
                    low_scores = [e for e in prev_evals if e.get("score", 0) < 7]
                    if low_scores:
                        final_prompt += "\n\n--- FEEDBACK FROM PREVIOUS RUN ---\nYour previous attempt received low scores on the following evaluations. You MUST address these explicitly in your new attempt:\n"
                        for ls in low_scores:
                            final_prompt += f"- {ls['evaluator']} (Score: {ls['score']}/10): {ls['feedback']}\n"
                        final_prompt += "\nFailure to fix these specific issues will result in failure."
            
            # 1.4 Manual Knowledge Base Retrieval
            from strategy.models import ManualSource
            manual_sources = ManualSource.objects.filter(agent=agent)
            if manual_sources.exists():
                final_prompt += "\n\n--- MANUAL KNOWLEDGE BASE ---\n"
                final_prompt += "The following are manually provided documents and sources. You MUST prioritize citing these specific documents in your final output, using their exact titles and URLs.\n\n"
                for ms in manual_sources:
                    final_prompt += f"Title: {ms.title}\n"
                    if ms.url:
                        final_prompt += f"URL: {ms.url}\n"
                    final_prompt += f"Content: {ms.content}\n\n"
            
            
            # 1.5 Real-Time Web Search Context Retrieval
            needs_search = any(kw in agent.name.lower() for kw in ["search", "research"]) or any(kw in task_query.lower() for kw in ["search", "research", "sources"])
            
            search_context = ""
            all_results = []
            if needs_search:
                from strategy.models import PromptTemplate
                
                # 1. Query Generator Prompt
                query_gen_default = "Based on the following task and instructions, generate 15 highly specific web search queries to find the required information. The queries MUST focus on future predictions, upcoming trends (2026-2030+), and forward-looking strategic insights rather than historical data.\n\nTask: {task_query}\n"
                query_template, _ = PromptTemplate.objects.get_or_create(
                    name="System: Search Query Generator",
                    defaults={
                        "category": "research",
                        "prompt_body": query_gen_default,
                        "is_system_prompt": True,
                        "description": "Used internally to generate 15 search queries based on the user's task."
                    }
                )
                
                try:
                    query_prompt = query_template.prompt_body.format(task_query=task_query)
                except KeyError:
                    # Fallback if user broke the format variables
                    query_prompt = query_template.prompt_body + f"\n\nTask: {task_query}"
                if previous_artifact and previous_artifact.agent_trace and previous_artifact.agent_trace.validation_result:
                    low_scores = [e for e in previous_artifact.agent_trace.validation_result if e.get("score", 0) < 7]
                    if low_scores:
                        query_prompt += "\nNote: The previous run received low scores. You MUST generate broader and more varied queries targeting future technology roadmaps, predictive analysis, and emergent trends to ensure at least 120 unique sources can be found. Output exactly 15 queries.\n"
                    
                llm = LLMClient()
                query_res = llm.execute(prompt=query_prompt, prompt_version="1.0", schema_class=SearchQuerySchema, model="gpt-4o")
                
                gen_data = query_res.data
                if isinstance(gen_data, dict):
                    queries = gen_data.get("queries", [])
                else:
                    queries = gen_data.queries
                    
                from strategy.utils.web_search import get_search_adapter
                from strategy.utils.source_classifier import SourceRelevanceClassifier, SnippetExtractor
                from strategy.models import ResearchSearchQuery, SourceRecord, TrendEvidenceRecord
                
                search_adapter = get_search_adapter()
                classifier = SourceRelevanceClassifier(objective_text=task_query)
                extractor = SnippetExtractor()
                
                accepted_sources = []
                rejected_sources = []
                trend_evidence_data = []
                seen_urls = set()
                
                # We need to save the run trace FIRST to attach TrendEvidenceRecords to it,
                # or we can attach it later. Actually we don't have the trace yet. We will create the trace later,
                # but we can store the DB records later as well, or just return them in the payload.
                # Actually we can just create the SourceRecords right away, wait, SourceRecord needs an agent_trace.
                # It's nullable for trace? Yes, agent_trace=models.ForeignKey(null=True).
                # But it's better to create them after the trace is created.
                
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Executing real search for queries: {queries}")
                
                for q in queries:
                    # 1. Store the query
                    ResearchSearchQuery.objects.create(topic=agent.topic, agent=agent, query=q)
                    
                    try:
                        results = search_adapter.search(query=q)
                        
                        # Deduplicate simple URLs
                        new_results = []
                        for r in results:
                            url = r.get("url", "")
                            if url and url not in seen_urls:
                                seen_urls.add(url)
                                new_results.append(r)
                                
                        if new_results:
                            acc, rej = classifier.filter_sources(new_results)
                            rejected_sources.extend(rej)
                            accepted_sources.extend(acc)
                            
                            for src in acc:
                                trends = extractor.extract_trends(source=src, objective_text=task_query)
                                src["extracted_trends"] = [t.model_dump() if hasattr(t, "model_dump") else t.dict() for t in trends]
                                trend_evidence_data.extend(src["extracted_trends"])
                    except Exception as e:
                        logger.error(f"Real Search Error: {str(e)}")
                        
                # We do NOT run an LLM to hallucinate the document.
                # Instead, we programmatically construct a Markdown Evidence Catalogue.
                md_lines = [f"# Research Evidence Catalogue\n"]
                md_lines.append(f"## Queries Executed\n" + "\n".join([f"- {q}" for q in queries]) + "\n")
                
                md_lines.append("## Validated Sources & Trend Evidence")
                if not accepted_sources:
                    md_lines.append("No highly relevant sources passed the rigorous classification filters.\n")
                
                for idx, src in enumerate(accepted_sources, 1):
                    md_lines.append(f"### {idx}. {src.get('title', 'Unknown Title')}")
                    if src.get('url'):
                        md_lines.append(f"**URL:** [{src.get('publisher', 'Link')}]({src.get('url')})")
                    md_lines.append(f"**Summary Snippet:** {src.get('snippet', '')}")
                    
                    trends = src.get("extracted_trends", [])
                    if trends:
                        md_lines.append("**Extracted Trends & Signals:**")
                        for t in trends:
                            md_lines.append(f"- **Signal:** {t.get('trend_signal', '')} (Confidence: {t.get('confidence_score', '')})")
                            md_lines.append(f"  - *Future Relevance:* {t.get('future_relevance', '')}")
                            md_lines.append(f"  - *Impact Area:* {t.get('impact_area', '')}")
                    md_lines.append("\n---\n")

                if rejected_sources:
                    md_lines.append("## Rejected Sources")
                    md_lines.append(f"Rejected {len(rejected_sources)} sources due to irrelevance, hallucination risk, or SEO spam.")
                    for idx, src in enumerate(rejected_sources[:5], 1):
                        md_lines.append(f"- **{src.get('title', 'Unknown')}**: {src.get('rejection_reason', 'Irrelevant')}")
                    if len(rejected_sources) > 5:
                        md_lines.append(f"- *(And {len(rejected_sources) - 5} more...)*")

                final_markdown = "\n".join(md_lines)
                
                output_payload_dict = {
                    "research_objective": task_query,
                    "queries_run": queries,
                    "sources_collected": accepted_sources,
                    "trend_evidence_records": trend_evidence_data,
                    "rejected_sources": rejected_sources,
                    "coverage_gaps": [],
                    "next_search_queries": [],
                    "markdown_content": final_markdown,
                    "sources": accepted_sources
                }
            else:
                # If needs_search is False, just do a normal LLM execution
                llm = LLMClient()
                res = llm.execute(prompt=final_prompt, prompt_version="1.0", schema_class=AgentExecutionOutputSchema, model="gpt-4o")
                output_payload_dict = res.data.dict() if hasattr(res.data, 'dict') else res.data
                if "sources" not in output_payload_dict:
                    output_payload_dict["sources"] = []
                accepted_sources = output_payload_dict["sources"]

            # Save AgentRunTrace
            run_trace = AgentRunTrace.objects.create(
                agent=agent,
                execution_version=execution_version,
                run_order=1,
                status="completed",
                input_payload={"query": task_query},
                output_payload=output_payload_dict,
                prompt_snapshot=final_prompt,
                telemetry=query_res.telemetry if 'query_res' in locals() else {"execution_time_ms": 0}
            )
            
            # Attach active experiments
            from strategy.models import AgentImprovementExperiment
            active_experiments = AgentImprovementExperiment.objects.filter(agent=agent, status="monitoring")
            if active_experiments.exists():
                run_trace.active_experiments.set(active_experiments)
                
            # Save AgentArtifact
            artifact = AgentArtifact.objects.create(
                execution_version=execution_version,
                agent_trace=run_trace,
                artifact_type="markdown",
                title=f"{agent.name} Output",
                content=output_payload_dict["markdown_content"],
                payload=output_payload_dict
            )
            
            # Save Sources and Trend Evidence Records
            from strategy.models import SourceRecord, TrendEvidenceRecord
            for src in accepted_sources:
                db_source = SourceRecord.objects.create(
                    topic=agent.topic,
                    agent_trace=run_trace,
                    title=src.get("title", "Unknown"),
                    url=src.get("url", ""),
                    publisher=src.get("publisher", ""),
                    source_type=src.get("source_type", "web"),
                    content_summary=src.get("snippet", "")
                )
                
                # Save the attached trend evidence records
                trends = src.get("extracted_trends", [])
                for t in trends:
                    TrendEvidenceRecord.objects.create(
                        topic=agent.topic,
                        agent_trace=run_trace,
                        source=db_source,
                        snippet=t.get("snippet", ""),
                        trend_signal=t.get("trend_signal", ""),
                        future_relevance=t.get("future_relevance", ""),
                        impact_area=t.get("impact_area", ""),
                        confidence_score=t.get("confidence_score", 0.7)
                    )
                
            # 3. Execute Evaluators against the Generation Result
            from strategy.evaluation_engine import run_post_agent_evaluation
            evaluations = run_post_agent_evaluation(run_trace)
            
            # 4. Construct Output Trace
            trace = {
                "id": run_trace.id,
                "agent_id": agent.id,
                "agent_name": agent.name,
                "run_order": run_trace.run_order,
                "status": run_trace.status,
                "input_payload": run_trace.input_payload,
                "mapped_input_payload": run_trace.mapped_input_payload,
                "output_payload": run_trace.output_payload,
                "validation_result": evaluations,
                "prompt_snapshot": run_trace.prompt_snapshot,
                "prompt_traces": prompt_traces,
                "evaluations": [
                    {
                        "evaluator": ev.get("evaluator"),
                        "score": ev.get("score"),
                        "feedback": ev.get("feedback"),
                        "passed": ev.get("passed")
                    } for ev in evaluations
                ],
                "started_at": run_trace.started_at,
                "completed_at": run_trace.completed_at,
                "execution_time_ms": query_res.telemetry["execution_time_ms"] if 'query_res' in locals() else 0
            }
        
            return Response({
                "status": "completed", 
                "trace": trace
            })
        except Exception as e:
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Agent Run Error: {str(e)}\n{traceback.format_exc()}")
            return Response({"error": str(e)}, status=500)
    @action(detail=True, methods=['post'], url_path='visual_webpage_builder')
    def visual_webpage_builder(self, request, pk=None):
        """Generate a visual webpage artifact from structured inputs."""
        agent = self.get_object()
        serializer = WebpageBuilderRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Ensure an execution version exists
        execution_version, _ = ChainExecutionVersion.objects.get_or_create(
            topic=agent.topic,
            version_number=1,
            defaults={"status": "draft", "started_by": request.user}
        )
        # Create a minimal run trace
        run_trace = AgentRunTrace.objects.create(
            agent=agent,
            execution_version=execution_version,
            run_order=1,
            status="completed",
            input_payload=data,
            output_payload={},
            prompt_snapshot="",
        )
        # Placeholder HTML generation
        title = data.get('title', 'Generated Dashboard')
        code = f"<html><head><title>{title}</title></head><body><h1>{title}</h1></body></html>"
        # Determine source data references present in the payload
        source_refs = [key for key in WebpageArtifact.ALLOWED_INPUTS if data.get(key)]
        # Create the webpage artifact
        artifact = WebpageArtifact.objects.create(
            topic=agent.topic,
            execution_version=execution_version,
            agent_trace=run_trace,
            title=title,
            framework="html",
            component_name="",
            source_data_refs=source_refs,
            code=code,
            rendered_preview_url="",
        )
        return Response(WebpageArtifactSerializer(artifact).data, status=status.HTTP_201_CREATED)


class AgentEdgeViewSet(viewsets.ModelViewSet):
    serializer_class = AgentEdgeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AgentEdge.objects.filter(topic__owner=self.request.user)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_topic_agent(request, topic_id):
    topic = get_object_or_404(Topic, id=topic_id, owner=request.user)
    serializer = AgentDefinitionSerializer(data=request.data)
    if serializer.is_valid():
        agent = serializer.save(topic=topic)
        
        # Auto-assign all active EvaluationTemplates so metrics work out-of-the-box
        from strategy.models import EvaluationTemplate, EvaluationAssignment
        eval_templates = EvaluationTemplate.objects.all()
        for idx, template in enumerate(eval_templates):
            EvaluationAssignment.objects.create(
                agent=agent,
                evaluation_template=template,
                sort_order=idx + 1,
                enabled=True
            )
            
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_topic_edge(request, topic_id):
    topic = get_object_or_404(Topic, id=topic_id, owner=request.user)
    serializer = AgentEdgeSerializer(data=request.data)
    if serializer.is_valid():
        # Validate that agents belong to topic
        source = serializer.validated_data.get("source_agent")
        target = serializer.validated_data.get("target_agent")
        if source.topic != topic or target.topic != topic:
            return Response({"error": "Agents must belong to this topic"}, status=status.HTTP_400_BAD_REQUEST)
            
        serializer.save(topic=topic)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_agent_graph(request, topic_id):
    topic = get_object_or_404(Topic, id=topic_id, owner=request.user)
    agents = AgentDefinition.objects.filter(topic=topic)
    edges = AgentEdge.objects.filter(topic=topic)
    
    agent_data = AgentDefinitionSerializer(agents, many=True).data
    edge_data = AgentEdgeSerializer(edges, many=True).data
    
    return Response({
        "nodes": agent_data,
        "edges": edge_data
    })
