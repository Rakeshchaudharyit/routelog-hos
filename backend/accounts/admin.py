from django.contrib import admin
from .models import WorkspaceSettings


@admin.register(WorkspaceSettings)
class WorkspaceSettingsAdmin(admin.ModelAdmin):
    readonly_fields = ['updated_at']

    def has_add_permission(self, request):
        return super().has_add_permission(request) and not WorkspaceSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
