import json
from .models import AgentPromptAssignment, PromptTemplate, PromptTemplateVersion
from .chain_engine import get_llm_client

def consolidate_agent_prompts(agent):
    """
    Detects if an agent has too many active improvement rules.
    If it has >= 10, it calls the LLM to consolidate them into a single new rule
    and disables the old ones.
    """
    # 1. Fetch all active improvement rules for this agent
    active_assignments = AgentPromptAssignment.objects.filter(
        agent=agent,
        enabled=True,
        prompt_template__category="improvement_rule"
    ).order_by('sort_order')
    
    if active_assignments.count() < 10:
        return {"status": "skipped", "message": "Less than 10 active improvement rules, skipping consolidation."}
        
    # 2. Extract rules text
    rules = [a.prompt_template.prompt_body for a in active_assignments]
    rules_text = "\n".join([f"- {r}" for r in rules])
    
    # 3. Call LLM to consolidate
    llm = get_llm_client()
    prompt = f"""
    The following are {len(rules)} different improvement rules that have been appended to an AI agent's system prompt over time.
    Some of these rules may be duplicates, overlapping, or conflicting.
    
    Rules:
    {rules_text}
    
    Please merge these into a single, cohesive, consolidated set of rules.
    Remove any exact duplicates, resolve conflicts by keeping the most robust constraint, and group related rules together under clear headings.
    Return ONLY the raw markdown text of the consolidated rules. Do not include introductory text.
    """
    
    try:
        # For this we can just use a generic text execution
        # Assuming the LLM wrapper can handle standard completion without schema if requested,
        # but to be safe we'll use a simple schema.
        from pydantic import BaseModel, Field
        class ConsolidationSchema(BaseModel):
            consolidated_rules: str = Field(..., description="The fully merged and consolidated set of rules.")
            
        res = llm.execute(prompt=prompt, prompt_version="1.0", schema_class=ConsolidationSchema, model="gpt-4o")
        consolidated_text = res.data.consolidated_rules if not isinstance(res.data, dict) else res.data.get("consolidated_rules", "")
        
        if not consolidated_text:
            raise ValueError("Consolidation yielded empty text.")
            
    except Exception as e:
        return {"status": "error", "message": f"LLM consolidation failed: {str(e)}"}
        
    # 4. Create new consolidated PromptTemplate
    new_template = PromptTemplate.objects.create(
        name=f"Consolidated Improvement Rules ({len(rules)} merged)",
        category="improvement_rule",
        description=f"Automatically consolidated {len(rules)} previous rules to reduce prompt bloat.",
        prompt_body=consolidated_text,
        version=1
    )
    PromptTemplateVersion.objects.create(
        prompt_template=new_template,
        version_number=1,
        prompt_body=consolidated_text,
        changelog="Initial consolidation"
    )
    
    # 5. Disable old assignments and add new one
    for assignment in active_assignments:
        assignment.enabled = False
        assignment.save()
        
    AgentPromptAssignment.objects.create(
        agent=agent,
        prompt_template=new_template,
        sort_order=800,
        enabled=True,
        required=True
    )
    
    return {"status": "success", "message": f"Consolidated {len(rules)} rules into 1."}
