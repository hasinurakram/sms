from .models import Profile, User, AssistantLog, AssistantMemory, AIChatMessage, AssistantKnowledge
from schools.models import School
from .ai_engine import SoftwareAI
from academics.models import ClassRoom, Section, StudentProfile, Subject, TeacherAssignment
from attendance.models import AttendanceRecord
from fees.models import FeeStructure, StudentFeeAssignment, Payment
from fees.models import FeeSlip
from results.models import Examination, Result, StudentOverallResult
from django.db.models import Q, Sum, Avg, Max, Count
import re
import datetime
import json

class AssistantLogic:
    def __init__(self, request, school_id=None):
        self.request = request
        self.user = request.user
        self.school_id = school_id or getattr(request.user.profile, 'school_id', None)
        
    def get_response(self, query_text, extra_params=None):
        q = (query_text or '').strip()
        ql = q.lower()
        school_id = self.school_id
        request = self.request
        params = extra_params or {}
        
        def search_knowledge_base(query):
            # Search in AssistantKnowledge for this school
            words = [w for w in re.split(r'[\s,\?\!।]+', query.lower()) if len(w) > 1]
            if not words: return None
            
            stop_words = ['আমাদের', 'স্কুলের', 'স্কুলে', 'আছে', 'হলো', 'নাম', 'কী', 'কি', 'জান', 'জানো', 'বলো', 'দাও']
            significant_words = [w for w in words if w not in stop_words]
            search_words = significant_words if significant_words else words
            
            q_obj = Q()
            for w in search_words:
                q_obj |= Q(fact__icontains=w)
                
            matches = AssistantKnowledge.objects.filter(school_id=school_id).filter(q_obj).order_by('-created_at')[:3]
            
            if matches.exists():
                text = "আমার মেমোরি থেকে পাওয়া তথ্য:\n"
                found = False
                for m in matches:
                    if significant_words:
                        if any(sw in m.fact.lower() for sw in significant_words):
                            text += f"- {m.fact}\n"
                            found = True
                    else:
                        text += f"- {m.fact}\n"
                        found = True
                if found: return {'text': text}
            return None

        classroom_id = params.get('classroom')
        section_id = params.get('section')
        exam_type = (params.get('exam_type') or '').strip()

        def resolve_classroom():
            if classroom_id: return classroom_id, None
            num = None
            m = re.search(r'(class|ক্লাস|শ্রেণি)\s*([0-9]+)', ql)
            if m: num = m.group(2)
            if not num:
                m_alt = re.search(r'([0-9০-৯]+)\s*(?:ষ্ঠ|তম|th|য়)?\s*(class|ক্লাস|শ্রেণি)', ql)
                if m_alt:
                    bn2en = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'}
                    num = ''.join(bn2en.get(ch, ch) for ch in m_alt.group(1))
            if not num:
                words_to_num = {'one': '1','two': '2','three': '3','four': '4','five': '5','six': '6','seven': '7','eight': '8','nine': '9','ten': '10',
                                'সিক্স': '6','সেভেন': '7','এইট': '8','নাইন': '9','টেন': '10','ষষ্ঠ': '6','সপ্তম': '7','অষ্টম': '8','নবম': '9','দশম': '10',
                                'প্রথম': '1', 'দ্বিতীয়': '2', 'তৃতীয়': '3', 'চতুর্থ': '4', 'পঞ্চম': '5', 'একাদশ': '11', 'দ্বাদশ': '12'}
                for w, n in words_to_num.items():
                    if w in ql: num = n; break
            if not num:
                m_any = re.search(r'([0-9০-৯]+)', ql)
                if m_any:
                    bn2en = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'}
                    num = ''.join(bn2en.get(ch, ch) for ch in m_any.group(1))
            
            qs = ClassRoom.objects.filter(school_id=school_id) if school_id else ClassRoom.objects.all()
            if num:
                digit_to_bn = {'1': 'প্রথম', '2': 'দ্বিতীয়', '3': 'তৃতীয়', '4': 'চতুর্থ', '5': 'পঞ্চম', '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম', '11': 'একাদশ', '12': 'দ্বাদশ'}
                digit_to_en = {'1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven', '12': 'twelve'}
                candidates = [num]
                if num in digit_to_bn: candidates.append(digit_to_bn[num])
                if num in digit_to_en: candidates.append(digit_to_en[num])
                q_obj = Q()
                for c in candidates: q_obj |= Q(name__icontains=c)
                cls = qs.filter(q_obj).order_by('id').first()
                if cls: return str(cls.id), cls.name
            return None, None

        def resolve_section():
            if section_id: return section_id, None
            val = None
            m0 = re.search(r'(class|ক্লাস|শ্রেণি)\s*([0-9০-৯]+)\s*([a-zA-Zঅ-হ])', ql)
            if m0: val = m0.group(3)
            m1 = re.search(r'(section|সেকশন|শাখা)\s*([a-zA-Zঅ-হ]+)', ql)
            if m1: val = m1.group(2)
            if not val:
                m2 = re.search(r'([a-zA-Zঅ-হ]+)\s*(section|সেকশন|শাখা)', ql)
                if m2: val = m2.group(1)
            if not val: return None, None
            bn_map = {'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D', 'এ': 'A'}
            candidates = [val.strip()]
            if val.strip() in bn_map: candidates.append(bn_map[val.strip()])
            target_classroom_id = classroom_id or resolve_classroom()[0]
            qs = Section.objects.filter(classroom__school_id=school_id) if school_id else Section.objects.all()
            if target_classroom_id: qs = qs.filter(classroom_id=target_classroom_id)
            sec = None
            for v in candidates:
                sec = qs.filter(name__iexact=v).order_by('id').first() or qs.filter(name__icontains=v).order_by('id').first()
                if sec: break
            if sec: return str(sec.id), sec.name
            return None, None

        def intent():
            if any(w in ql for w in ['hello', 'hi', 'salam', 'সালাম', 'আদাব', 'হাই', 'হ্যালো', 'hey', 'start', 'শুরু']): return 'greeting'
            if any(w in ql for w in ['kemon', 'kmn', 'how are', 'কেমন', 'খবর', 'obostha']): return 'chat_status'
            if any(w in ql for w in ['thanks', 'thank', 'dhonnobad', 'ধন্যবাদ']): return 'chat_thanks'
            if any(w in ql for w in ['smart', 'intelligent', 'buddhiman', 'বুদ্ধিমান']): return 'chat_compliment'
            if any(w in ql for w in ['bye', 'goodbye', 'allah hafez', 'বিদায়']): return 'chat_bye'
            
            if any(w in ql for w in ['কে তৈরি', 'বানিয়েছে', 'created you', 'who made', 'developer']): return 'chat_creator'
            if any(w in ql for w in ['তোমার নাম', 'your name', 'name is']) or (('নাম কি' in ql or 'কী নাম' in ql) and any(w in ql for w in ['তোমার', 'আপনার', 'তুমি', 'আপনি'])): return 'chat_name'
            
            if any(w in ql for w in ['কোথায়', 'অবস্থিত', 'ঠিকানা', 'location', 'address']) and any(w in ql for w in ['স্কুল', 'school']): return 'school_info_location'
            if any(w in ql for w in ['কতটি', 'কয়টি', 'কয়টি', 'কতগুলো']) and any(w in ql for w in ['শ্রেণি', 'শ্রেণী', 'class', 'ক্লাস']): return 'school_info_class_count'
            
            if any(w in ql for w in ['তারিখ', 'date']): return 'chat_date'
            if (any(w in ql for w in ['কয়টা', 'বাজে', 'সময়', 'time', 'কয়টা']) or (('কয়টি' in ql or 'কয়টি' in ql) and 'বাজে' in ql)) and not any(w in ql for w in ['ভবন', 'রুম', 'ছাত্র', 'শিক্ষক']):
                return 'chat_time'

            if any(w in ql for w in ['জান', 'জানো', 'স্মৃতি', 'তথ্য', 'information']) and any(w in ql for w in ['স্কুল', 'school', 'কি কি', 'কী কী']):
                return 'assistant_knowledge'
            
            if any(w in ql for w in ['কি কি', 'কী কী', 'কি করতে', 'পারো', 'ক্ষমতা', 'capabilities', 'help']):
                return 'assistant_capabilities'

            if any(w in ql for w in ['blood', 'রক্ত', 'ব্লাড']) and any(w in ql for w in ['count', 'কতজন', 'কয়জন', 'কয়জন', 'সংখ্যা', 'how many', 'total', 'মোট']): return 'blood_group_count'
            if any(w in ql for w in ['blood', 'রক্ত', 'ব্লাড']) and any(w in ql for w in ['most', 'max', 'highest', 'বেশি', 'সর্বোচ্চ']): return 'blood_group_max'
            if any(w in ql for w in ['blood', 'রক্ত', 'ব্লাড']) and any(w in ql for w in ['name', 'নাম', 'list', 'তালিকা', 'দাও', 'dao', 'give', 'প্রয়োজন', 'দরকার', 'need', 'খুঁজছি', 'চাই']): return 'blood_group_list'
            
            if any(w in ql for w in ['attendance', 'এটেনড্যান্স', 'উপস্থিতি', 'হাজিরা']):
                if any(w in ql for w in ['হয়েছে', 'নিয়েছে', 'কোন', 'কোথায়', 'নিছে', 'হয়নি', 'বাকি']): return 'attendance_daily_status'
                return 'attendance_monthly' if any(w in ql for w in ['monthly', 'মাসিক', 'month', 'মাস']) else 'attendance_daily'
            
            if any(w in ql for w in ['নাম্বার', 'নম্বর', 'নাম', 'মোবাইল', 'ফোন', 'phone', 'mobile', 'details', 'বিস্তারিত']) and any(w in ql for w in ['তার', 'তাদের', 'ওর', 'কাদের', 'দাও', 'বলো', 'show', 'give']):
                return 'entity_details_followup'
            
            if any(w in ql for w in ['teacher', 'শিক্ষক', 'টিচার']) and any(w in ql for w in ['কে কে', 'কারা', 'আছে']):
                return 'teacher_subject_search'
            
            if any(w in ql for w in ['class', 'ক্লাস', 'শ্রেণি']) and any(w in ql for w in ['most', 'max', 'highest', 'বেশি', 'সর্বোচ্চ']):
                return 'school_counts_max_class'
            if any(w in ql for w in ['class', 'ক্লাস', 'শ্রেণি']) and any(w in ql for w in ['least', 'min', 'lowest', 'কম', 'সর্বনিম্ন']):
                return 'school_counts_min_class'
            
            if any(w in ql for w in ['fee', 'fees', 'ফি', 'বেতন', 'collection', 'কালেকশন']): return 'fees_collection'
            if any(w in ql for w in ['বকেয়া', 'বাকি', 'due', 'পরিশোধ', 'বকেয়া', 'পেমেন্ট']) or ('fee' in ql and 'due' in ql): return 'fees_due'
            
            if any(w in ql for w in ['নামে', 'নামের', 'নাম']) and any(w in ql for w in ['স্টুডেন্ট', 'শিক্ষার্থী', 'ছাত্র', 'ছাত্রী', 'কে কে', 'কারা', 'কয়জন', 'কতজন', 'কয়জন']):
                return 'student_search_name'
            
            if any(w in ql for w in ['বংশ', 'বংশের', 'সারনেম', 'surname', 'টাইটেল']) or any(w in ql for w in ['সূত্রধর', 'শীল', 'দাস', 'মজুমদার', 'পাটওয়ারী', 'চৌধুরী']):
                return 'student_search_surname'
            
            entity_tokens = ['student', 'students', 'স্টুডেন্ট', 'স্টুডেন্টস', 'ছাত্র', 'ছাত্রী', 'ছাত্রছাত্রী', 'শিক্ষার্থী', 'teacher', 'শিক্ষক']
            count_tokens = ['কতজন', 'কয়জন', 'কয়জন', 'মোট', 'count', 'সংখ্যা', 'how many', 'total', 'কত', 'কতো', 'কতগুলো', 'কতগুলি', 'কয়টি', 'কয়টি']
            
            has_results_words = any(w in ql for w in ['result', 'রেজাল্ট', 'পরীক্ষা', 'exam', 'examination'])
            is_gender_query = any(w in ql for w in ['ছেলে', 'মেয়ে', 'মেয়ে', 'ছাত্র', 'ছাত্রী', 'boy', 'girl', 'male', 'female'])
            
            if any(w in ql for w in entity_tokens + ['ছেলে', 'মেয়ে', 'মেয়ে']) and (any(w in ql for w in count_tokens) or resolve_classroom()[0] or is_gender_query) and not has_results_words:
                return 'school_counts'
            if any(w in ql for w in ['roll', 'রোল', 'রোল নাম্বার', 'রোল নম্বর', 'roll number']):
                if re.search(r'(roll|রোল|রোল নাম্বার|রোল নম্বর)\s*([0-9০-৯]+)', ql): return 'student_result'
            if any(w in ql for w in ['১ম', 'প্রথম', 'first', 'topper', 'টপার', 'top']): return 'results_topper'
            
            if has_results_words:
                if any(w in ql for w in ['year', 'বছর', 'সাল']): return 'results_years'
                if any(w in ql for w in ['কোন', 'কোন কোন', 'তালিকা', 'list']) and any(w in ql for w in ['class', 'ক্লাস', 'শ্রেণি']): return 'results_class_list'
                if any(w in ql for w in ['কোন', 'কোন কোন', 'তালিকা', 'list']): return 'results_exams_list'
                return 'results'
            
            if (('মেনু' in ql or 'menu' in ql) and any(w in ql for w in ['স্কুল', 'school'])) or any(w in ql for w in ['স্কুল মেনু', 'school menu']): return 'school_menu'
            
            # Catch-all for very short name queries or just names
            if len(ql.split()) <= 3:
                # Check if it looks like a name (not in our stop words)
                stop_words = ['হ্যালো', 'হাই', 'কেমন', 'ধন্যবাদ', 'বিদায়', 'সালাম', 'আদাব', 'হ্যাঁ', 'না', 'বলো', 'দাও', 'কি', 'কী', 'কে', 'কই']
                if not any(w in ql for w in stop_words):
                    return 'student_search_name'
            
            if any(w in ql for w in ['দুদু', 'খাও', 'পাগল', 'গাধা', 'বলদ', 'stupid', 'mad', 'eat']): return 'chat_weird'
            
            return 'ai_fallback'

        it = intent()
        
        if it == 'ai_fallback':
            kb_resp = search_knowledge_base(q)
            if kb_resp: return kb_resp
            school_data_keywords = ['হাজিরা', 'উপস্থিতি', 'রেজাল্ট', 'রোল', 'শিক্ষক', 'ছাত্র', 'বেতন', 'ফি', 'বকেয়া', 'রক্ত', 'ব্লাড', 'স্কুল', 'বিদ্যালয়', 'প্রতিষ্ঠাতা', 'হেডমাস্টার', 'প্রধান শিক্ষক', 'ভবন', 'প্রতিষ্ঠা', 'ক্যাম্পাস', 'মাঠ', 'শিক্ষা', 'মেনু']
            if any(w in ql for w in school_data_keywords):
                return {'text': 'দুঃখিত, এই বিষয়টি সম্পর্কে আমার ডাটাবেসে বা মেমোরিতে কোনো তথ্য নেই। আমাকে সঠিক তথ্য দিলে আমি তা মনে রাখতে পারব।'}
            return None

        # Logic Handlers
        if it == 'blood_group_count' or it == 'blood_group_list':
            bg_map = [('ab positive', 'AB+'), ('ab negative', 'AB-'), ('a positive', 'A+'), ('a negative', 'A-'), ('b positive', 'B+'), ('b negative', 'B-'), ('o positive', 'O+'), ('o negative', 'O-'),
                      ('এবি পজেটিভ', 'AB+'), ('এবি নেগেটিভ', 'AB-'), ('এ পজেটিভ', 'A+'), ('এ নেগেটিভ', 'A-'), ('বি পজেটিভ', 'B+'), ('বি নেগেটিভ', 'B-'), ('ও পজেটিভ', 'O+'), ('ও নেগেটিভ', 'O-'),
                      ('এবি পজিটিভ', 'AB+'), ('এবি নেগেটিভ', 'AB-'), ('এ পজিটিভ', 'A+'), ('এ নেগেটিভ', 'A-'), ('বি পজিটিভ', 'B+'), ('বি নেগেটিভ', 'B-'), ('ও পজিটিভ', 'O+'), ('ও নেগেটিভ', 'O-'),
                      ('ab+', 'AB+'), ('ab-', 'AB-'), ('a+', 'A+'), ('a-', 'A-'), ('b+', 'B+'), ('b-', 'B-'), ('o+', 'O+'), ('o-', 'O-')]
            bg = next((v for k, v in bg_map if k in ql), None)
            
            # Additional check for common Bengali phrasing like "বি পজিটিভ"
            if not bg:
                for k, v in bg_map:
                    if k in ql:
                        bg = v
                        break
            
            if not bg:
                session_id = params.get('session_id')
                if session_id:
                    last_msgs = AIChatMessage.objects.filter(session_id=session_id, role='user').exclude(content=query_text).order_by('-timestamp')[:3]
                    for msg in last_msgs:
                        bg = next((v for k, v in bg_map if k in msg.content.lower()), None)
                        if bg: break
            
            if not bg: return {'text': 'রক্তের গ্রুপ বুঝতে পারিনি।'}
            qs_p = Profile.objects.filter(blood_group=bg)
            qs_s = StudentProfile.objects.filter(blood_group=bg)
            if school_id:
                qs_p = qs_p.filter(school_id=school_id)
                qs_s = qs_s.filter(school_id=school_id)
            uids = set(qs_p.values_list('user_id', flat=True))
            suids = set(qs_s.values_list('user_id', flat=True))
            all_uids = uids.union(suids)
            
            if it == 'blood_group_count':
                user_roles = {}
                for p in qs_p: user_roles[p.user_id] = p.role
                for uid in suids:
                    if uid not in user_roles: user_roles[uid] = 'student'
                role_counts = {}
                for role in user_roles.values(): role_counts[role] = role_counts.get(role, 0) + 1
                role_map = {'student': 'শিক্ষার্থী', 'teacher': 'শিক্ষক', 'admin': 'অ্যাডমিন', 'parent': 'অভিভাবক'}
                details = [f"{role_map.get(r, r)}: {c}" for r, c in role_counts.items() if c > 0]
                text = f"{bg} রক্তের গ্রুপের মোট {len(all_uids)} জন পাওয়া গেছে।" + (f" ({', '.join(details)})" if details else "")
                return {'text': text}
            else:
                users_list = []
                role_map = {'student': 'শিক্ষার্থী', 'teacher': 'শিক্ষক', 'admin': 'অ্যাডমিন', 'parent': 'অভিভাবক'}
                for u in User.objects.filter(id__in=all_uids):
                    p = Profile.objects.filter(user=u).first()
                    sp = StudentProfile.objects.filter(user=u).first()
                    role_key = p.role if p else ('student' if sp else 'unknown')
                    user_info = {'name': u.get_full_name() or u.username, 'phone': u.phone_number, 'role': role_map.get(role_key, role_key)}
                    if sp: user_info.update({'class': sp.classroom.name if sp.classroom else 'N/A', 'roll': sp.roll_number or 'N/A'})
                    users_list.append(user_info)
                
                if len(users_list) == 1:
                    u = users_list[0]
                    text = f"{bg} রক্তের গ্রুপের {u['role']} পাওয়া গেছে:\n**নাম:** {u['name']}\n"
                    if 'class' in u: text += f"**শ্রেণি:** {u['class']}, **রোল:** {u['roll']}\n"
                    text += f"**মোবাইল:** {u['phone'] or 'নেই'}"
                    return {'text': text, 'users_list': users_list}
                return {'text': f"{bg} রক্তের গ্রুপের তালিকা ({len(users_list)} জন):", 'users_list': users_list}

        if it == 'attendance_daily':
            qs = AttendanceRecord.objects.filter(date=datetime.date.today())
            if school_id: qs = qs.filter(school_id=school_id)
            p, a = qs.filter(present=True).count(), qs.filter(present=False).count()
            if p + a == 0: return {'text': 'আজকের হাজিরা এখনো এন্ট্রি করা হয়নি।'}
            return {'text': f'আজকের উপস্থিতি: {p} জন, অনুপস্থিত: {a} জন।', 'present': p, 'absent': a}

        if it == 'attendance_daily_status':
            qs = AttendanceRecord.objects.filter(date=datetime.date.today())
            if school_id: qs = qs.filter(school_id=school_id)
            class_ids = qs.values_list('student__classroom_id', flat=True).distinct()
            all_classes = ClassRoom.objects.filter(school_id=school_id) if school_id else ClassRoom.objects.all()
            taken_classes = all_classes.filter(id__in=class_ids)
            pending_classes = all_classes.exclude(id__in=class_ids)
            
            if any(w in ql for w in ['বাকি', 'হয়নি']):
                if not pending_classes.exists(): return {'text': 'আজকের হাজিরা সব ক্লাসেই নেওয়া শেষ হয়েছে।'}
                names = [c.name for c in pending_classes]
                return {'text': f"আজকের হাজিরা এখনো নেওয়া বাকি আছে এই ক্লাসগুলোতে: **{', '.join(names)}**।"}
            
            if not taken_classes.exists(): return {'text': 'আজকের হাজিরা এখনো কোনো ক্লাসেই নেওয়া হয়নি।'}
            class_names = [c.name for c in taken_classes]
            return {'text': f"আজকের হাজিরা নেওয়া হয়েছে এই ক্লাসগুলোতে: **{', '.join(class_names)}**।"}

        if it == 'fees_due':
            year = datetime.date.today().year
            if 'গত বছর' in q or 'গতবছর' in q: year -= 1
            slips = FeeSlip.objects.filter(academic_year__contains=str(year))
            if school_id: slips = slips.filter(student__school_id=school_id)
            if not slips.exists(): return {'text': f"দুঃখিত, {year} সালের ফি সংক্রান্ত কোনো তথ্য আমার ডাটাবেসে পাওয়া যায়নি।"}
            due_data = slips.aggregate(total_due=Sum('amount'), total_paid=Sum('amount_paid'))
            total_assigned = due_data['total_due'] or 0
            paid = due_data['total_paid'] or 0
            due = total_assigned - paid
            if any(w in ql for w in ['পরিশোধ', 'কালেকশন', 'paid']): return {'text': f"{year} সালে মোট **{paid:,.2f}** টাকা ফি পরিশোধ করা হয়েছে।"}
            if any(w in ql for w in ['বাকি', 'বকেয়া', 'due']): return {'text': f"{year} সালে মোট বকেয়া ফি এর পরিমাণ **{due:,.2f}** টাকা।"}
            return {'text': f"{year} সালে মোট পরিশোধিত ফি: **{paid:,.2f}** টাকা এবং মোট বকেয়া: **{due:,.2f}** টাকা।"}
        
        if it == 'fees_collection':
            year = datetime.date.today().year
            payments = Payment.objects.filter(payment_status='completed', payment_date__year=year)
            if school_id: payments = payments.filter(student__school_id=school_id)
            total_paid = payments.aggregate(Sum('amount'))['amount__sum'] or 0
            return {'text': f"{year} সালে এ পর্যন্ত সর্বমোট **{total_paid:,.2f}** টাকা ফি সংগ্রহ (Collection) করা হয়েছে।"}

        if it == 'greeting': return {'text': 'হ্যালো! আমি আপনাকে কীভাবে সাহায্য করতে পারি?'}
        if it == 'chat_status': return {'text': 'আমি ভালো আছি, ধন্যবাদ! আমি এই স্কুলের তথ্য ব্যবস্থাপনায় সাহায্য করার জন্য প্রস্তুত।'}
        if it == 'chat_creator': return {'text': 'আমাকে **BDapp IT Firm**-এর দক্ষ ডেভেলপাররা তৈরি করেছেন।'}
        if it == 'chat_name': return {'text': 'আমি আপনার **সফটওয়্যার অ্যাসিস্ট্যান্ট**।'}
        if it == 'chat_weird': return {'text': 'আমি একটি কৃত্রিম বুদ্ধিমত্তা, আমার মানুষের মতো খাবার বা আবেগের প্রয়োজন নেই। আমি আপনাকে স্কুলের তথ্য দিয়ে সাহায্য করতে পারি।'}
        if it == 'chat_date': return {'text': f"আজকের তারিখ হলো: **{datetime.date.today().strftime('%d/%m/%Y')}**।"}
        if it == 'chat_time': return {'text': f"এখন সময় হলো: **{datetime.datetime.now().strftime('%I:%M %p')}**।"}
        
        if it == 'school_info_location':
            school = School.objects.get(id=school_id) if school_id else School.objects.first()
            location = getattr(school, 'address', None) or getattr(school, 'location', None)
            if location: return {'text': f"**{school.name}** এর ঠিকানা হলো: {location}।"}
            return {'text': f"দুঃখিত, **{school.name}** এর অবস্থান আমার ডাটাবেসে নেই।"}

        if it == 'school_info_class_count':
            classes = ClassRoom.objects.filter(school_id=school_id) if school_id else ClassRoom.objects.all()
            return {'text': f"এই স্কুলে মোট **{classes.count()}** টি শ্রেণি রয়েছে।"}
        
        if it == 'student_search_name':
            # Extract name from query. 
            # Bengali regex for characters, vowels, and modifiers
            bn_name_regex = r'([অ-হ\u09BE-\u09D7\s]+)\s*(?:নামে|নামের)'
            name_match = re.search(bn_name_regex, q)
            if not name_match: name_match = re.search(r'([a-zA-Z\s]+)\s*(?:name|named)', ql)
            
            # If no "নামে" or "named" context, use the query text after removing common words
            if name_match:
                search_name = name_match.group(1).strip()
            else:
                # Clean query from common tokens to find the potential name
                clean_q = q
                remove_list = ['স্টুডেন্ট', 'শিক্ষার্থী', 'ছাত্র', 'ছাত্রী', 'কয়জন', 'কতজন', 'কয়জন', 'আছে', '?', '!', '।', 'ছেলে', 'মেয়ে', 'মেয়ে', 'দশম', 'অষ্টম', 'নবম', 'সপ্তম', 'ষষ্ঠ', 'পঞ্চম', 'চতুর্থ', 'তৃতীয়', 'দ্বিতীয়', 'প্রথম', 'শ্রেণি', 'শ্রেণী', 'ক্লাস', 'শাখা', 'সেকশন', 'নামে', 'নামের', 'নাম', 'যারা', 'আছে', 'কে কে', 'কারা', 'মধ্যে', 'ভিতরে', 'ভিতর', 'খুঁজছি', 'খুজছি', 'চাই', 'তথ্য', 'বিস্তারিত', 'দাও', 'বলো', 'দেখাও']
                for word in remove_list:
                    clean_q = clean_q.replace(word, '')
                search_name = clean_q.strip()
            
            if not search_name or len(search_name) < 2:
                # Final attempt: if query is very short, it might be just the name
                if len(q.split()) <= 2:
                    search_name = q.strip()
                else:
                    return {'text': 'আপনি কার কথা বলছেন তা বুঝতে পারিনি। দয়া করে শিক্ষার্থীর নাম উল্লেখ করুন।'}
            
            # Flexible name search: match full name or parts
            name_parts = search_name.split()
            q_obj = Q()
            if len(name_parts) > 1:
                # Try to match full name across first and last name
                q_obj |= (Q(user__first_name__icontains=name_parts[0]) & Q(user__last_name__icontains=name_parts[-1]))
            
            # Also match each part in either field
            for part in name_parts:
                q_obj |= Q(user__first_name__icontains=part) | Q(user__last_name__icontains=part) | Q(user__username__icontains=part)
            
            students = StudentProfile.objects.filter(q_obj)
            if school_id: students = students.filter(school_id=school_id)
            
            # Apply class/section filters if mentioned in query
            cid, cname = resolve_classroom()
            sid, sname = resolve_section()
            if cid: students = students.filter(classroom_id=cid)
            if sid: students = students.filter(section_id=sid)
            
            # Apply gender filter if mentioned
            is_boy = any(w in ql for w in ['ছেলে', 'ছাত্র', 'boy'])
            is_girl = any(w in ql for w in ['মেয়ে', 'মেয়ে', 'ছাত্রী', 'girl'])
            if is_boy and not is_girl: students = students.filter(gender__iexact='male')
            elif is_girl and not is_boy: students = students.filter(gender__iexact='female')
            
            count = students.count()
            loc_parts = [p for p in [cname, sname] if p]
            loc_text = f"**{' '.join(loc_parts)}**" if loc_parts else ""
            
            if count == 0:
                return {'text': f"দুঃখিত, {loc_text + ' ' if loc_text else ''}**{search_name}** নামে কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি।"}
            
            if count == 1:
                s = students.first()
                text = f"**{search_name}** নামে একজন শিক্ষার্থী পাওয়া গেছে:\n"
                text += f"- নাম: {s.user.get_full_name() or s.user.username}\n"
                text += f"- শ্রেণি: {s.classroom.name if s.classroom else 'N/A'}, শাখা: {s.section.name if s.section else 'N/A'}, রোল: {s.roll_number or 'N/A'}"
                return {'text': text}
            
            text = f"{loc_text + ' ' if loc_text else ''}**{search_name}** নামে মোট **{count}** জন শিক্ষার্থী পাওয়া গেছে।\n"
            for s in students[:5]:
                text += f"- {s.user.get_full_name()} ({s.classroom.name if s.classroom else 'N/A'}, রোল: {s.roll_number})\n"
            if count > 5: text += "...এবং আরো অনেকে।"
            return {'text': text}

        if it == 'student_search_surname':
            surname_list = ['সূত্রধর', 'শীল', 'দাস', 'মজুমদার', 'পাটওয়ারী', 'চৌধুরী', 'খান', 'আহমেদ', 'ইসলাম']
            target_surname = next((s for s in surname_list if s in q), None)
            
            if not target_surname:
                # If not in our list, try to extract it from "বংশের" or "সারনেম" context
                m = re.search(r'([অ-হ\u09BE-\u09D7]+)\s*(?:বংশ|বংশের|সারনেম)', q)
                if m: target_surname = m.group(1).strip()
            
            if not target_surname:
                return {'text': "আপনি কোন বংশ বা সারনেম খুঁজছেন তা বুঝতে পারছি না।"}
            
            students = StudentProfile.objects.filter(Q(user__first_name__icontains=target_surname) | Q(user__last_name__icontains=target_surname))
            if school_id: students = students.filter(school_id=school_id)
            
            count = students.count()
            if count == 0:
                return {'text': f"দুঃখিত, **{target_surname}** বংশের কোনো শিক্ষার্থী খুঁজে পাওয়া যায়নি।"}
            
            text = f"**{target_surname}** বংশের মোট **{count}** জন শিক্ষার্থী পাওয়া গেছে।"
            if count > 0:
                text += "\nতাদের বিস্তারিত জানতে 'বিস্তারিত তথ্য দাও' বলতে পারেন।"
            return {'text': text}
        
        if it == 'entity_details_followup':
            session_id = params.get('session_id')
            if not session_id: return {'text': 'দুঃখিত, আমি কার বিস্তারিত তথ্য দিব তা বুঝতে পারছি না।'}
            last_assistant_msg = AIChatMessage.objects.filter(session_id=session_id, role='assistant').order_by('-timestamp').first()
            if not last_assistant_msg: return {'text': 'দুঃখিত, কোনো পূর্ববর্তী আলোচনা খুঁজে পাওয়া যায়নি।'}
            last_content = last_assistant_msg.content
            
            # 0. Check if the last message was about student search (by name or surname)
            # Match any bold text which is likely the search term
            m_term = re.search(r'\*\*(.*?)\*\*', last_content)
            if ('নামে' in last_content or 'বংশের' in last_content or 'পাওয়া গেছে' in last_content) and m_term:
                search_term = m_term.group(1)
                
                name_parts = search_term.split()
                q_obj = Q()
                if len(name_parts) > 1:
                    q_obj |= (Q(user__first_name__icontains=name_parts[0]) & Q(user__last_name__icontains=name_parts[-1]))
                for part in name_parts:
                    q_obj |= Q(user__first_name__icontains=part) | Q(user__last_name__icontains=part) | Q(user__username__icontains=part)
                
                students = StudentProfile.objects.filter(q_obj)
                if school_id: students = students.filter(school_id=school_id)
                
                # Check if there was class context in the last message
                m_cls = re.search(r'\*\*(.*?)\*\*\s*\*\*(.*?)\*\*', last_content) # Match double bold (Class + Name)
                if m_cls:
                    cname_context = m_cls.group(1)
                    students = students.filter(classroom__name__icontains=cname_context)

                if students.exists():
                    text = f"**{search_term}** এর অধীনে থাকা শিক্ষার্থীদের বিস্তারিত তথ্য নিচে দেওয়া হলো:\n"
                    for s in students[:10]:
                        text += f"- {s.user.get_full_name()} (ক্লাস: {s.classroom.name if s.classroom else 'N/A'}, শাখা: {s.section.name if s.section else 'N/A'}, রোল: {s.roll_number})\n"
                        text += f"  মোবাইল: {s.user.phone_number or 'নেই'}\n"
                    if students.count() > 10: text += "...এবং আরো অনেকে।"
                    return {'text': text}

            if 'বিষয়ের শিক্ষকরা হলেন' in last_content:
                m = re.search(r'\*\*(.*?)\*\* বিষয়ের', last_content)
                if m:
                    subject_name = m.group(1)
                    target_subject = Subject.objects.filter(name__icontains=subject_name).filter(school_id=school_id if school_id else Q()).first()
                    if target_subject:
                        teachers = User.objects.filter(id__in=TeacherAssignment.objects.filter(subject=target_subject).values_list('teacher_id', flat=True))
                        text = f"**{target_subject.name}** বিষয়ের শিক্ষকদের মোবাইল নম্বর:\n"
                        for t in teachers: text += f"- {t.get_full_name() or t.username}: **{t.phone_number or 'নেই'}**\n"
                        return {'text': text}
                
            if 'রক্তের গ্রুপ' in last_content:
                bg_map = [('ab positive', 'AB+'), ('ab negative', 'AB-'), ('a positive', 'A+'), ('a negative', 'A-'), ('b positive', 'B+'), ('b negative', 'B-'), ('o positive', 'O+'), ('o negative', 'O-'),
                          ('ab+', 'AB+'), ('ab-', 'AB-'), ('a+', 'A+'), ('a-', 'A-'), ('b+', 'B+'), ('b-', 'B-'), ('o+', 'O+'), ('o-', 'O-')]
                bg = next((v for k, v in bg_map if k in last_content.lower()), None)
                m_cls = re.search(r'\*\*(.*?)\*\* শ্রেণি', last_content)
                if bg:
                    qs_s = StudentProfile.objects.filter(blood_group=bg)
                    if school_id: qs_s = qs_s.filter(school_id=school_id)
                    if m_cls: qs_s = qs_s.filter(classroom__name__icontains=m_cls.group(1))
                    text = f"**{bg}** রক্তের গ্রুপের তালিকা:\n"
                    for s in qs_s[:10]: text += f"- {s.user.get_full_name()} (ক্লাস: {s.classroom.name if s.classroom else 'N/A'}, রোল: {s.roll_number}): **{s.user.phone_number or 'নেই'}**\n"
                    return {'text': text}
            
            if 'শ্রেণি-এ মোট' in last_content:
                m_cls = re.search(r'\*\*(.*?)\*\* শ্রেণি', last_content)
                if m_cls:
                    class_name = m_cls.group(1)
                    if any(w in ql for w in ['রক্তের গ্রুপ', 'blood group']):
                        counts = StudentProfile.objects.filter(classroom__name__icontains=class_name).values('blood_group').annotate(count=Count('id')).order_by('blood_group')
                        text = f"**{class_name}** শ্রেণির রক্তের গ্রুপের পরিসংখ্যান:\n"
                        for c in counts:
                            if c['blood_group']: text += f"- {c['blood_group']}: {c['count']} জন\n"
                        return {'text': text}
                    elif any(w in ql for w in ['শাখা', 'সেকশন']):
                        target_classroom = ClassRoom.objects.filter(name__icontains=class_name).filter(school_id=school_id if school_id else Q()).first()
                        if target_classroom:
                            sections = Section.objects.filter(classroom=target_classroom)
                            text = f"**{class_name}** শ্রেণির শাখার তথ্য:\n"
                            for s in sections:
                                text += f"- {s.name} শাখা: {StudentProfile.objects.filter(section=s).count()} জন শিক্ষার্থী\n"
                            return {'text': text}
            return {'text': 'দুঃখিত, আমি কার বিস্তারিত তথ্য দিব তা বুঝতে পারছি না।'}

        if it == 'teacher_subject_search':
            all_subjects = Subject.objects.filter(school_id=school_id) if school_id else Subject.objects.all()
            target_subject = next((s for s in all_subjects if s.name.lower() in ql), None)
            if not target_subject:
                bn_sub_map = {'গণিত': 'Math', 'ইংরেজি': 'English', 'বাংলা': 'Bangla', 'বিজ্ঞান': 'Science'}
                for bn, en in bn_sub_map.items():
                    if bn in ql or en.lower() in ql:
                        target_subject = all_subjects.filter(Q(name__icontains=bn) | Q(name__icontains=en)).first()
                        if target_subject: break
            if not target_subject: return {'text': 'আপনি কোন বিষয়ের শিক্ষকের কথা বলছেন তা বুঝতে পারিনি।'}
            teachers = User.objects.filter(id__in=TeacherAssignment.objects.filter(subject=target_subject).values_list('teacher_id', flat=True))
            if not teachers.exists(): return {'text': f"দুঃখিত, ডাটাবেসে **{target_subject.name}** বিষয়ের কোনো শিক্ষক খুঁজে পাওয়া যায়নি।"}
            names = [f"{t.get_full_name() or t.username}" for t in teachers]
            return {'text': f"**{target_subject.name}** বিষয়ের শিক্ষকরা হলেন: **{', '.join(names)}**।"}

        if it == 'assistant_knowledge':
            kb_resp = search_knowledge_base(q)
            if kb_resp: return kb_resp
            knowledge = AssistantKnowledge.objects.filter(school_id=school_id).order_by('-created_at')[:20]
            if knowledge.exists():
                text = "আমার স্মৃতিতে থাকা কিছু তথ্য:\n"
                for k in knowledge: text += f"- {k.fact}\n"
                return {'text': text}
            return {'text': "এই স্কুল সম্পর্কে আমার কাছে এখনো বিশেষ কোনো তথ্য নেই।"}
        
        if it == 'assistant_capabilities':
            return {'text': "**আমি যা যা করতে পারি:**\n- শিক্ষার্থীদের রেজাল্ট ও তথ্য প্রদান।\n- রক্তের গ্রুপ অনুযায়ী তালিকা তৈরি।\n- উপস্থিতি ও বকেয়া বেতন সংগ্রহ।\n- সাধারণ প্রশ্নের উত্তর।" }
        
        if it == 'school_counts':
            cid, cname = resolve_classroom()
            sid, sname = resolve_section()
            loc_text = f"{cname or ''} {sname or ''}".strip()
            
            if not cid:
                session_id = params.get('session_id')
                if session_id:
                    last_assistant_msg = AIChatMessage.objects.filter(session_id=session_id, role='assistant').order_by('-timestamp').first()
                    if last_assistant_msg and 'মোট' in last_assistant_msg.content:
                        m_cls = re.search(r'\*\*(.*?)\*\*', last_assistant_msg.content)
                        if m_cls:
                            cls_obj = ClassRoom.objects.filter(name__icontains=m_cls.group(1)).filter(school_id=school_id if school_id else Q()).first()
                            if cls_obj:
                                cid, cname = str(cls_obj.id), cls_obj.name
                                m_sec = re.search(r'([a-zA-Zঅ-হ]+)\s*(?:শাখা|সেকশন)', ql)
                                if m_sec:
                                    res = Section.objects.filter(classroom_id=cid).filter(Q(name__iexact=m_sec.group(1)) | Q(name__icontains=m_sec.group(1))).first()
                                    if res: sid, sname = str(res.id), res.name
                                loc_text = f"{cname or ''} {sname or ''}".strip()
            
            qs_s = StudentProfile.objects.filter(school_id=school_id, user__is_active=True) if school_id else StudentProfile.objects.filter(user__is_active=True)
            if cid: qs_s = qs_s.filter(classroom_id=cid)
            if sid: qs_s = qs_s.filter(section_id=sid)
            
            is_boy = any(w in ql for w in ['ছেলে', 'ছাত্র', 'boy'])
            is_girl = any(w in ql for w in ['মেয়ে', 'মেয়ে', 'ছাত্রী', 'girl'])
            
            if is_boy and not is_girl: count, label = qs_s.filter(gender__iexact='male').count(), "ছাত্র"
            elif is_girl and not is_boy: count, label = qs_s.filter(gender__iexact='female').count(), "ছাত্রী"
            elif is_boy and is_girl:
                boys, girls = qs_s.filter(gender__iexact='male').count(), qs_s.filter(gender__iexact='female').count()
                return {'text': f'{loc_text or "সিস্টেমে"}-এ মোট {boys} জন ছাত্র এবং {girls} জন ছাত্রী রয়েছে।'}
            else: count, label = qs_s.count(), "শিক্ষার্থী"
            
            if any(w in ql for w in ['teacher', 'শিক্ষক']):
                t_count = Profile.objects.filter(role='teacher', school_id=school_id).count() if school_id else Profile.objects.filter(role='teacher').count()
                return {'text': f'সিস্টেমে মোট {t_count} জন শিক্ষক রয়েছেন।'}
            
            return {'text': f'{loc_text or "সিস্টেমে"}-এ মোট {count} জন {label} রয়েছে।'}

        if it == 'school_counts_max_class':
            class_counts = ClassRoom.objects.filter(school_id=school_id).annotate(student_count=Count('students')).order_by('-student_count') if school_id else ClassRoom.objects.annotate(student_count=Count('students')).order_by('-student_count')
            if not class_counts.exists(): return {'text': 'সিস্টেমে কোনো ক্লাসের তথ্য পাওয়া যায়নি।'}
            max_class = class_counts.first()
            return {'text': f"সবচেয়ে বেশি শিক্ষার্থী আছে **{max_class.name}**-এ (মোট {max_class.student_count} জন)।"}

        if it == 'school_counts_min_class':
            class_counts = ClassRoom.objects.filter(school_id=school_id).annotate(student_count=Count('students')).order_by('student_count') if school_id else ClassRoom.objects.annotate(student_count=Count('students')).order_by('student_count')
            if not class_counts.exists(): return {'text': 'সিস্টেমে কোনো ক্লাসের তথ্য পাওয়া যায়নি।'}
            min_class = class_counts.first()
            return {'text': f"সবচেয়ে কম শিক্ষার্থী আছে **{min_class.name}**-এ (মোট {min_class.student_count} জন)।"}

        if it == 'school_menu':
            return {'text': "**ড্যাশবোর্ড মেনুসমূহ:**\n1. ড্যাশবোর্ড হোম\n2. শিক্ষার্থী ব্যবস্থাপনা\n3. শিক্ষক ব্যবস্থাপনা\n4. একাডেমিক (ক্লাস, সেকশন, সাবজেক্ট)\n5. হাজিরা (Attendance)\n6. ফি এবং পেমেন্ট\n7. পরীক্ষার রেজাল্ট\n8. এসএমএস (SMS) সার্ভিস\n9. সেটিংস"}

        if it.startswith('results'):
            exams_qs = Examination.objects.filter(school_id=school_id) if school_id else Examination.objects.all()
            if not exams_qs.exists(): return {'text': 'দুঃখিত, কোনো পরীক্ষার রেকর্ড খুঁজে পাওয়া যায়নি।'}
            
            if it == 'results_years':
                years = list(exams_qs.values_list('year', flat=True).distinct().order_by('-year'))
                return {'text': f'সিস্টেমে {", ".join([str(y) for y in years])} সালের পরীক্ষার রেকর্ড রয়েছে।'}
                
            if it == 'results_exams_list':
                latest_year = exams_qs.values_list('year', flat=True).distinct().order_by('-year').first()
                exams = exams_qs.filter(year=latest_year).values_list('name', flat=True).distinct()
                return {'text': f'{latest_year} সালের পরীক্ষাগুলো হলো: {", ".join(list(exams))}।'}

            latest_exam = exams_qs.filter(results__isnull=False).order_by('-exam_date', '-id').first()
            if latest_exam:
                scount = Result.objects.filter(examination=latest_exam).values('student').distinct().count()
                pcount = Result.objects.filter(examination=latest_exam, is_passed=True).values('student').distinct().count()
                return {'text': f"সর্বশেষ '{latest_exam.name}' পরীক্ষার রেজাল্ট পাওয়া গেছে। মোট অংশগ্রহণকারী: {scount} জন, উত্তীর্ণ: {pcount} জন।"}
            return {'text': 'দুঃখিত, কোনো রেজাল্ট এখনো ইনপুট দেওয়া হয়নি।'}

        return None
