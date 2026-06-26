from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('strategy', '0025_alter_webpageartifact_options'),
    ]
    operations = [
        migrations.AddField(
            model_name='agentdefinition',
            name='agent_type',
            field=models.CharField(max_length=64, choices=[('default', 'Default'), ('visual_webpage_builder', 'Visual Webpage Builder')], default='default'),
        ),
    ]
