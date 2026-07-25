"""
Models for the documents app.

Maps directly to the data dictionary in Chapter 4, Section 4.4.7:
    Document  -> document metadata (file, type, upload date, owning user)
    Clause    -> a single identified clause within a document
    Summary   -> the plain-language summary generated for one clause

Two fields exist here that are NOT in the Chapter 4 data dictionary:
    Document.extracted_text and Document.status
These are practical additions needed to actually run the pipeline
(Phase 2 needs somewhere to put extracted text before clauses exist,
and the frontend needs to know whether processing succeeded, is still
running, or failed). Mention this explicitly if asked why the code
doesn't match the dictionary table exactly — it's a deliberate,
justifiable addition, not a mismatch to hide.
"""

from django.conf import settings
from django.db import models


class Document(models.Model):
    class FileType(models.TextChoices):
        PDF = 'pdf', 'PDF'
        DOCX = 'docx', 'DOCX'

    class Status(models.TextChoices):
        UPLOADED = 'uploaded', 'Uploaded'
        PROCESSING = 'processing', 'Processing'
        COMPLETE = 'complete', 'Complete'
        FAILED = 'failed', 'Failed'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    file = models.FileField(upload_to='contracts/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FileType.choices)
    upload_date = models.DateTimeField(auto_now_add=True)

    # Practical additions beyond the Chapter 4 dictionary (see module docstring)
    extracted_text = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.UPLOADED
    )

    class Meta:
        ordering = ['-upload_date']

    def __str__(self):
        return f'{self.file_name} ({self.user})'


class Clause(models.Model):
    class ClauseType(models.TextChoices):
        PAYMENT = 'payment', 'Payment'
        TERMINATION = 'termination', 'Termination'
        CONFIDENTIALITY = 'confidentiality', 'Confidentiality'
        RENEWAL = 'renewal', 'Renewal'
        OTHER = 'other', 'Other'

    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name='clauses'
    )
    clause_type = models.CharField(
        max_length=30, choices=ClauseType.choices, default=ClauseType.OTHER
    )
    original_text = models.TextField()
    position = models.PositiveIntegerField(
        help_text='Order of this clause within the source document'
    )

    class Meta:
        ordering = ['position']

    def __str__(self):
        return f'Clause {self.position} ({self.clause_type}) — {self.document.file_name}'


class Summary(models.Model):
    clause = models.OneToOneField(
        Clause, on_delete=models.CASCADE, related_name='summary'
    )
    summary_text = models.TextField()
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Summary for {self.clause}'