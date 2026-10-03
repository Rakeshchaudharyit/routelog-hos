import os
from io import BytesIO, StringIO
from tempfile import TemporaryDirectory
from unittest.mock import patch
from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APITestCase, APIClient
from .models import WorkspaceSettings

class AuthSettingsTests(APITestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username='admin',email='admin@example.com',password='Original@938!',first_name='Alex',last_name='Morgan',is_staff=True)
        self.media=TemporaryDirectory();self.addCleanup(self.media.cleanup)
        override=override_settings(MEDIA_ROOT=self.media.name);override.enable();self.addCleanup(override.disable)
    def login(self,**changes):
        return self.client.post('/api/auth/login/',{'email':'admin@example.com','password':'Original@938!',**changes},format='json')
    def admin(self): self.client.force_login(self.user)
    def change(self,current='Original@938!',new='Updated@725!'):
        return self.client.post('/api/auth/change-password/',{'current_password':current,'new_password':new},format='json')
    def image(self,fmt='PNG'):
        data=BytesIO();Image.new('RGB',(12,12),'blue').save(data,format=fmt)
        return SimpleUploadedFile('logo.'+fmt.lower(),data.getvalue(),content_type={'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp'}[fmt])
    def test_valid_login(self):
        result=self.login(email='ADMIN@example.com');self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['user']['name'],'Alex Morgan');self.assertEqual(result.json()['user']['role'],'Administrator')
        self.assertNotIn('password',result.json()['user']);self.assertTrue(self.client.cookies['sessionid']['httponly'])
    def test_invalid_email(self): self.assertEqual(self.login(email='missing@example.com').status_code,400)
    def test_invalid_password(self): self.assertEqual(self.login(password='wrong').status_code,400)
    def test_inactive_login(self):
        self.user.is_active=False;self.user.save();self.assertEqual(self.login().status_code,400)
    def test_ambiguous_email(self):
        get_user_model().objects.create_user(username='duplicate',email='ADMIN@example.com',password='Original@938!');self.assertEqual(self.login().status_code,400)
    def test_authenticated_me(self):
        self.admin();data=self.client.get('/api/auth/me/').json();self.assertEqual(data['user']['id'],self.user.pk);self.assertIn('csrf_token',data)
    def test_anonymous_me(self):
        data=self.client.get('/api/auth/me/').json();self.assertIsNone(data['user']);self.assertIn('csrf_token',data)
    def test_logout(self):
        self.admin();self.assertEqual(self.client.post('/api/auth/logout/').status_code,200);self.assertIsNone(self.client.get('/api/auth/me/').json()['user'])
    def test_change_password_keeps_session(self):
        self.admin();self.assertEqual(self.change().status_code,200);self.assertEqual(self.client.get('/api/auth/me/').json()['user']['id'],self.user.pk)
        self.user.refresh_from_db();self.assertTrue(self.user.check_password('Updated@725!'));self.assertNotEqual(self.user.password,'Updated@725!')
    def test_wrong_current_password(self):
        self.admin();self.assertEqual(self.change(current='wrong').status_code,400)
    def test_short_password(self):
        self.admin();self.assertEqual(self.change(new='short').status_code,400)
    def test_blank_password(self):
        self.admin();self.assertEqual(self.change(new='        ').status_code,400)
    def test_old_invalid_new_works(self):
        self.admin();self.change();self.client.logout();self.assertEqual(self.login().status_code,400);self.assertEqual(self.login(password='Updated@725!').status_code,200)
    def test_other_session_invalidated(self):
        other=APIClient();other.force_login(self.user);self.admin();self.change();self.assertIsNone(other.get('/api/auth/me/').json()['user'])
    def test_protected_trip(self):
        with patch('trips.views.plan_trip_service') as planner:
            self.assertEqual(self.client.post('/api/trips/plan/',{},format='json').status_code,403);planner.assert_not_called()
    def test_protected_search(self): self.assertEqual(self.client.get('/api/locations/search/',{'q':'Dallas'}).status_code,403)
    def test_password_requires_auth(self): self.assertEqual(self.change().status_code,403)
    def test_default_settings(self):
        self.admin();self.assertEqual(self.client.get('/api/settings/').json(),{'app_name':'RouteLog HOS','workspace_name':'Demo Transport','workspace_subtitle':'Fleet workspace','logo_url':None})
    def test_app_name(self):
        self.admin();self.assertEqual(self.client.patch('/api/settings/',{'app_name':'FleetPath'},format='json').json()['app_name'],'FleetPath')
    def test_workspace_name(self):
        self.admin();self.assertEqual(self.client.patch('/api/settings/',{'workspace_name':'Road Team'},format='json').json()['workspace_name'],'Road Team')
    def test_subtitle(self):
        self.admin();self.assertEqual(self.client.patch('/api/settings/',{'workspace_subtitle':'Planning'},format='json').json()['workspace_subtitle'],'Planning')
    def test_settings_survive_new_client(self):
        self.admin();self.client.patch('/api/settings/',{'app_name':'FleetPath'},format='json');other=APIClient();other.force_login(self.user);self.assertEqual(other.get('/api/settings/').json()['app_name'],'FleetPath')
    def test_anonymous_settings_rejected(self):
        self.assertEqual(self.client.patch('/api/settings/',{'app_name':'Bad'},format='json').status_code,403);self.assertEqual(self.client.get('/api/settings/').status_code,403)
    def test_non_admin_settings_rejected(self):
        self.user.is_staff=False;self.user.save();self.admin()
        for method,path in [('get','/api/settings/'),('patch','/api/settings/'),('post','/api/settings/logo/'),('delete','/api/settings/logo/')]: self.assertEqual(getattr(self.client,method)(path).status_code,403)
    def test_blank_name_rejected(self):
        self.admin();self.assertEqual(self.client.patch('/api/settings/',{'app_name':'   '},format='json').status_code,400)
    def test_image_formats(self):
        self.admin()
        for fmt in ['PNG','JPEG','WEBP']:
            response=self.client.post('/api/settings/logo/',{'logo':self.image(fmt)},format='multipart');self.assertEqual(response.status_code,200);self.assertIn('/media/workspace/logos/',response.json()['logo_url'])
            obj=WorkspaceSettings.objects.get(pk=1);self.assertTrue(obj.logo.storage.exists(obj.logo.name))
    def test_oversized_image(self):
        self.admin();upload=SimpleUploadedFile('logo.png',b'x'*(2*1024*1024+1),content_type='image/png');self.assertEqual(self.client.post('/api/settings/logo/',{'logo':upload},format='multipart').status_code,400)
    def test_svg_rejected(self):
        self.admin();upload=SimpleUploadedFile('logo.svg',b'<svg/>',content_type='image/svg+xml');self.assertEqual(self.client.post('/api/settings/logo/',{'logo':upload},format='multipart').status_code,400)
    def test_fake_image_rejected(self):
        self.admin();upload=SimpleUploadedFile('logo.png',b'not an image',content_type='image/png');self.assertEqual(self.client.post('/api/settings/logo/',{'logo':upload},format='multipart').status_code,400)
    def test_missing_logo_rejected(self):
        self.admin();self.assertEqual(self.client.post('/api/settings/logo/',{},format='multipart').status_code,400)
    def test_reset_logo_deletes_file(self):
        self.admin();self.client.post('/api/settings/logo/',{'logo':self.image()},format='multipart');obj=WorkspaceSettings.objects.get(pk=1);name=obj.logo.name;storage=obj.logo.storage
        self.assertIsNone(self.client.delete('/api/settings/logo/').json()['logo_url']);self.assertFalse(storage.exists(name))
    def test_replacement_deletes_previous_file(self):
        self.admin();self.client.post('/api/settings/logo/',{'logo':self.image()},format='multipart');obj=WorkspaceSettings.objects.get(pk=1);name=obj.logo.name
        self.client.post('/api/settings/logo/',{'logo':self.image()},format='multipart');self.assertFalse(obj.logo.storage.exists(name))
    def test_csrf_login_and_mutations(self):
        client=APIClient(enforce_csrf_checks=True);payload={'email':'admin@example.com','password':'Original@938!'}
        self.assertEqual(client.post('/api/auth/login/',payload,format='json').status_code,403)
        token=client.get('/api/auth/me/').json()['csrf_token'];result=client.post('/api/auth/login/',payload,format='json',HTTP_X_CSRFTOKEN=token);self.assertEqual(result.status_code,200);token=result.json()['csrf_token']
        self.assertEqual(client.patch('/api/settings/',{'app_name':'Secure'},format='json').status_code,403)
        self.assertEqual(client.patch('/api/settings/',{'app_name':'Secure'},format='json',HTTP_X_CSRFTOKEN=token).status_code,200);self.assertEqual(client.post('/api/auth/logout/').status_code,403)
    def test_remember_session_expiry(self):
        self.login(remember=False);self.assertTrue(self.client.session.get_expire_at_browser_close());self.client.logout();self.login(remember=True);self.assertFalse(self.client.session.get_expire_at_browser_close())
    def test_demo_command_idempotent(self):
        with patch.dict(os.environ,{'DEMO_ADMIN_EMAIL':'demo@example.com','DEMO_ADMIN_PASSWORD':'Setup@817!'}):
            call_command('create_demo_user',stdout=StringIO());call_command('create_demo_user',stdout=StringIO())
        user=get_user_model().objects.get(email='demo@example.com');self.assertTrue(user.is_superuser);self.assertTrue(user.check_password('Setup@817!'))

    def test_credentialed_cors(self):
        response=self.client.get('/api/auth/me/',HTTP_ORIGIN='http://localhost:5173')
        self.assertEqual(response['Access-Control-Allow-Origin'],'http://localhost:5173')
        self.assertEqual(response['Access-Control-Allow-Credentials'],'true')
        response=self.client.get('/api/auth/me/',HTTP_ORIGIN='https://untrusted.example')
        self.assertNotIn('Access-Control-Allow-Origin',response)

    def test_csrf_all_protected_mutations(self):
        client=APIClient(enforce_csrf_checks=True);client.force_login(self.user)
        for path,method in [('/api/auth/change-password/','post'),('/api/trips/plan/','post'),('/api/settings/logo/','post'),('/api/settings/logo/','delete')]:
            self.assertEqual(getattr(client,method)(path,{},format='json').status_code,403)

    def test_login_untrusted_origin_rejected(self):
        client=APIClient(enforce_csrf_checks=True);token=client.get('/api/auth/me/').json()['csrf_token']
        self.assertEqual(client.post('/api/auth/login/',{'email':'admin@example.com','password':'Original@938!'},format='json',HTTP_X_CSRFTOKEN=token,HTTP_ORIGIN='https://untrusted.example').status_code,403)

    def test_mislabeled_image_rejected(self):
        self.admin();upload=self.image();upload.content_type='image/jpeg'
        self.assertEqual(self.client.post('/api/settings/logo/',{'logo':upload},format='multipart').status_code,400)

    def test_profile_name_update(self):
        self.admin();response=self.client.patch('/api/auth/profile/',{'name':'Rakesh Chaudhary'},format='json')
        self.assertEqual(response.status_code,200);self.assertEqual(response.json()['user']['name'],'Rakesh Chaudhary')
        self.assertEqual(response.json()['user']['email'],'admin@example.com')

    def test_profile_name_persists(self):
        self.admin();self.client.patch('/api/auth/profile/',{'name':'Road Planner'},format='json')
        other=APIClient();other.force_login(self.user)
        self.assertEqual(other.get('/api/auth/me/').json()['user']['name'],'Road Planner')

    def test_profile_name_validation(self):
        self.admin()
        for data in [{'name':''},{'name':'   '},{'name':'a'*151},{},{'name':'Alex','email':'changed@example.com'},{'name':'Alex','is_staff':True}]:
            self.assertEqual(self.client.patch('/api/auth/profile/',data,format='json').status_code,400)

    def test_profile_requires_admin(self):
        self.assertEqual(self.client.patch('/api/auth/profile/',{'name':'Road Planner'},format='json').status_code,403)
        self.user.is_staff=False;self.user.save();self.admin()
        self.assertEqual(self.client.patch('/api/auth/profile/',{'name':'Road Planner'},format='json').status_code,403)

    def test_profile_csrf(self):
        client=APIClient(enforce_csrf_checks=True);client.force_login(self.user)
        self.assertEqual(client.patch('/api/auth/profile/',{'name':'Road Planner'},format='json').status_code,403)
