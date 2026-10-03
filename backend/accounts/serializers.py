from rest_framework import serializers
from .models import WorkspaceSettings


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    remember = serializers.BooleanField(default=True)


class PasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(min_length=8, trim_whitespace=False, write_only=True)


    def validate_new_password(self, value):
        if not value.strip():
            raise serializers.ValidationError("New password must not be blank.")
        return value


class SettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkspaceSettings
        fields = ['app_name', 'workspace_name', 'workspace_subtitle', 'logo_url']

    def get_logo_url(self, obj):
        return self.context['request'].build_absolute_uri(obj.logo.url) if obj.logo else None


class ProfileSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, allow_blank=False)

    def validate(self, attrs):
        if set(self.initial_data) - {'name'}:
            raise serializers.ValidationError('Only display name can be updated.')
        return attrs
