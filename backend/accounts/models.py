"""
Models for the accounts app.

EvaluationLog corresponds to Chapter 4, Section 4.4.7's EvaluationLog
table — it stores usability/comprehension ratings collected during the
evaluation phase described in Chapter 5.
"""

from django.conf import settings
from django.db import models
from documents.models import Document


class EvaluationLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='evaluation_logs',
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='evaluation_logs',
    )
    rating = models.PositiveSmallIntegerField(
        help_text='1 (very poor) to 5 (excellent), matching a Likert-style survey'
    )
    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        # One rating per person per document. Without this, a participant
        # who submits twice is counted twice and quietly skews the mean
        # that Chapter 5 reports. The API upserts rather than erroring
        # (see EvaluationLogSerializer.create), so re-rating updates the
        # existing row instead of failing.
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'document'],
                name='unique_evaluation_per_user_document',
            )
        ]

    def __str__(self):
        return f'Rating {self.rating}/5 by {self.user} on {self.document}'