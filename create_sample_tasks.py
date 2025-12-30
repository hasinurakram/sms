"""
Script to create sample tasks for committee members
Run this after ensuring you have committee members in your database
"""
import os
import django
import sys
from datetime import date, timedelta

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Task, Profile, User
from schools.models import School

def create_sample_tasks():
    """Create sample tasks for committee members"""
    
    # Get all committee members
    committee_profiles = Profile.objects.filter(role='committee').select_related('user', 'school')
    
    if not committee_profiles.exists():
        print("❌ No committee members found. Please create committee members first.")
        return
    
    print(f"✅ Found {committee_profiles.count()} committee member(s)")
    
    # Sample task templates
    task_templates = [
        {
            'title': 'Organize Annual Sports Day',
            'description': 'Plan and coordinate the annual sports day event including venue booking, equipment arrangement, and volunteer coordination.',
            'priority': 'high',
            'status': 'in_progress',
            'days_offset': 30
        },
        {
            'title': 'Review School Budget',
            'description': 'Review and approve the quarterly school budget allocation for various departments.',
            'priority': 'urgent',
            'status': 'pending',
            'days_offset': 7
        },
        {
            'title': 'Conduct Parent-Teacher Meeting',
            'description': 'Organize and facilitate the monthly parent-teacher meeting to discuss student progress.',
            'priority': 'medium',
            'status': 'pending',
            'days_offset': 14
        },
        {
            'title': 'Infrastructure Maintenance Check',
            'description': 'Inspect school buildings, classrooms, and facilities for maintenance requirements.',
            'priority': 'medium',
            'status': 'completed',
            'days_offset': -5
        },
        {
            'title': 'Update School Policies',
            'description': 'Review and update school policies and guidelines based on new educational regulations.',
            'priority': 'low',
            'status': 'pending',
            'days_offset': 60
        },
    ]
    
    created_count = 0
    
    for profile in committee_profiles:
        user = profile.user
        school = profile.school
        
        if not school:
            print(f"⚠️  Skipping {user.username} - No school assigned")
            continue
        
        # Create 2-4 tasks for each committee member
        import random
        num_tasks = random.randint(2, 4)
        selected_tasks = random.sample(task_templates, min(num_tasks, len(task_templates)))
        
        for task_data in selected_tasks:
            due_date = date.today() + timedelta(days=task_data['days_offset'])
            
            task, created = Task.objects.get_or_create(
                title=task_data['title'],
                assigned_to=user,
                school=school,
                defaults={
                    'description': task_data['description'],
                    'priority': task_data['priority'],
                    'status': task_data['status'],
                    'due_date': due_date,
                    'created_by': user  # Self-assigned for demo
                }
            )
            
            if created:
                created_count += 1
                print(f"✅ Created task: '{task.title}' for {user.get_full_name() or user.username}")
            else:
                print(f"ℹ️  Task already exists: '{task.title}' for {user.get_full_name() or user.username}")
    
    print(f"\n🎉 Successfully created {created_count} new task(s)!")
    
    # Show summary
    print("\n📊 Task Summary by Committee Member:")
    for profile in committee_profiles:
        task_count = Task.objects.filter(assigned_to=profile.user, school=profile.school).count()
        print(f"   • {profile.user.get_full_name() or profile.user.username}: {task_count} task(s)")

if __name__ == '__main__':
    print("🚀 Creating sample tasks for committee members...\n")
    create_sample_tasks()
