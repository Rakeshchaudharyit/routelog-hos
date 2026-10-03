from io import BytesIO
import warnings
from PIL import Image, UnidentifiedImageError
from django.contrib.auth import authenticate, get_user_model, login as django_login, logout as django_logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from .models import WorkspaceSettings
from .serializers import LoginSerializer, PasswordSerializer, SettingsSerializer, ProfileSerializer


def user_data(user):
    return {'id': user.pk, 'email': user.email, 'name': user.get_full_name() or user.username,
            'role': 'Administrator' if user.is_staff else 'Driver', 'is_admin': user.is_staff}


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        matches = list(get_user_model().objects.filter(email__iexact=data['email'])[:2])
        # Ambiguous email records must never authenticate an arbitrary account.
        username = matches[0].username if len(matches) == 1 else '__unknown_email__'
        user = authenticate(request=request, username=username, password=data['password'])
        if user is None or len(matches) != 1:
            return Response({'detail': 'Email or password is incorrect.'}, status=400)
        django_login(request, user)
        request.session.set_expiry(1209600 if data['remember'] else 0)
        return Response({'user': user_data(user), 'csrf_token': get_token(request)})


class MeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Anonymous bootstrap also establishes the token required by the login POST.
        return Response({'user': user_data(request.user) if request.user.is_authenticated else None,
                         'csrf_token': get_token(request)})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        django_logout(request)
        return Response({'detail': 'Signed out.', 'csrf_token': get_token(request)})


class PasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not request.user.check_password(data['current_password']):
            return Response({'detail': 'Current password is incorrect.'}, status=400)
        try:
            validate_password(data['new_password'], request.user)
        except ValidationError as error:
            return Response({'detail': ' '.join(error.messages)}, status=400)
        request.user.set_password(data['new_password'])
        request.user.save(update_fields=['password'])
        update_session_auth_hash(request, request.user)
        return Response({'detail': 'Password updated.'})


class SettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        obj, _ = WorkspaceSettings.objects.get_or_create(pk=1)
        return Response(SettingsSerializer(obj, context={'request': request}).data)

    def patch(self, request):
        obj, _ = WorkspaceSettings.objects.get_or_create(pk=1)
        serializer = SettingsSerializer(obj, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LogoView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get('logo')
        if not upload:
            return Response({'detail': 'Choose a PNG, JPEG or WEBP image.'}, status=400)
        if upload.size > 2 * 1024 * 1024:
            return Response({'detail': 'Logo must be no larger than 2 MB.'}, status=400)
        formats = {'PNG': ('png', 'image/png'), 'JPEG': ('jpg', 'image/jpeg'), 'WEBP': ('webp', 'image/webp')}
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                image = Image.open(upload)
                if image.format not in formats or upload.content_type != formats[image.format][1]:
                    raise ValueError()
                if image.width * image.height > 16000000:
                    raise ValueError()
                image.verify()
                upload.seek(0)
                image = Image.open(upload)
                output = BytesIO()
                fmt = image.format
                # Re-encode validated pixels: discard metadata, embedded payloads and extra frames.
                image.convert('RGB' if fmt == 'JPEG' else 'RGBA').save(output, format=fmt)
                content = output.getvalue()
                if len(content) > 2 * 1024 * 1024:
                    raise ValueError()
        except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            return Response({'detail': 'Choose a valid PNG, JPEG or WEBP image (up to 16 megapixels).'}, status=400)
        obj, _ = WorkspaceSettings.objects.get_or_create(pk=1)
        old_name = obj.logo.name
        storage = obj.logo.storage
        obj.logo.save(f'logo.{formats[fmt][0]}', ContentFile(content), save=True)
        if old_name:
            storage.delete(old_name)
        return Response(SettingsSerializer(obj, context={'request': request}).data)

    def delete(self, request):
        obj, _ = WorkspaceSettings.objects.get_or_create(pk=1)
        old_name, storage = obj.logo.name, obj.logo.storage
        obj.logo = ''
        obj.save(update_fields=['logo', 'updated_at'])
        if old_name:
            storage.delete(old_name)
        return Response(SettingsSerializer(obj, context={'request': request}).data)


class ProfileView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request):
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Preserve the full display name using the built-in User fields.
        request.user.first_name = serializer.validated_data['name']
        request.user.last_name = ''
        request.user.save(update_fields=['first_name', 'last_name'])
        return Response({'user': user_data(request.user)})
