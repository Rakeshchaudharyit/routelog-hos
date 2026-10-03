import os
from getpass import getpass
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create the assessment admin from environment or private prompts; existing accounts are unchanged.'

    def handle(self, *args, **options):
        email = os.getenv('DEMO_ADMIN_EMAIL') or input('Demo admin email: ').strip()
        try:
            validate_email(email)
        except ValidationError as error:
            raise CommandError('A valid email is required.') from error
        User = get_user_model()
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write('Account already exists; credentials unchanged.')
            return
        password = os.getenv('DEMO_ADMIN_PASSWORD') or getpass('Demo admin password: ')
        user = User(username=email.lower(), email=email.lower(), first_name='Alex', last_name='Morgan', is_staff=True, is_superuser=True)
        try:
            validate_password(password, user)
        except ValidationError as error:
            raise CommandError(' '.join(error.messages)) from error
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS('Demo administrator created.'))
