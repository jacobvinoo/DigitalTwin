from django.contrib.auth.models import User
from django.utils.deprecation import MiddlewareMixin

class ForceAuthMiddleware(MiddlewareMixin):
    def process_request(self, request):
        try:
            request.user = User.objects.get(id=1)
        except:
            pass
