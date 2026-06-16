import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'strategypad_backend.settings')
django.setup()

from strategy.models import EvaluationTemplate

MAPPING = {
    "Quality Score": "quality_score",
    "Evidence Score": "evidence_score",
    "Executive Score": "executive_score",
    "Hallucination Score": "hallucination_score",
}

count = 0
for template in EvaluationTemplate.objects.all():
    if template.name in MAPPING:
        if template.score_field != MAPPING[template.name]:
            template.score_field = MAPPING[template.name]
            template.save(update_fields=['score_field'])
            count += 1
            print(f"Updated {template.name} score_field to {template.score_field}")

print(f"Successfully updated {count} templates.")
