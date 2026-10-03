from django.urls import path
from .views import plan_trip
urlpatterns = [path('plan/', plan_trip, name='trip-plan')]
