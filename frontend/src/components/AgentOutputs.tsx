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

export function HousekeepingAgentOutputView({ data }: { data: any }) {
  if (!data) return <div className="text-sm text-slate-500 italic">No agent output generated yet</div>;

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <div className="flex items-start space-x-3 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg shadow-xs">
            <span className="text-emerald-600 text-lg shrink-0">✓</span>
            <div className="space-y-1">
              <h5 className="font-bold text-xs uppercase tracking-wide text-emerald-800">System Healthy</h5>
              <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                All strategy documents are verified and correct. No placeholders or duplicate issues found.
              </p>
            </div>
          </div>
        );
      case 'warnings_found':
        return (
          <div className="flex items-start space-x-3 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg shadow-xs">
            <span className="text-amber-600 text-lg shrink-0">⚠️</span>
            <div className="space-y-1">
              <h5 className="font-bold text-xs uppercase tracking-wide text-amber-800">Warnings Found</h5>
              <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                Some documents have minor issues or warnings that should be addressed, but no blocking errors.
              </p>
            </div>
          </div>
        );
      case 'errors_found':
        return (
          <div className="flex items-start space-x-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg shadow-xs animate-pulse">
            <span className="text-rose-600 text-lg shrink-0">🛑</span>
            <div className="space-y-1">
              <h5 className="font-bold text-xs uppercase tracking-wide text-rose-800">Errors Found</h5>
              <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                Critical errors found in the strategy documents (e.g. placeholder content, missing sections). Action required.
              </p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-start space-x-3 p-3.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-lg shadow-xs">
            <span className="text-slate-650 text-lg shrink-0">ℹ️</span>
            <div className="space-y-1">
              <h5 className="font-bold text-xs uppercase tracking-wide text-slate-800">Health Status: {status}</h5>
            </div>
          </div>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Valid
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Warning
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Health Banner */}
      {getHealthBadge(data.system_health_status)}

      {/* 2. Task Summary */}
      <div className="bg-slate-50 border p-4 rounded-md">
        <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Review Summary</h5>
        <p className="text-sm text-slate-800 leading-relaxed">{data.summary}</p>
      </div>

      {/* 3. Verified Documents Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h5 className="text-xs font-bold uppercase text-slate-600">Verified Documents</h5>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Document</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Issues / Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {data.verified_documents?.map((doc: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs font-bold text-slate-800">{doc.title}</div>
                    <div className="text-[10px] font-mono text-slate-500">{doc.filename}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      doc.doc_type === 'generated' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}>
                      {doc.doc_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(doc.status)}
                  </td>
                  <td className="px-4 py-3">
                    {doc.issues && doc.issues.length > 0 ? (
                      <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                        {doc.issues.map((issue: string, i: number) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-medium">✓ No issues</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Next Actions */}
      {data.next_actions && data.next_actions.length > 0 && (
        <div className="bg-slate-50 border p-3 rounded-md">
          <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Recommended Next Actions</h5>
          <ul className="list-disc list-inside text-sm text-slate-800 space-y-1">
            {data.next_actions.map((act: string, i: number) => <li key={i}>{act}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function SimpleMarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;
  
  const lines = content.split('\n');
  return (
    <div className="space-y-3 font-sans text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx} className="text-xl font-bold text-slate-900 border-b pb-2 mt-4 mb-3">{trimmed.substring(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx} className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-1 mt-4 mb-2">{trimmed.substring(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx} className="text-sm font-semibold text-slate-800 mt-3 mb-1.5">{trimmed.substring(4)}</h3>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-4 py-0.5">
              <span className="text-slate-400 mt-1.5 shrink-0 block w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-sm text-slate-700 leading-relaxed">{trimmed.substring(2)}</span>
            </div>
          );
        }
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }
        return <p key={idx} className="text-sm text-slate-700 leading-relaxed mb-1.5">{trimmed}</p>;
      })}
    </div>
  );
}

export function AgentOutputPanel({ task, onViewDocument }: { task: any, onViewDocument?: (docName: string) => void }) {
  const data = task.outputs?.agent_output;
  if (!data) return <div className="text-sm text-slate-500 italic p-3 border bg-white rounded-md mb-6 mt-2">No agent output generated yet</div>;

  const isProduct = ["metrics_definition", "implementation_plan", "roadmap", "execution_tracking"].includes(task.task_type);
  const documentContent = task.outputs?.generated_document_markdown;

  // Next steps based on status
  let nextStepBanner = null;
  const isRevisionRequired = task.status === "blocked" && task.governance?.revision_required;
  if (task.status === "blocked" && isRevisionRequired) {
    nextStepBanner = (
      <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex items-start space-x-3 shadow-xs">
        <span className="text-base">⚠️</span>
        <div className="space-y-1">
          <h5 className="font-bold text-xs uppercase tracking-wide text-amber-800">Next Step: Review Revisions & Steering</h5>
          <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
            The Executive Reviewer has requested revisions for this document. To proceed:
          </p>
          <ol className="list-decimal list-inside text-[11px] text-slate-700 space-y-0.5 mt-1 font-semibold">
            <li>Accept the revision request under Task Operations.</li>
            <li>Review the requested corrections in the yellow sticky notes alongside the document preview below.</li>
            <li>Go to the <strong>Feedback & Steering Guidance</strong> section, enter your guidance/revisions, and click <strong>Rerun Agent & Apply Feedback</strong>.</li>
          </ol>
        </div>
      </div>
    );
  } else if (task.status === "completed") {
    nextStepBanner = (
      <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex items-start space-x-3 shadow-xs">
        <span className="text-base">✓</span>
        <div className="space-y-1">
          <h5 className="font-bold text-xs uppercase tracking-wide text-emerald-800">Task Completed & Approved</h5>
          <p className="text-[11px] text-emerald-700 leading-relaxed">
            The strategy document has been generated and approved. You can view the document below or open it in your editor:
          </p>
          <div className="mt-2 flex items-center space-x-3">
            <span className="text-[10px] font-mono bg-white border border-emerald-100 px-2 py-0.5 rounded text-slate-600 break-all">{task.outputs?.generated_document_path || 'In Workspace'}</span>
            {task.outputs?.generated_document_path && (
              <button
                onClick={() => navigator.clipboard.writeText(task.outputs.generated_document_path)}
                className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded transition whitespace-nowrap shadow-2xs cursor-pointer"
                title="Copy file path to clipboard"
              >
                Copy Path
              </button>
            )}
          </div>
        </div>
      </div>
    );
  } else if (task.status === "in_progress") {
    nextStepBanner = (
      <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg flex items-start space-x-3 shadow-xs animate-pulse">
        <span className="text-base">⏳</span>
        <div className="space-y-1">
          <h5 className="font-bold text-xs uppercase tracking-wide text-blue-800">Rerun in Progress</h5>
          <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
            The Agent is currently processing your steering feedback and revising the strategy document. The page will update automatically when complete.
          </p>
        </div>
      </div>
    );
  } else if (task.status === "proposed") {
    nextStepBanner = (
      <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-lg flex items-start space-x-3 shadow-xs">
        <span className="text-base">➜</span>
        <div className="space-y-1">
          <h5 className="font-bold text-xs uppercase tracking-wide text-slate-800">Next Step: Run Task</h5>
          <p className="text-[11px] text-slate-700 leading-relaxed">
            This task has not been executed yet. Approve the daily plan or use the workflow tools to run this agent.
          </p>
        </div>
      </div>
    );
  }

  // IF there is a generated document, show a link to the document
  if (documentContent && task.task_type !== 'housekeeping') {
    return (
      <div className="space-y-4 mb-6 mt-2">
        {/* 1. Next Step Banner */}
        {nextStepBanner}

        {/* 2. Unified Document link card */}
        <div className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-xs border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-xs">Strategy Document</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{task.outputs?.generated_document_name || `${task.title}.md`}</p>
            </div>
          </div>
          {onViewDocument && (
            <button
              onClick={() => onViewDocument(task.outputs?.generated_document_name)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              View Document
            </button>
          )}
        </div>
      </div>
    );
  }

  // IF there is NO generated document (fallback/legacy/test), show the traditional Structured Output card directly
  return (
    <div className="space-y-4 mb-6 mt-2">
      {nextStepBanner}

      {task.task_type === 'housekeeping' && documentContent && (
        <div className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-xs border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-xs">Housekeeping Report</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{task.outputs?.generated_document_name || `${task.title}.md`}</p>
            </div>
          </div>
          {onViewDocument && (
            <button
              onClick={() => onViewDocument(task.outputs?.generated_document_name)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-850 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              View Report Document
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 p-4 rounded-md shadow-sm">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h4 className="text-sm font-bold uppercase text-slate-600 tracking-wider">Agent Structured Output</h4>
          <div className="flex space-x-2">
              {data.confidence_score && (
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">Confidence: {data.confidence_score}</span>
              )}
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">✓ Generated from approved workflow</span>
          </div>
        </div>
        
        {task.task_type === 'housekeeping' ? (
          <HousekeepingAgentOutputView data={data} />
        ) : isProduct ? (
          <ProductAgentOutputView data={data} />
        ) : (
          <StrategyAgentOutputView data={data} />
        )}
        
        {data.evidence_refs && data.evidence_refs.length > 0 && (
            <div className="mt-4 pt-4 border-t">
                <h5 className="text-xs font-bold uppercase text-slate-400 mb-2">Evidence References</h5>
                <ul className="list-disc list-inside text-xs text-slate-600">
                    {data.evidence_refs.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
            </div>
        )}
      </div>
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

      {review.recommendation === "revise" && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-md text-xs leading-relaxed space-y-1.5 shadow-sm">
          <span className="font-bold flex items-center text-blue-800">
            <span className="mr-1.5">💡</span> Actionable Next Steps to Resolve Revision
          </span>
          <p>
            Please check the <strong>Weakest Points</strong>, <strong>Missing Evidence</strong>, and <strong>Challenge Questions</strong> below. 
            Copy specific answers, data, or adjustments into the <strong>Feedback & Steering Guidance</strong> form at the bottom of this drawer, 
            and click <strong>Rerun Agent & Apply Feedback</strong> under Task Operations to update the strategy document.
          </p>
        </div>
      )}
      
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

    return (
        <div className="bg-white border p-4 rounded-md shadow-sm mt-4 space-y-4">
            <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Agent Telemetry</h5>
            
            <div className="space-y-4 divide-y divide-slate-100">
                {runs.map((run: any, idx: number) => (
                    <div key={idx} className={`${idx > 0 ? 'pt-4' : ''} space-y-3`}>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                {run.node_name || `Execution #${idx + 1}`}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            <div>
                                <span className="text-slate-400 block">Model:</span>
                                <span className="font-mono text-slate-700">{run.model}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Prompt Ver:</span>
                                <span className="font-mono text-slate-700">{run.prompt_version}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Tokens:</span>
                                <span className="font-mono text-slate-700">{run.total_tokens} tokens</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Cost:</span>
                                <span className="font-mono text-slate-700">${run.api_cost_usd}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block">Duration:</span>
                                <span className="font-mono text-slate-700">{run.execution_time_ms}ms</span>
                            </div>
                        </div>

                        {run.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-900 font-medium">
                                <span className="font-bold">Error:</span> {run.error}
                            </div>
                        )}
                        
                        {run.validation_errors && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                                <div className="font-bold">Validation Errors:</div>
                                {Array.isArray(run.validation_errors) ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                        {run.validation_errors.map((err: any, i: number) => (
                                            <li key={i}>
                                                <span className="font-semibold">{err.loc ? err.loc.join('.') : 'field'}:</span> {err.msg || JSON.stringify(err)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <pre className="whitespace-pre-wrap font-mono text-[10px] text-amber-800">
                                        {typeof run.validation_errors === 'string' ? run.validation_errors : JSON.stringify(run.validation_errors, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}

                        {run.prompt && (
                            <details className="text-xs bg-slate-50 rounded border border-slate-100 p-2">
                                <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800 focus:outline-none select-none">
                                    View LLM Request (Prompt)
                                </summary>
                                <pre className="mt-2 p-2 bg-white rounded border border-slate-100 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] text-slate-700 max-h-48 overflow-y-auto">
                                    {run.prompt}
                                </pre>
                            </details>
                        )}

                        {run.response && (
                            <details className="text-xs bg-slate-50 rounded border border-slate-100 p-2">
                                <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800 focus:outline-none select-none">
                                    View LLM Response
                                </summary>
                                <pre className="mt-2 p-2 bg-white rounded border border-slate-100 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] text-slate-700 max-h-48 overflow-y-auto">
                                    {typeof run.response === 'string' ? run.response : JSON.stringify(run.response, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
