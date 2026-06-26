from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('strategy', '0023_researchsearchquery_trendevidencerecord'),
    ]

    operations = [
        migrations.CreateModel(
            name='WebpageArtifact',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('artifact_type', models.CharField(max_length=50, default='webpage')),
                ('framework', models.CharField(max_length=50, default='react_tailwind')),
                ('component_name', models.CharField(max_length=255)),
                ('entry_component_name', models.CharField(max_length=255, blank=True)),
                ('source_data_refs', models.JSONField(default=list, blank=True)),
                ('code', models.TextField()),
                ('rendered_preview_url', models.TextField(blank=True)),
                ('validation_result', models.JSONField(default=dict, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='webpage_artifacts', to='strategy.topic')),
                ('execution_version', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='webpage_artifacts', to='strategy.chainexecutionversion')),
                ('agent_trace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='webpage_artifacts', to='strategy.agentruntrace')),
            ],
        ),
    ]
