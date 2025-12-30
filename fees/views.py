from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from .models import FeeStructure, Payment, FeeCategory, StudentFeeAssignment, FeeCollection, FeeSlip
from .serializers import (
    FeeStructureSerializer, PaymentSerializer,
    FeeCategorySerializer, StudentFeeAssignmentSerializer, FeeCollectionSerializer, FeeSlipSerializer
)
from users.permissions import AdminOrReadOnly

class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related('school','classroom','category').all()
    serializer_class = FeeStructureSerializer
    permission_classes = [AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        if school:
            qs = qs.filter(school_id=school)
        if classroom:
            qs = qs.filter(classroom_id=classroom)
        return qs

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('student__user','fee_assignment').all()
    serializer_class = PaymentSerializer
    permission_classes = [AdminOrReadOnly]
    filter_backends = []


class FeeCategoryViewSet(viewsets.ModelViewSet):
    queryset = FeeCategory.objects.select_related('school').all()
    serializer_class = FeeCategorySerializer
    permission_classes = [AdminOrReadOnly]
    filter_backends = []


class StudentFeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StudentFeeAssignment.objects.select_related('student__user','student__classroom','fee_structure__category','fee_structure__classroom','fee_structure__school').all()
    serializer_class = StudentFeeAssignmentSerializer
    permission_classes = [AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        student = self.request.query_params.get('student') or self.request.query_params.get('student_id')
        fee_structure = self.request.query_params.get('fee_structure') or self.request.query_params.get('fee_structure_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        if school:
            qs = qs.filter(fee_structure__school_id=school)
        if classroom:
            qs = qs.filter(fee_structure__classroom_id=classroom)
        if student:
            qs = qs.filter(student_id=student)
        if fee_structure:
            qs = qs.filter(fee_structure_id=fee_structure)
        return qs

    def perform_create(self, serializer):
        instance = serializer.validated_data
        student = instance.get('student')
        fs = instance.get('fee_structure')
        if student and fs:
            s_cls = getattr(student, 'classroom', None)
            f_cls = getattr(fs, 'classroom', None)
            if s_cls and f_cls and s_cls.pk != f_cls.pk:
                raise ValidationError({'fee_structure_id': 'Fee structure classroom does not match the student\'s classroom.'})
            s_school = getattr(student, 'school', None) or getattr(getattr(s_cls, 'school', None), 'pk', None)
            f_school = getattr(fs, 'school', None)
            if s_school and f_school and getattr(s_school, 'pk', s_school) != getattr(f_school, 'pk', f_school):
                raise ValidationError({'fee_structure_id': 'Fee structure school does not match the student\'s school.'})
        serializer.save()


class FeeCollectionViewSet(viewsets.ModelViewSet):
    queryset = FeeCollection.objects.select_related('school','classroom').all()
    serializer_class = FeeCollectionSerializer
    permission_classes = [AdminOrReadOnly]
    filter_backends = []


class FeeSlipViewSet(viewsets.ModelViewSet):
    queryset = FeeSlip.objects.select_related('school','classroom','student__user','fee_structure').all()
    serializer_class = FeeSlipSerializer
    permission_classes = [AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        student = self.request.query_params.get('student') or self.request.query_params.get('student_id')
        fs = self.request.query_params.get('fee_structure') or self.request.query_params.get('fee_structure_id')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if school:
            qs = qs.filter(school_id=school)
        if classroom:
            qs = qs.filter(classroom_id=classroom)
        if student:
            qs = qs.filter(student_id=student)
        if fs:
            qs = qs.filter(fee_structure_id=fs)
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        return qs
