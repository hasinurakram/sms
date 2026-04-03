from rest_framework import serializers
from django.core.files.base import ContentFile
import base64
import re
from .models import School, Advertisement

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'address', 'logo']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        try:
            logo = getattr(instance, 'logo', None)
            if logo:
                request = self.context.get('request')
                url = getattr(logo, 'url', None) or str(logo)
                if request:
                    data['logo'] = request.build_absolute_uri(url)
                else:
                    data['logo'] = url
        except Exception:
            pass
        return data


class AdvertisementSerializer(serializers.ModelSerializer):
    media_url = serializers.SerializerMethodField()

    class Meta:
        model = Advertisement
        fields = ['id', 'school', 'text', 'link', 'type', 'media', 'media_url', 'created_at']
        extra_kwargs = {
            'media': {'write_only': True, 'required': False}
        }

    def get_media_url(self, obj):
        try:
            request = self.context.get('request')
            if obj.media:
                url = getattr(obj.media, 'url', None) or str(obj.media)
                if request:
                    return request.build_absolute_uri(url)
                
                # Fallback to SITE_BASE_URL if available
                from django.conf import settings
                base = getattr(settings, 'SITE_BASE_URL', '').rstrip('/')
                if base:
                    return f"{base}{url if url.startswith('/') else '/' + url}"
                return url
        except Exception:
            pass
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        media_file = validated_data.get('media')
        # Support JSON body with media_data_url (data URL)
        if not media_file and request:
            try:
                media_data_url = request.data.get('media_data_url')
                if media_data_url and isinstance(media_data_url, str):
                    match = re.match(r'^data:(.+);base64,(.*)$', media_data_url)
                    if match:
                        mime = match.group(1)
                        b64 = match.group(2)
                        ext = (mime.split('/')[-1] or 'bin')
                        content = ContentFile(base64.b64decode(b64), name=f"ad_{validated_data.get('school').id}_{validated_data.get('type','image')}.{ext}")
                        validated_data['media'] = content
            except Exception:
                # If decoding fails, proceed without media to let validation raise
                pass
        return super().create(validated_data)
