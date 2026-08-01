from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from documents.models import Document
from .models import EvaluationLog

User = get_user_model()


class RegisterLoginFlowTests(APITestCase):
    """Covers Phase 4's auth trio: register -> login -> refresh."""

    def test_register_creates_user_with_hashed_password(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'tenant1',
            'email': 'tenant1@example.com',
            'password': 'S0meStr0ngPass!',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data)

        user = User.objects.get(username='tenant1')
        self.assertNotEqual(user.password, 'S0meStr0ngPass!')  # stored hashed
        self.assertTrue(user.check_password('S0meStr0ngPass!'))

    def test_register_rejects_weak_password(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'tenant2',
            'email': 'tenant2@example.com',
            'password': '12345',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='tenant2').exists())

    def test_login_then_refresh(self):
        User.objects.create_user(username='tenant3', password='S0meStr0ngPass!')

        login = self.client.post('/api/auth/login/', {
            'username': 'tenant3',
            'password': 'S0meStr0ngPass!',
        })
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertIn('access', login.data)
        self.assertIn('refresh', login.data)

        refresh = self.client.post('/api/auth/refresh/', {
            'refresh': login.data['refresh'],
        })
        self.assertEqual(refresh.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh.data)

    def test_login_rejects_wrong_password(self):
        User.objects.create_user(username='tenant4', password='S0meStr0ngPass!')

        response = self.client.post('/api/auth/login/', {
            'username': 'tenant4',
            'password': 'wrong-password',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_token_authorizes_protected_endpoint(self):
        self.client.post('/api/auth/register/', {
            'username': 'tenant5',
            'email': 'tenant5@example.com',
            'password': 'S0meStr0ngPass!',
        })
        login = self.client.post('/api/auth/login/', {
            'username': 'tenant5',
            'password': 'S0meStr0ngPass!',
        })
        access = login.data['access']

        response = self.client.get(
            '/api/documents/', HTTP_AUTHORIZATION=f'Bearer {access}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_documents_endpoint_requires_auth(self):
        response = self.client.get('/api/documents/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class EvaluationLogTests(APITestCase):
    """Covers the EvaluationLog endpoint that collects Chapter 5's
    usability/comprehension ratings."""

    def setUp(self):
        self.user = User.objects.create_user(username='rater', password='S0meStr0ngPass!')
        self.other = User.objects.create_user(username='stranger', password='S0meStr0ngPass!')
        self.document = Document.objects.create(
            user=self.user,
            file_name='tenancy.docx',
            file_type='docx',
            status=Document.Status.COMPLETE,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_create_requires_authentication(self):
        response = self.client.post('/api/evaluation-logs/', {
            'document': self.document.id,
            'rating': 4,
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(EvaluationLog.objects.count(), 0)

    def test_authenticated_user_can_submit_evaluation(self):
        self._auth(self.user)
        response = self.client.post('/api/evaluation-logs/', {
            'document': self.document.id,
            'rating': 4,
            'comments': 'Much easier to understand than the original.',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        log = EvaluationLog.objects.get()
        # user comes from the request, never the payload
        self.assertEqual(log.user, self.user)
        self.assertEqual(log.rating, 4)

    def test_user_field_in_payload_is_ignored(self):
        """Posting someone else's user id must not reassign ownership."""
        self._auth(self.user)
        response = self.client.post('/api/evaluation-logs/', {
            'document': self.document.id,
            'rating': 5,
            'user': self.other.id,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(EvaluationLog.objects.get().user, self.user)

    def test_cannot_evaluate_another_users_document(self):
        self._auth(self.other)
        response = self.client.post('/api/evaluation-logs/', {
            'document': self.document.id,
            'rating': 5,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(EvaluationLog.objects.count(), 0)

    def test_rating_must_be_within_one_to_five(self):
        self._auth(self.user)
        for bad in (0, 6, 99):
            response = self.client.post('/api/evaluation-logs/', {
                'document': self.document.id,
                'rating': bad,
            })
            self.assertEqual(
                response.status_code, status.HTTP_400_BAD_REQUEST, f'rating={bad}'
            )
        self.assertEqual(EvaluationLog.objects.count(), 0)

    def test_list_only_returns_own_logs(self):
        EvaluationLog.objects.create(user=self.user, document=self.document, rating=4)
        other_doc = Document.objects.create(
            user=self.other, file_name='other.docx', file_type='docx'
        )
        EvaluationLog.objects.create(user=self.other, document=other_doc, rating=2)

        self._auth(self.user)
        response = self.client.get('/api/evaluation-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['rating'], 4)
