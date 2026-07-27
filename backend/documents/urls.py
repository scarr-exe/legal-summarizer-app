"""
Full urls.py for Phase 3 — REPLACES the Phase 2 version, adding the
process/ endpoint.
"""

from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.DocumentUploadView.as_view(), name='document-upload'),
    path('', views.DocumentListView.as_view(), name='document-list'),
    path('<int:pk>/summary/', views.DocumentDetailView.as_view(), name='document-detail'),
    path('<int:pk>/process/', views.DocumentProcessView.as_view(), name='document-process'),
]