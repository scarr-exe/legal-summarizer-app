"""
Admin registration for the accounts app.

The EvaluationLog screen is where Chapter 5's evaluation figures actually
get read off, so it carries a summary line (response count and mean
rating) rather than just listing rows.
"""

from django.contrib import admin
from django.db.models import Avg, Count
from .models import EvaluationLog


@admin.register(EvaluationLog)
class EvaluationLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'document', 'rating', 'short_comment', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['user__username', 'document__file_name', 'comments']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at']

    @admin.display(description='Comment')
    def short_comment(self, obj):
        if not obj.comments:
            return '—'
        return obj.comments[:70] + ('…' if len(obj.comments) > 70 else '')

    def changelist_view(self, request, extra_context=None):
        """Adds response count / mean rating / distribution above the list,
        so the numbers Chapter 5 needs don't have to be tallied by hand."""
        response = super().changelist_view(request, extra_context)
        try:
            queryset = response.context_data['cl'].queryset
        except (AttributeError, KeyError):
            return response

        stats = queryset.aggregate(n=Count('id'), mean=Avg('rating'))
        distribution = {
            row['rating']: row['n']
            for row in queryset.values('rating').annotate(n=Count('id'))
        }
        response.context_data['evaluation_summary'] = {
            'count': stats['n'] or 0,
            'mean': round(stats['mean'], 2) if stats['mean'] is not None else None,
            'distribution': [(score, distribution.get(score, 0)) for score in range(5, 0, -1)],
        }
        return response
