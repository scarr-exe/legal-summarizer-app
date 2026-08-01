from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from accounts.views import EvaluationLogListCreateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/', include('accounts.urls')),
    path('api/documents/', include('documents.urls')),
    # Routed here rather than inside accounts/urls.py, which is mounted
    # under /api/auth/ — an evaluation log isn't an auth resource.
    path(
        'api/evaluation-logs/',
        EvaluationLogListCreateView.as_view(),
        name='evaluation-log-list-create',
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)