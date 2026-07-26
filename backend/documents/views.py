"""
Views for the Document Upload and Extraction Subsystem (Chapter 4,
Section 4.3.2) plus the list/detail endpoints that Section 4.4.5
describes as the system's structured output.

Note: this phase stops at extraction. Document.status goes from
'uploaded' to 'processing' here, but nothing yet moves it to 'complete' —
that transition happens in Phase 3 once clause identification and
summarization actually run.
"""

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

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


class DocumentUploadView(APIView):
    """
    POST /api/documents/upload/

    Accepts a single contract file (PDF or DOCX), validates it, extracts
    its raw text, and stores both the file and the extracted text. Does
    NOT run clause identification or summarization — that's Phase 3.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if uploaded_file is None:
            return Response(
                {'error': 'No file was provided under the "file" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate type and size (Chapter 4, Section 4.4.5)
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

        # Create the Document row first so we have something to attach
        # extracted text to, and so a failed extraction still leaves a
        # record the user (and you, debugging) can see in /admin/.
        document = Document.objects.create(
            user=request.user,
            file=uploaded_file,
            file_name=uploaded_file.name,
            file_type=file_type,
            status=Document.Status.PROCESSING,
        )

        # Extract text (Chapter 4, Section 4.3.2)
        try:
            uploaded_file.seek(0)  # validate_file may have read from it
            extracted = extract_text(uploaded_file, file_type)
        except ExtractionError as e:
            document.status = Document.Status.FAILED
            document.save()
            return Response(
                {'error': str(e), 'document_id': document.id},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        document.extracted_text = extracted
        # Deliberately left as PROCESSING, not COMPLETE — Phase 3 sets
        # COMPLETE once clauses and summaries actually exist for this
        # document. Right now only extraction has happened.
        document.save()

        serializer = DocumentUploadSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentListView(generics.ListAPIView):
    """GET /api/documents/ — the Dashboard's Summary History panel (4.2)."""

    serializer_class = DocumentListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)


class DocumentDetailView(generics.RetrieveAPIView):
    """
    GET /api/documents/{id}/summary/

    Returns clauses too, but until Phase 3 runs, clauses will always be
    an empty list for any document — that's expected at this stage.
    """

    serializer_class = DocumentDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)