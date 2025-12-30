from rest_framework import serializers
from .models import School

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
