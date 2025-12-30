from rest_framework import serializers
from schools.models import School
from academics.models import StudentProfile, ClassRoom
from .models import FeeStructure, Payment, FeeCategory, StudentFeeAssignment, FeeCollection, FeeSlip

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ['id', 'name', 'address']

class FeeStructureSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)
    category = serializers.PrimaryKeyRelatedField(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source='category', queryset=FeeCategory.objects.all(), write_only=True, allow_null=True, required=False)
    # Accept classroom by id on writes; expose full classroom id on reads via the model field
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True, required=True)

    class Meta:
        model = FeeStructure
        fields = ['id', 'school', 'school_id', 'category', 'category_id', 'classroom', 'classroom_id', 'amount', 'frequency', 'due_day', 'late_fee_amount', 'late_fee_after_days', 'is_active', 'academic_year']

    def validate(self, attrs):
        school = attrs.get('school') or getattr(self.instance, 'school', None)
        classroom = attrs.get('classroom') or getattr(self.instance, 'classroom', None)
        if classroom is None:
            raise serializers.ValidationError({'classroom_id': 'Classroom is required for fee structures.'})
        # Ensure classroom belongs to the same school
        cls_school = getattr(classroom, 'school', None)
        if school and cls_school and cls_school != school:
            raise serializers.ValidationError({'classroom_id': 'Selected classroom does not belong to the provided school.'})
        return attrs

class PaymentSerializer(serializers.ModelSerializer):
    # Read-only nested references
    student = serializers.PrimaryKeyRelatedField(read_only=True)
    fee_assignment = serializers.PrimaryKeyRelatedField(read_only=True)

    # Write-only ids
    student_id = serializers.PrimaryKeyRelatedField(source='student', queryset=StudentProfile.objects.all(), write_only=True)
    fee_assignment_id = serializers.PrimaryKeyRelatedField(source='fee_assignment', queryset=StudentFeeAssignment.objects.all(), write_only=True, allow_null=True, required=False)

    class Meta:
        model = Payment
        fields = [
            'id', 'student', 'student_id',
            'fee_assignment', 'fee_assignment_id',
            'amount', 'payment_method', 'payment_status', 'payment_date',
            'reference', 'transaction_id', 'receipt_number',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'receipt_number', 'created_at', 'updated_at', 'student', 'fee_assignment']


class FeeCategorySerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)

    class Meta:
        model = FeeCategory
        fields = ['id', 'school', 'school_id', 'name', 'fee_type', 'description', 'is_mandatory']


class StudentFeeAssignmentSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(source='student', queryset=StudentProfile.objects.all(), write_only=True)
    fee_structure = FeeStructureSerializer(read_only=True)
    fee_structure_id = serializers.PrimaryKeyRelatedField(source='fee_structure', queryset=FeeStructure.objects.all(), write_only=True)

    class Meta:
        model = StudentFeeAssignment
        fields = [
            'id', 'student', 'student_id', 'fee_structure', 'fee_structure_id',
            'custom_amount', 'discount_percentage', 'discount_reason',
            'is_waived', 'waiver_reason', 'assigned_date'
        ]

    def validate(self, attrs):
        student = attrs.get('student') or getattr(self.instance, 'student', None)
        fs = attrs.get('fee_structure') or getattr(self.instance, 'fee_structure', None)
        if student is None or fs is None:
            return attrs
        s_cls = getattr(student, 'classroom', None)
        f_cls = getattr(fs, 'classroom', None)
        if s_cls and f_cls and s_cls.pk != f_cls.pk:
            raise serializers.ValidationError({'fee_structure_id': 'Fee structure classroom does not match the student\'s classroom.'})
        s_school = getattr(student, 'school', None) or getattr(getattr(s_cls, 'school', None), 'pk', None)
        f_school = getattr(fs, 'school', None)
        if s_school and f_school and getattr(s_school, 'pk', s_school) != getattr(f_school, 'pk', f_school):
            raise serializers.ValidationError({'fee_structure_id': 'Fee structure school does not match the student\'s school.'})
        return attrs


class FeeCollectionSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)

    class Meta:
        model = FeeCollection
        fields = [
            'id', 'school', 'school_id', 'classroom', 'month', 'year',
            'total_expected', 'total_collected', 'total_pending', 'collection_percentage'
        ]


class FeeSlipSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)
    student = serializers.PrimaryKeyRelatedField(read_only=True)
    student_id = serializers.PrimaryKeyRelatedField(source='student', queryset=StudentProfile.objects.all(), write_only=True)
    fee_structure = serializers.PrimaryKeyRelatedField(read_only=True)
    fee_structure_id = serializers.PrimaryKeyRelatedField(source='fee_structure', queryset=FeeStructure.objects.all(), write_only=True)

    class Meta:
        model = FeeSlip
        fields = [
            'id', 'school', 'school_id', 'classroom', 'student', 'student_id', 'fee_structure', 'fee_structure_id',
            'month', 'year', 'amount', 'amount_paid', 'status', 'due_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
