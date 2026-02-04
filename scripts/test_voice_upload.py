import os
import django
import sys
from io import BytesIO

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from users.views import VoiceUploadView
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

def run():
    # Ensure a user exists
    user = User.objects.first()
    if not user:
        user = User.objects.create_user(username='voice_tester', password='password')

    # Create a fake audio file
    audio_data = b'RIFF....WEBMFAKE'  # minimal bytes; not a real audio
    uploaded = SimpleUploadedFile('test_voice.webm', audio_data, content_type='audio/webm')

    factory = APIRequestFactory()
    request = factory.post('/api/users/voice/upload/', {'voice': uploaded}, format='multipart')
    force_authenticate(request, user=user)

    view = VoiceUploadView.as_view()
    response = view(request)
    print("Status:", response.status_code)
    print("Data:", response.data)

if __name__ == "__main__":
    run()
