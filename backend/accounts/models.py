from django.db import models
import uuid


def logo_path(instance, filename):
    return f'workspace/logos/{uuid.uuid4().hex}.{filename.rsplit(".", 1)[-1].lower()}'


class WorkspaceSettings(models.Model):
    # One fixed primary key; the assessment has one workspace.
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    app_name = models.CharField(max_length=60, default='RouteLog HOS')
    workspace_name = models.CharField(max_length=60, default='Demo Transport')
    workspace_subtitle = models.CharField(max_length=60, default='Fleet workspace', blank=True)
    logo = models.ImageField(upload_to=logo_path, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name='one_workspace_settings')]

    def __str__(self):
        return self.workspace_name
