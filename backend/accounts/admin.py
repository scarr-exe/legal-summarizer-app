from django.contrib import admin
from .models import EvaluationLog


@admin.register(EvaluationLog)
class EvaluationLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'document', 'rating', 'created_at']
    list_filter = ['rating']