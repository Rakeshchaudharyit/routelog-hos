from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    path('api/locations/', include('trips.location_urls')),
    path('api/trips/', include('trips.urls')),
    path('api/', include('accounts.urls')),
]

from django.conf import settings
from django.conf.urls.static import static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Assessment logo serving only; production durability requires a persistent media mount.
if not settings.DEBUG and settings.SERVE_DEMO_MEDIA:
    from django.urls import re_path
    from django.views.static import serve
    urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]
