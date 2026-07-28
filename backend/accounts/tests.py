from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

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
