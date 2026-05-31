import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicCommandCentre from './TopicCommandCentre';

describe('TaskDrawer Agent Outputs', () => {
  beforeEach(() => {
    localStorage.setItem('tasks', JSON.stringify([
      { 
        id: 101, 
        title: "Product Task", 
        workstream: "Testing", 
        risk: "low", 
        status: "completed", 
        approval: "not required",
        task_type: "implementation_plan",
        outputs: {
            agent_output: {
                product_problem: "High latency",
                target_users: "Power users",
                product_recommendation: "Use Redis",
                success_metrics: ["Latency < 50ms"],
                risks: ["Cost"],
                assumptions: ["Network is reliable"],
                next_actions: ["Deploy cache"]
            },
            executive_review: {
                overall_assessment: "Solid plan",
                strongest_points: ["Clear metrics"],
                weakest_points: ["No fallback"],
                missing_evidence: ["Usage stats"],
                challenge_questions: ["What if Redis fails?"],
                recommendation: "approve"
            }
        },
        evaluation: {
            agent_evaluation: {
                relevance: 9,
                quality: 8,
                evidence_strength: 7,
                actionability: 9,
                executive_readiness: 8,
                style_alignment: 9,
                local_context: 8,
                novelty: 7,
                overall_score: 8.1
            }
        },
        telemetry: {
            agent_runs: [
                {
                    model: "gpt-4o",
                    prompt_version: "v1.2",
                    total_tokens: 1500,
                    api_cost_usd: 0.015,
                    execution_time_ms: 2500
                }
            ]
        }
      },
      { 
        id: 102, 
        title: "Strategy Task", 
        workstream: "Testing", 
        risk: "low", 
        status: "completed", 
        approval: "not required",
        task_type: "product_strategy",
        outputs: {
            agent_output: {
                strategic_question: "Should we build or buy?",
                market_context: "Growing market",
                competitor_insights: "Competitor A built internally",
                strategic_options: ["Build", "Buy"],
                recommended_position: "Buy",
                decision_needed: "Budget approval",
                risks: ["Integration"],
                next_actions: ["Talk to vendors"]
            }
        }
      },
      {
        id: 103,
        title: "Empty Task",
        workstream: "Testing",
        risk: "low",
        status: "proposed",
        approval: "not required",
        outputs: {},
        evaluation: {},
        telemetry: {}
      }
    ]));
  });

  it('renders product output structured fields', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    await user.click(screen.getByText(/Product Task/i));
    
    expect(screen.getByText(/High latency/i)).toBeInTheDocument();
    expect(screen.getByText(/Power users/i)).toBeInTheDocument();
    expect(screen.getByText(/Use Redis/i)).toBeInTheDocument();
    expect(screen.getByText(/Latency < 50ms/i)).toBeInTheDocument();
    expect(screen.getByText(/Network is reliable/i)).toBeInTheDocument();
    expect(screen.getByText(/Deploy cache/i)).toBeInTheDocument();
  });

  it('renders strategy output structured fields', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    await user.click(screen.getByText(/Strategy Task/i));
    
    expect(screen.getByText(/Should we build or buy\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Growing market/i)).toBeInTheDocument();
    expect(screen.getByText(/Competitor A built internally/i)).toBeInTheDocument();
    expect(screen.getByText(/Budget approval/i)).toBeInTheDocument();
  });

  it('renders executive review structured fields', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    await user.click(screen.getByText(/Product Task/i));
    
    expect(screen.getByText(/Solid plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/No fallback/i)).toBeInTheDocument();
    expect(screen.getByText(/Usage stats/i)).toBeInTheDocument();
    expect(screen.getByText(/What if Redis fails\?/i)).toBeInTheDocument();
  });

  it('renders evaluation score dimensions', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    await user.click(screen.getByText(/Product Task/i));
    
    expect(screen.getAllByText(/relevance:/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Overall Score: 8.1/i)).toBeInTheDocument();
  });

  it('renders telemetry execution data', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    await user.click(screen.getByText(/Product Task/i));
    
    expect(screen.getAllByText(/gpt-4o/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/v1.2/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/1500 tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0.015/i)).toBeInTheDocument();
    expect(screen.getByText(/2500ms/i)).toBeInTheDocument();
  });

  it('shows clear empty states before execution', async () => {
    const user = userEvent.setup();
    render(<TopicCommandCentre topicId="1" />);
    
    await user.click(screen.getByText(/Empty Task/i));
    
    expect(screen.getByText(/No agent output generated yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Not yet reviewed by executive/i)).toBeInTheDocument();
    expect(screen.getByText(/No agent runs recorded/i)).toBeInTheDocument();
  });
});
