"""
Empty for now — Phase 4 will add the real upload/list/detail endpoints
referenced in Chapter 4, Section 4.4.5. This file exists now only so
config/urls.py's include('documents.urls') doesn't break the server.
"""

from django.urls import path

urlpatterns = [
    # Phase 4 will add:
    # path('upload/', views.DocumentUploadView.as_view()),
    # path('', views.DocumentListView.as_view()),
    # path('<int:pk>/summary/', views.DocumentDetailView.as_view()),
]