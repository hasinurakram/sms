from django.urls import path, include
from .views import SchoolViewSet, dashboard_stats, AdvertisementViewSet, AdvertisementBySchool, AdvertisementBulk
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'schools', SchoolViewSet)
router.register(r'ads', AdvertisementViewSet, basename='ads')

urlpatterns = [
    path('dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    path('', include(router.urls)),   # <-- এখানে router.urls include হচ্ছে
    path('dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    # Ads convenience endpoints
    path('schools/<int:school_id>/ads/', AdvertisementBySchool.as_view(), name='school-ads'),
    path('ads/bulk/', AdvertisementBulk.as_view(), name='ads-bulk'),
]


