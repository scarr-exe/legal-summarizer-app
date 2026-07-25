"""
Empty for now — Phase 4 will add the register endpoint. Login/refresh
already work via config/urls.py's direct SimpleJWT views, so this file
only needs something like path('register/', ...) added later.
"""

from django.urls import path

urlpatterns = [
    # Phase 4 will add:
    # path('register/', views.RegisterView.as_view()),
]