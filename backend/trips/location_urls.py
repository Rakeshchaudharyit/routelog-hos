from django.urls import path
from .views import search_locations_view
urlpatterns = [path('search/', search_locations_view, name='location-search')]
