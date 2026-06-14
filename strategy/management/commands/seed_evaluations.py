import os
import json
from django.core.management.base import BaseCommand
from django.conf import settings
from strategy.models import EvaluationTemplate

class Command(BaseCommand):
    help = 'Seeds the database with default Evaluation Templates from a JSON file.'

    def handle(self, *args, **options):
        # Define path to the JSON file
        json_file_path = os.path.join(settings.BASE_DIR, 'strategy', 'fixtures', 'default_evaluations.json')
        
        if not os.path.exists(json_file_path):
            self.stdout.write(self.style.ERROR(f'File not found: {json_file_path}'))
            return

        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            templates = data.get('templates', [])
            count = 0
            
            for t_data in templates:
                # Pack additional data into scoring_schema
                scoring_schema = {
                    'key': t_data.get('key'),
                    'score_field': t_data.get('score_field'),
                    'weight_default': t_data.get('weight_default'),
                    'scoring_scale': t_data.get('scoring_scale'),
                    'rubric': t_data.get('rubric'),
                    'output_schema': t_data.get('output_schema'),
                }
                
                # Update or create based on name
                template, created = EvaluationTemplate.objects.update_or_create(
                    name=t_data['name'],
                    defaults={
                        'category': t_data['category'],
                        'version': t_data['version'],
                        'description': t_data['description'],
                        'evaluation_prompt': t_data['evaluation_prompt'],
                        'scoring_schema': scoring_schema,
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f"Created template: {template.name}"))
                else:
                    self.stdout.write(self.style.SUCCESS(f"Updated template: {template.name}"))
                
                count += 1
                
            self.stdout.write(self.style.SUCCESS(f'Successfully processed {count} Evaluation Templates.'))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to seed evaluations: {str(e)}'))
