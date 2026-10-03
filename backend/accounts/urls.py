from django.urls import path
from .views import LoginView, LogoutView, MeView, PasswordView, SettingsView, LogoView, ProfileView

urlpatterns = [
    path('auth/login/', LoginView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('auth/profile/', ProfileView.as_view()),
    path('auth/change-password/', PasswordView.as_view()),
    path('settings/', SettingsView.as_view()),
    path('settings/logo/', LogoView.as_view()),
]
