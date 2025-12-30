from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FeeStructureViewSet, PaymentViewSet, FeeCategoryViewSet, StudentFeeAssignmentViewSet, FeeCollectionViewSet, FeeSlipViewSet

router = DefaultRouter()
router.register('fees', FeeStructureViewSet)
router.register('payments', PaymentViewSet)
router.register('categories', FeeCategoryViewSet)
router.register('assignments', StudentFeeAssignmentViewSet)
router.register('collections', FeeCollectionViewSet)
router.register('slips', FeeSlipViewSet)

urlpatterns = [path('', include(router.urls))]
