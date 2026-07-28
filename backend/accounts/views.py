"""
Views for the accounts app — Phase 4, Section 4.3.1's Authentication
Subsystem. Login/refresh are handled directly by SimpleJWT's built-in
views in config/urls.py; this file only needs registration.
"""

from rest_framework import generics, permissions
from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — open to anyone, creates a new user."""

    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
