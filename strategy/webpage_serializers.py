from rest_framework import serializers
from strategy.models import WebpageArtifact

class WebpageBuilderRequestSerializer(serializers.Serializer):
    """Validate inputs for the Visual Webpage Builder Agent."""
    topic_id = serializers.IntegerField(required=False)
    title = serializers.CharField(max_length=255, required=True)
    timeline_matrix = serializers.JSONField(required=False, default=dict)
    trend_details = serializers.JSONField(required=False, default=dict)
    trend_clusters = serializers.JSONField(required=False, default=dict)
    monitoring_indicators = serializers.JSONField(required=False, default=dict)
    source_records = serializers.JSONField(required=False, default=list)

class WebpageArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebpageArtifact
        fields = [
            "id",
            "title",
            "artifact_type",
            "framework",
            "component_name",
            "code",
            "rendered_preview_url",
            "validation_result",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "artifact_type", "created_at", "updated_at"]
