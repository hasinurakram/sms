from rest_framework import serializers
from .models import Examination, Result, StudentOverallResult
from academics.serializers import StudentProfileSerializer, SubjectSerializer


class ExaminationSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)
    
    class Meta:
        model = Examination
        fields = ['id', 'school', 'name', 'exam_type', 'classroom', 'classroom_name', 'section', 'section_name', 'exam_date', 'total_marks', 'pass_marks', 'written_max', 'mcq_max', 'practical_max']


class ResultSerializer(serializers.ModelSerializer):
    student = StudentProfileSerializer(read_only=True)
    subject = SubjectSerializer(read_only=True)
    examination = ExaminationSerializer(read_only=True)
    student_roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    written_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    mcq_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    practical_marks = serializers.DecimalField(max_digits=5, decimal_places=2)
    total_obtained = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    gpa = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True)
    grade = serializers.CharField(read_only=True)
    is_passed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Result
        fields = ['id', 'examination', 'student', 'student_roll_number', 'subject', 'written_marks', 'mcq_marks', 'practical_marks', 'total_obtained', 'grade', 'gpa', 'is_passed', 'remarks']


class StudentOverallResultSerializer(serializers.ModelSerializer):
    student = StudentProfileSerializer(read_only=True)
    examination = ExaminationSerializer(read_only=True)
    student_roll_number = serializers.CharField(source='student.roll_number', read_only=True)
    
    class Meta:
        model = StudentOverallResult
        fields = ['id', 'examination', 'student', 'student_roll_number', 'total_marks_obtained', 'total_marks_possible', 'percentage', 'cgpa', 'grade', 'rank', 'is_passed', 'failed_subjects_count']
