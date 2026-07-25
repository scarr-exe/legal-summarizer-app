"""
Serializers for the documents app.

These define the JSON shape returned by the API — this is the concrete
version of the "structured output" described in Chapter 4, Section 4.4.5.
"""

from rest_framework import serializers
from .models import Document, Clause, Summary


class SummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Summary
        fields = ['id', 'summary_text', 'generated_at']


class ClauseSerializer(serializers.ModelSerializer):
    summary = SummarySerializer(read_only=True)

    class Meta:
        model = Clause
        fields = ['id', 'clause_type', 'original_text', 'position', 'summary']


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the Dashboard / history list (4.2, 4.3.4)."""

    class Meta:
        model = Document
        fields = ['id', 'file_name', 'file_type', 'upload_date', 'status']


class DocumentDetailSerializer(serializers.ModelSerializer):
    """Full serializer returned by GET /api/documents/{id}/summary/ (4.4.5)."""

    clauses = ClauseSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            'id', 'file_name', 'file_type', 'upload_date', 'status', 'clauses'
        ]


class DocumentUploadSerializer(serializers.ModelSerializer):
    """Used only for the upload endpoint — accepts the raw file."""

    class Meta:
        model = Document
        fields = ['id', 'file', 'file_name', 'file_type', 'status']
        read_only_fields = ['id', 'status']