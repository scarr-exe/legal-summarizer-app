"""
Serializers for the accounts app.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import EvaluationLog

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Minimal registration — username + email + password, no extra profile
    fields, matching the Implementation Plan's 'no registration flows beyond
    the basics' scope for Phase 0/4."""

    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']
        read_only_fields = ['id']

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )


class EvaluationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationLog
        fields = ['id', 'document', 'rating', 'comments', 'created_at']
        read_only_fields = ['id', 'created_at']