"""
Views for the accounts app — Phase 4, Section 4.3.1's Authentication
Subsystem. Login/refresh are handled directly by SimpleJWT's built-in
views in config/urls.py; this file only needs registration.
"""

from rest_framework import generics, permissions
from .models import EvaluationLog
from .serializers import RegisterSerializer, EvaluationLogSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — open to anyone, creates a new user."""

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class EvaluationLogListCreateView(generics.ListCreateAPIView):
    """
    GET/POST /api/evaluation-logs/

    Collects the usability/comprehension ratings Chapter 5's evaluation
    needs. Same ownership pattern as the document views: the queryset is
    scoped to the requester, and the log's user is taken from the request
    rather than the payload.
    """

    serializer_class = EvaluationLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return EvaluationLog.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
