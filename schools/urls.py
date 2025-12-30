from django.urls import path, include
from .views import SchoolViewSet, dashboard_stats
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'schools', SchoolViewSet)

urlpatterns = [
    path('dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    path('', include(router.urls)),   # <-- এখানে router.urls include হচ্ছে
    path('dashboard-stats/', dashboard_stats, name='dashboard-stats'),
]


