import json
from django.core.management.base import BaseCommand
from strategy.models import PromptTemplate, PromptTemplateVersion, PromptPack

class Command(BaseCommand):
    help = 'Seeds the database with default Prompt Templates and Prompt Packs.'

    def handle(self, *args, **kwargs):
        templates_data = [
            {
                "key": "safety.hallucination_avoidance",
                "name": "Hallucination Avoidance",
                "category": "safety",
                "description": "Prevents unsupported claims and forces uncertainty when evidence is missing.",
                "prompt_body": "Only state information that is supported by user-provided context, approved memory, retrieved documents, tool results, or cited sources. Do not invent facts, metrics, names, dates, companies, market shares, or references. If evidence is insufficient, say UNKNOWN or mark the claim as an assumption. Separate facts from interpretation. Every material claim must include evidence_refs and confidence_score."
            },
            {
                "key": "safety.fact_validation",
                "name": "Fact Validation",
                "category": "safety",
                "description": "Checks factual claims before output is accepted.",
                "prompt_body": "Validate each factual claim before including it. For every factual claim, identify: claim, evidence_ref, source_type, confidence_score, and validation_status. Do not include claims with validation_status='unsupported' unless explicitly placed in an 'Assumptions or Open Questions' section."
            },
            {
                "key": "safety.source_recording",
                "name": "Source Recording",
                "category": "safety",
                "description": "Requires all used sources to be recorded for traceability.",
                "prompt_body": "Record every source that influenced the output. For each source include title, publisher, author if available, url or document_id, retrieval_date, source_type, credibility_score, and notes on relevance. Do not discard sources that materially shaped the conclusion."
            },
            {
                "key": "research.web_research",
                "name": "Web Research",
                "category": "research",
                "description": "Guides broad, source-aware web research.",
                "prompt_body": "Research broadly before concluding. Prefer primary sources, official documentation, reputable industry reports, academic or technical sources, and credible case studies. Avoid relying on a single source. Capture contradictory evidence. Produce a source list, evidence table, and unresolved questions."
            },
            {
                "key": "research.evidence_extraction",
                "name": "Evidence Extraction",
                "category": "research",
                "description": "Separates raw evidence from interpretation.",
                "prompt_body": "Extract evidence before creating conclusions. For each evidence item include source_ref, quote_or_summary, date, relevance, interpretation, and confidence_score. Do not convert evidence into recommendations until the evidence table is complete."
            },
            {
                "key": "research.source_ranking",
                "name": "Source Ranking",
                "category": "research",
                "description": "Ranks source credibility and usefulness.",
                "prompt_body": "Rank sources by credibility and relevance. Score each source from 1 to 5 for authority, freshness, specificity, neutrality, and direct relevance. Prioritise primary and current sources. Flag weak, outdated, promotional, or unsupported sources."
            },
            {
                "key": "product.product_thinking",
                "name": "Product Thinking",
                "category": "product",
                "description": "Converts information into product implications.",
                "prompt_body": "Translate findings into product impact. Cover customer problem, target users, user needs, product opportunity, trade-offs, implementation complexity, dependencies, success metrics, and risks. Avoid generic product language. Tie recommendations to measurable outcomes."
            },
            {
                "key": "product.kpi_analysis",
                "name": "KPI Analysis",
                "category": "product",
                "description": "Defines meaningful product metrics.",
                "prompt_body": "Define KPIs using outcome, behaviour, and operational metrics. For each KPI include definition, formula, data source, leading/lagging classification, target direction, owner, measurement frequency, and known limitations."
            },
            {
                "key": "product.customer_impact",
                "name": "Customer Impact",
                "category": "product",
                "description": "Frames work around customer outcomes.",
                "prompt_body": "Explain customer impact clearly. Identify affected customer segments, current pain points, expected behaviour change, accessibility/usability implications, trust implications, and measurable customer outcomes."
            },
            {
                "key": "strategy.strategic_options",
                "name": "Strategic Options",
                "category": "strategy",
                "description": "Creates comparable strategic options.",
                "prompt_body": "Generate 2 to 4 strategic options. For each option include strategic logic, expected upside, cost/complexity, risks, dependencies, time horizon, evidence strength, and what must be true for this option to succeed. Recommend one option with rationale."
            },
            {
                "key": "strategy.scenario_planning",
                "name": "Scenario Planning",
                "category": "strategy",
                "description": "Explores possible futures and responses.",
                "prompt_body": "Create scenarios based on key uncertainties. For each scenario include triggers, early signals, business impact, product impact, risks, opportunities, recommended response, and monitoring metrics."
            },
            {
                "key": "strategy.risk_analysis",
                "name": "Risk Analysis",
                "category": "strategy",
                "description": "Identifies strategic, product, operational, and execution risks.",
                "prompt_body": "Identify risks across market, customer, product, technology, data, operational, regulatory, financial, and adoption dimensions. For each risk include likelihood, impact, early warning signal, mitigation, owner, and residual risk."
            },
            {
                "key": "executive.executive_summary",
                "name": "Executive Summary",
                "category": "executive",
                "description": "Creates concise executive-ready summaries.",
                "prompt_body": "Write for a time-poor executive. Lead with the decision, implication, or recommendation. Include only the most important evidence, trade-offs, risks, and next actions. Avoid long background sections. Use concise, direct language."
            },
            {
                "key": "executive.decision_framing",
                "name": "Decision Framing",
                "category": "executive",
                "description": "Frames outputs around decisions required.",
                "prompt_body": "Frame the output around the decision to be made. Include decision required, options, recommendation, evidence, trade-offs, risks, cost of delay, and next decision point. Make clear what the user should approve, reject, or investigate."
            },
            {
                "key": "executive.counter_arguments",
                "name": "Counter Arguments",
                "category": "executive",
                "description": "Challenges recommendations before they are accepted.",
                "prompt_body": "For every major recommendation, provide the strongest counterargument. Identify weak assumptions, missing evidence, unintended consequences, and alternative explanations. Do not weaken the critique to be agreeable."
            },
            {
                "key": "writing.structured_document_writer",
                "name": "Structured Document Writer",
                "category": "writing",
                "description": "Creates structured reusable documents.",
                "prompt_body": "Create a structured document with clear headings, concise sections, evidence-backed claims, recommendations, risks, next actions, and references. Use the selected document template. Do not include unsupported claims. Include Review Notes if executive review raised concerns."
            },
            {
                "key": "writing.citation_formatting",
                "name": "Citation Formatting",
                "category": "writing",
                "description": "Standardises references and citations.",
                "prompt_body": "Every cited claim must include a citation marker linked to a source_ref. Include a References section with title, publisher, date, url or document_id, retrieval_date, and credibility_score. If a source is unavailable, mark the citation as missing_source."
            },
            {
                "key": "writing.recommendation_formatting",
                "name": "Recommendation Formatting",
                "category": "writing",
                "description": "Formats recommendations for action.",
                "prompt_body": "Format recommendations as action-oriented items. For each recommendation include rationale, evidence_refs, expected impact, effort, risk, owner, timeframe, dependency, and first next step."
            },
            {
                "key": "review.adversarial_review",
                "name": "Adversarial Review",
                "category": "review",
                "description": "Critiques output as if it may be flawed.",
                "prompt_body": "Review adversarially. Assume the work may be generic, incomplete, overconfident, or insufficiently grounded. Identify weak claims, missing evidence, hidden assumptions, unclear trade-offs, and whether the output supports a real decision."
            },
            {
                "key": "review.missing_evidence_review",
                "name": "Missing Evidence Review",
                "category": "review",
                "description": "Checks evidence gaps.",
                "prompt_body": "Identify all claims that require stronger evidence. For each gap include claim, missing evidence type, suggested source type, risk if left unsupported, and priority."
            },
            {
                "key": "review.executive_readiness_review",
                "name": "Executive Readiness Review",
                "category": "review",
                "description": "Scores whether output is ready for senior leadership.",
                "prompt_body": "Assess executive readiness. Score clarity, evidence strength, decision usefulness, strategic relevance, actionability, risk coverage, and conciseness from 1 to 10. Provide recommendation: approve, revise, or reject. Include required revisions."
            }
        ]

        packs_data = [
            {
                "key": "pack.research",
                "name": "Research Pack",
                "templates": [
                    "safety.hallucination_avoidance",
                    "safety.fact_validation",
                    "safety.source_recording",
                    "research.web_research",
                    "research.evidence_extraction",
                    "research.source_ranking"
                ]
            },
            {
                "key": "pack.product_strategy",
                "name": "Product Strategy Pack",
                "templates": [
                    "safety.hallucination_avoidance",
                    "product.product_thinking",
                    "product.kpi_analysis",
                    "product.customer_impact",
                    "strategy.strategic_options",
                    "strategy.risk_analysis",
                    "executive.decision_framing"
                ]
            },
            {
                "key": "pack.executive_review",
                "name": "Executive Review Pack",
                "templates": [
                    "review.adversarial_review",
                    "review.missing_evidence_review",
                    "review.executive_readiness_review",
                    "executive.counter_arguments"
                ]
            },
            {
                "key": "pack.document_writer",
                "name": "Document Writer Pack",
                "templates": [
                    "safety.hallucination_avoidance",
                    "writing.structured_document_writer",
                    "writing.citation_formatting",
                    "writing.recommendation_formatting",
                    "executive.executive_summary"
                ]
            }
        ]

        # 1. Seed Templates
        self.stdout.write("Seeding Prompt Templates...")
        template_map = {}
        for t_data in templates_data:
            # We use name as a lookup since 'key' isn't explicitly on PromptTemplate
            # But wait, we can just use name.
            template, created = PromptTemplate.objects.get_or_create(
                name=t_data["name"],
                defaults={
                    "category": t_data["category"],
                    "description": t_data["description"],
                    "prompt_body": t_data["prompt_body"],
                    "version": 1,
                    "is_system_prompt": False
                }
            )
            if not created:
                # Update existing
                template.category = t_data["category"]
                template.description = t_data["description"]
                template.prompt_body = t_data["prompt_body"]
                template.save()

            # Ensure version 1 exists
            PromptTemplateVersion.objects.get_or_create(
                prompt_template=template,
                version_number=template.version,
                defaults={
                    "prompt_body": template.prompt_body,
                    "changelog": "Initial Seed"
                }
            )
            template_map[t_data["key"]] = template

        # 2. Seed Packs
        self.stdout.write("Seeding Prompt Packs...")
        for p_data in packs_data:
            pack, created = PromptPack.objects.get_or_create(
                key=p_data["key"],
                defaults={"name": p_data["name"]}
            )
            if not created:
                pack.name = p_data["name"]
                pack.save()
            
            # Link templates
            pack_templates = [template_map[k] for k in p_data["templates"] if k in template_map]
            pack.templates.set(pack_templates)

        self.stdout.write(self.style.SUCCESS('Successfully seeded default Prompt Library Configuration!'))
