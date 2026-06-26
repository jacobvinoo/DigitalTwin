from rest_framework import serializers
from .models import AgentDefinition, AgentEdge

class AgentDefinitionSerializer(serializers.ModelSerializer):
    metrics = serializers.SerializerMethodField()

    class Meta:
        model = AgentDefinition
        fields = [
            "id",
            "name",
            "role",
            "system_prompt",
            "instructions",
            "output_schema",
            "input_schema",
            "is_entrypoint",
            "is_terminal",
            "position_x",
            "position_y",
            "created_at",
            "updated_at",
            "metrics",
            "model_name",
            "temperature",
            "topic",

            "description",
            "rag_collection_id",
            "memory_scope",
        ]
        read_only_fields = ["topic"]
    def get_metrics(self, obj):
        from .models import AgentRunTrace
        traces = AgentRunTrace.objects.filter(agent=obj, status="completed").order_by('-id')[:2]
        if not traces:
            return None
            
        trace = traces[0]
        evals = trace.validation_result
        if not evals or not isinstance(evals, list):
            return None
            
        avg_score = sum(e.get("score", 0) for e in evals) / len(evals)
        acceptance_rate = int((sum(1 for e in evals if e.get("passed", False)) / len(evals)) * 100)
        
        trend = 0.0
        if len(traces) > 1:
            prev_evals = traces[1].validation_result
            if prev_evals and isinstance(prev_evals, list):
                prev_avg = sum(e.get("score", 0) for e in prev_evals) / len(prev_evals)
                trend = round(avg_score - prev_avg, 1)
                
        return {
            "score": round(avg_score, 1),
            "trend": trend,
            "acceptanceRate": acceptance_rate,
            "revisionRate": 1.0
        }

class AgentEdgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentEdge
        fields = "__all__"
        read_only_fields = ["topic", "created_at"]
