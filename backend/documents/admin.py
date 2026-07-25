"""
Registers Document, Clause and Summary with the Django admin so you can
inspect uploaded documents and pipeline output directly at /admin/ —
this is the fastest way to debug Phase 2/3 without building the
frontend first.
"""

from django.contrib import admin
from .models import Document, Clause, Summary


class ClauseInline(admin.TabularInline):
    model = Clause
    extra = 0
    fields = ['position', 'clause_type', 'original_text']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'user', 'file_type', 'status', 'upload_date']
    list_filter = ['status', 'file_type']
    search_fields = ['file_name', 'user__username']
    inlines = [ClauseInline]


@admin.register(Clause)
class ClauseAdmin(admin.ModelAdmin):
    list_display = ['document', 'position', 'clause_type']
    list_filter = ['clause_type']


@admin.register(Summary)
class SummaryAdmin(admin.ModelAdmin):
    list_display = ['clause', 'generated_at']