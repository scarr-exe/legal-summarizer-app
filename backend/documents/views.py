"""
Full views.py for Phase 3 — this REPLACES the Phase 2 version. It adds
one new view (DocumentProcessView) and leaves the upload/list/detail
views from Phase 2 unchanged.
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.shortcuts import get_object_or_404

from .models import Document
from .serializers import (
    DocumentUploadSerializer,
    DocumentListSerializer,
    DocumentDetailSerializer,
)
from .extraction import (
    validate_file,
    extract_text,
    UnsupportedFileTypeError,
    ExtractionError,
)
from .pipeline import process_document, ProcessingError


class DocumentUploadView(APIView):
    """POST /api/documents/upload/ — unchanged from Phase 2."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if uploaded_file is None:
            return Response(
                {'error': 'No file was provided under the "file" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            file_type = validate_file(
                uploaded_file.name,
                uploaded_file.size,
                settings.MAX_UPLOAD_SIZE_MB,
            )
        except UnsupportedFileTypeError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        document = Document.objects.create(
            user=request.user,
            file=uploaded_file,
            file_name=uploaded_file.name,
            file_type=file_type,
            status=Document.Status.PROCESSING,
        )

        try:
            uploaded_file.seek(0)
            extracted = extract_text(uploaded_file, file_type)
        except ExtractionError as e:
            document.status = Document.Status.FAILED
            document.save()
            return Response(
                {'error': str(e), 'document_id': document.id},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        document.extracted_text = extracted
        document.save()

        serializer = DocumentUploadSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentProcessView(APIView):
    """
    POST /api/documents/{id}/process/

    Runs clause identification + summarization (Chapter 4, Section
    4.3.3) on a document that has already been uploaded and extracted.
    Separated from upload on purpose: extraction is fast, NLP processing
    is slow (the summarization model can take several seconds per
    clause on a CPU), so keeping them as two requests means the upload
    response doesn't hang waiting for the whole pipeline to finish.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        document = get_object_or_404(Document, pk=pk, user=request.user)

        try:
            process_document(document)
        except ProcessingError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = DocumentDetailSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DocumentListView(generics.ListAPIView):
    """GET /api/documents/ — unchanged from Phase 2."""

    serializer_class = DocumentListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)


class DocumentDetailView(generics.RetrieveAPIView):
    """
    GET /api/documents/{id}/summary/

    Now returns real populated clauses after DocumentProcessView has
    been called for that document — unchanged code from Phase 2, but
    the output is no longer an empty list once Phase 3 has run.
    """

    serializer_class = DocumentDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)