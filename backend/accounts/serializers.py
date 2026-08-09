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
    """Accepts a usability/comprehension rating for one document.

    'user' is deliberately absent from fields — it is taken from the
    authenticated request in the view, never from the request body, so a
    client can't log an evaluation on someone else's behalf.
    """

    # The model's help_text documents a 1-5 Likert scale but the field
    # itself only enforces "positive", so rating=99 would have been stored
    # happily and skewed the Chapter 5 evaluation figures. Enforced here.
    rating = serializers.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = EvaluationLog
        fields = ['id', 'document', 'rating', 'comments', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        """Upsert rather than insert.

        The model enforces one rating per user per document, so a second
        POST for the same document would otherwise fail on the constraint.
        A participant changing their mind mid-session is normal, and a
        400 in that situation would read as a broken form — so the
        existing row is updated instead.
        """
        user = validated_data.pop('user')
        document = validated_data.pop('document')
        instance, _ = EvaluationLog.objects.update_or_create(
            user=user, document=document, defaults=validated_data
        )
        return instance

    def validate_document(self, document):
        """Rejects evaluations against documents the requester doesn't own.

        Without this, any authenticated user could POST an arbitrary
        document id and attach a rating to a stranger's document, since
        the id is just an integer in the request body.
        """
        request = self.context.get('request')
        if request is not None and document.user_id != request.user.id:
            raise serializers.ValidationError(
                'You can only submit an evaluation for your own document.'
            )
        return document