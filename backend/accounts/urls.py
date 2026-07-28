"""
Phase 4 — adds the register endpoint. Login/refresh already work via
SimpleJWT's built-in views, wired directly in config/urls.py.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
]
