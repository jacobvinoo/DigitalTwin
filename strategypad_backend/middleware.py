from django.contrib.auth.models import User
from django.utils.deprecation import MiddlewareMixin
from rest_framework.authentication import BaseAuthentication

class ForceAuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        try:
            user = User.objects.filter(id=1).first()
            if not user:
                user = User.objects.create_superuser(
                    id=1,
                    username="admin",
                    email="admin@example.com",
                    password="admin"
                )
            request.user = user
        except Exception as e:
            pass

class MiddlewareAuthentication(BaseAuthentication):
    def authenticate(self, request):
        user = getattr(request._request, "user", None)
        if user and user.is_authenticated:
            return (user, None)
        return None
