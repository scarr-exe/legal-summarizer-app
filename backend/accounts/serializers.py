"""
Serializers for the accounts app.
"""

from rest_framework import serializers
from .models import EvaluationLog


class EvaluationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationLog
        fields = ['id', 'document', 'rating', 'comments', 'created_at']
        read_only_fields = ['id', 'created_at']