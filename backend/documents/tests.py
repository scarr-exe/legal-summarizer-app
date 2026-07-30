from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Document, Clause, Summary

User = get_user_model()


class DocumentDeleteTests(APITestCase):
    """Covers DELETE /api/documents/{id}/ — added so users can remove
    contracts they no longer want from the dashboard."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='S0meStr0ngPass!')
        self.other = User.objects.create_user(username='other', password='S0meStr0ngPass!')

        self.document = Document.objects.create(
            user=self.owner,
            file_name='tenancy.pdf',
            file_type='pdf',
            extracted_text='1. RENT The tenant shall pay rent monthly.',
            status=Document.Status.COMPLETE,
        )
        clause = Clause.objects.create(
            document=self.document,
            clause_type='payment',
            original_text='The tenant shall pay rent monthly.',
            position=0,
        )
        Summary.objects.create(clause=clause, summary_text='The tenant must pay rent monthly.')

    def _auth(self, username):
        response = self.client.post('/api/auth/login/', {
            'username': username,
            'password': 'S0meStr0ngPass!',
        })
        return response.data['access']

    def test_owner_can_delete_document_and_cascades(self):
        access = self._auth('owner')
        response = self.client.delete(
            f'/api/documents/{self.document.id}/', HTTP_AUTHORIZATION=f'Bearer {access}'
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Document.objects.filter(id=self.document.id).exists())
        # Clause/Summary go with it via on_delete=CASCADE.
        self.assertEqual(Clause.objects.count(), 0)
        self.assertEqual(Summary.objects.count(), 0)

    def test_other_user_cannot_delete_someone_elses_document(self):
        access = self._auth('other')
        response = self.client.delete(
            f'/api/documents/{self.document.id}/', HTTP_AUTHORIZATION=f'Bearer {access}'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Document.objects.filter(id=self.document.id).exists())

    def test_delete_requires_authentication(self):
        response = self.client.delete(f'/api/documents/{self.document.id}/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Document.objects.filter(id=self.document.id).exists())
