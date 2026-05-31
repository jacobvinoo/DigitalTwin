import React from 'react';

export function ProductAgentOutputView({ data }: { data: any }) {
  if (!data) return <div className="text-sm text-slate-500 italic">No agent output generated yet</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Product Problem</h5>
          <p className="text-sm text-slate-800">{data.product_problem}</p>
        </div>
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Target Users</h5>
          <p className="text-sm text-slate-800">{data.target_users}</p>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-md">
        <h5 className="text-xs font-bold uppercase text-blue-600 mb-2">Recommendation</h5>
        <p className="text-sm text-blue-900 font-medium">{data.product_recommendation}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Success Metrics</h5>
          <ul className="list-disc list-inside text-sm text-slate-800">
            {data.success_metrics?.map((m: string, i: number) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Risks</h5>
          <ul className="list-disc list-inside text-sm text-slate-800">
            {data.risks?.map((m: string, i: number) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Assumptions</h5>
          <ul className="list-disc list-inside text-sm text-slate-800">
            {data.assumptions?.map((m: string, i: number) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      </div>
      <div className="bg-slate-50 border p-3 rounded-md">
        <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Next Actions</h5>
        <ul className="list-disc list-inside text-sm text-slate-800">
          {data.next_actions?.map((m: string, i: number) => <li key={i}>{m}</li>)}
        </ul>
      </div>
    </div>
  );
}

export function StrategyAgentOutputView({ data }: { data: any }) {
  if (!data) return <div className="text-sm text-slate-500 italic">No agent output generated yet</div>;

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-100 p-4 rounded-md">
        <h5 className="text-xs font-bold uppercase text-purple-600 mb-2">Strategic Question</h5>
        <p className="text-sm text-purple-900 font-medium">{data.strategic_question}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Market Context</h5>
          <p className="text-sm text-slate-800">{data.market_context}</p>
        </div>
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Competitor Insights</h5>
          <p className="text-sm text-slate-800">{data.competitor_insights}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Strategic Options</h5>
          <ul className="list-disc list-inside text-sm text-slate-800">
            {data.strategic_options?.map((m: string, i: number) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-blue-600 mb-1">Recommended Position</h5>
          <p className="text-sm text-blue-900 font-medium">{data.recommended_position}</p>
        </div>
      </div>
      <div className="bg-slate-50 border p-3 rounded-md">
        <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Decision Needed</h5>
        <p className="text-sm text-slate-800">{data.decision_needed}</p>
      </div>
    </div>
  );
}

export function AgentOutputPanel({ task }: { task: any }) {
  const data = task.outputs?.agent_output;
  if (!data) return <div className="text-sm text-slate-500 italic p-3 border bg-white rounded-md mb-6 mt-2">No agent output generated yet</div>;

  const isProduct = ["metrics_definition", "implementation_plan", "roadmap", "execution_tracking"].includes(task.task_type);

  return (
    <div className="bg-white border p-4 rounded-md shadow-sm mb-6 mt-2">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h4 className="text-sm font-bold uppercase text-slate-600 tracking-wider">Agent Structured Output</h4>
        <div className="flex space-x-2">
            {data.confidence_score && (
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">Confidence: {data.confidence_score}</span>
            )}
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">✓ Generated from approved workflow</span>
        </div>
      </div>
      {isProduct ? <ProductAgentOutputView data={data} /> : <StrategyAgentOutputView data={data} />}
      
      {data.evidence_refs && data.evidence_refs.length > 0 && (
          <div className="mt-4 pt-4 border-t">
              <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Evidence References</h5>
              <ul className="list-disc list-inside text-xs text-slate-600">
                  {data.evidence_refs.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
          </div>
      )}
    </div>
  );
}

export function ExecutiveReviewPanel({ review }: { review: any }) {
  if (!review) return <div className="text-sm text-slate-500 italic p-3 border bg-white rounded-md mb-6 mt-2">Not yet reviewed by executive</div>;

  return (
    <div className="bg-white border p-4 rounded-md shadow-sm space-y-4 mb-6 mt-2">
      <div className="flex justify-between items-center border-b pb-2">
        <h4 className="text-sm font-bold uppercase text-slate-600 tracking-wider">Executive Review</h4>
        {review.recommendation === "revise" ? (
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-medium border border-amber-200">Needs revision</span>
        ) : (
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium border border-green-200">Approved</span>
        )}
      </div>
      
      <div className="bg-slate-50 p-3 rounded border">
          <p className="text-sm text-slate-800 font-medium">{review.overall_assessment}</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50/50 p-3 rounded border border-green-100">
              <h5 className="text-xs font-bold uppercase text-green-600 mb-1">Strongest Points</h5>
              <ul className="list-disc list-inside text-sm text-green-900">
                  {review.strongest_points?.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
          </div>
          <div className="bg-amber-50/50 p-3 rounded border border-amber-100">
              <h5 className="text-xs font-bold uppercase text-amber-600 mb-1">Weakest Points</h5>
              <ul className="list-disc list-inside text-sm text-amber-900">
                  {review.weakest_points?.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
          </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-3 rounded border">
              <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Missing Evidence</h5>
              <ul className="list-disc list-inside text-sm text-slate-800">
                  {review.missing_evidence?.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
          </div>
          <div className="bg-slate-50 p-3 rounded border">
              <h5 className="text-xs font-bold uppercase text-slate-400 mb-1">Challenge Questions</h5>
              <ul className="list-disc list-inside text-sm text-slate-800">
                  {review.challenge_questions?.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
          </div>
      </div>
    </div>
  );
}

export function EvaluationScorePanel({ evaluation }: { evaluation: any }) {
    const data = evaluation?.agent_evaluation;
    if (!data) return <div className="text-sm text-slate-500 italic p-3 border bg-white rounded-md mb-6 mt-2">Not evaluated</div>;

    return (
        <div className="bg-white border p-4 rounded-md shadow-sm mb-6 mt-2">
            <h4 className="text-sm font-bold uppercase text-slate-600 tracking-wider mb-4 border-b pb-2">Evaluation Scores</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Relevance:</div>
                    <div className="font-semibold">{data.relevance} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Quality:</div>
                    <div className="font-semibold">{data.quality} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Evidence Strength:</div>
                    <div className="font-semibold">{data.evidence_strength} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Actionability:</div>
                    <div className="font-semibold">{data.actionability} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Exec Readiness:</div>
                    <div className="font-semibold">{data.executive_readiness} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Style Alignment:</div>
                    <div className="font-semibold">{data.style_alignment} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Local Context:</div>
                    <div className="font-semibold">{data.local_context} / 10</div>
                </div>
                <div className="p-2 border rounded bg-slate-50">
                    <div className="text-xs text-slate-500">Novelty:</div>
                    <div className="font-semibold">{data.novelty} / 10</div>
                </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded flex justify-between items-center">
                <span className="font-medium text-blue-900">Overall Score: {data.overall_score}</span>
            </div>
        </div>
    );
}

export function AgentTelemetryPanel({ telemetry }: { telemetry: any }) {
    const runs = telemetry?.agent_runs || [];
    if (runs.length === 0) return <div className="text-sm text-slate-500 italic p-3 border bg-white rounded-md mt-2">No agent runs recorded</div>;

    const latest = runs[runs.length - 1];

    return (
        <div className="bg-white border p-4 rounded-md shadow-sm mt-4">
            <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Agent Telemetry</h5>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">Model</span>
                    <span className="text-slate-800 text-sm mt-1 block font-mono bg-slate-50 p-1 rounded border">{latest.model}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">Prompt Version</span>
                    <span className="text-slate-800 text-sm mt-1 block font-mono bg-slate-50 p-1 rounded border">{latest.prompt_version}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">Tokens</span>
                    <span className="text-slate-800 text-sm mt-1 block font-mono bg-slate-50 p-1 rounded border">{latest.total_tokens} tokens</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">Cost</span>
                    <span className="text-slate-800 text-sm mt-1 block font-mono bg-slate-50 p-1 rounded border">${latest.api_cost_usd}</span>
                </div>
                <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">Duration</span>
                    <span className="text-slate-800 text-sm mt-1 block font-mono bg-slate-50 p-1 rounded border">{latest.execution_time_ms}ms</span>
                </div>
            </div>
            {runs.length > 1 && (
                <div className="mt-3 text-xs text-slate-500">
                    {runs.length} total agent executions recorded for this task.
                </div>
            )}
        </div>
    );
}
