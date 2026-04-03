import os
import json
import google.generativeai as genai
from django.conf import settings
from .models import AIChatSession, AIChatMessage, AssistantKnowledge, AssistantMemory, School
from django.db.models import Q
from datetime import datetime

class SoftwareAI:
    def __init__(self, school_id, user=None):
        self.school_id = school_id
        self.user = user
        self.api_key = os.environ.get('GEMINI_API_KEY') or getattr(settings, 'GEMINI_API_KEY', None)
        self.model = None
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-flash-latest')

    def get_or_create_session(self, session_id=None):
        if session_id:
            try:
                return AIChatSession.objects.get(id=session_id, school_id=self.school_id)
            except AIChatSession.DoesNotExist:
                pass
        
        session = AIChatSession.objects.create(
            user=self.user,
            school_id=self.school_id,
            title="New Chat"
        )
        return session

    def get_context(self, session):
        # Last 10 messages for conversation context
        messages = session.messages.order_by('timestamp')[:10]
        context = "[Conversation History]:\n"
        for msg in messages:
            context += f"{msg.role.capitalize()}: {msg.content}\n"
        
        # Add learned knowledge to context
        knowledge = AssistantKnowledge.objects.filter(school_id=self.school_id).order_by('-created_at')[:20]
        if knowledge.exists():
            context += "\n[Long-term Memory & Learned Facts]:\n"
            for k in knowledge:
                context += f"- {k.fact} (Learned on: {k.created_at.strftime('%Y-%m-%d')})\n"
        
        # Add school specific info if available
        try:
            school = School.objects.get(id=self.school_id)
            context += f"\n[School Context]:\n- School Name: {school.name}\n- School ID: {self.school_id}\n"
        except:
            pass
            
        return context

    def ask(self, query, session_id=None):
        session = self.get_or_create_session(session_id)
        AIChatMessage.objects.create(session=session, role='user', content=query)
        
        context = self.get_context(session)
        
        # If no API key, fallback to rule-based or simplified logic
        if not self.model:
            response_text = self._fallback_response(query, context)
        else:
            try:
                full_prompt = f"""
                You are a powerful, independent AI Assistant for a school management software.
                Language: Support both Bengali and English. Prefer Bengali if the user asks in Bengali.
                
                [Core Mission]:
                You are an evolving, independent AI. Your goal is to provide accurate answers about school data and also act as a general-purpose assistant.
                You can answer ANY question, including general knowledge, history, science, coding, and creative tasks.
                If the user shares new information (facts, preferences, rules), you MUST identify and remember them.
                
                [Capabilities]:
                1. School Data: You can answer questions about students, teachers, results, blood groups, etc., based on the provided [Context].
                2. General Knowledge: You can answer general questions (e.g., "What is the capital of Bangladesh?", "How does a battery work?") using your internal knowledge.
                3. Learning: You can learn and remember new facts provided by the user.

                [Context & Learned Knowledge]:
                {context}
                
                [IMPORTANT RULES]:
                1. For school-specific data (students, results, etc.), ONLY use the information provided in the [Context] or [Long-term Memory].
                2. For general questions NOT related to the school, use your own broad internal knowledge.
                3. DO NOT hallucinate school-specific facts. If school information is not in the context, say you don't have that specific data in the database.
                4. For blood group requests, always provide full details (Name, Class, Section, Roll, Phone) if available in the context.
                5. If you are asked to do something you cannot (like deleting a user), explain that you are an AI assistant and tell the user how they can do it manually if possible.
                6. Maintain context from previous messages.
                
                [User Query]: 
                {query}
                
                [Instruction]:
                Return your response in a valid JSON format with the following keys:
                - "answer": Your direct response to the user's query.
                - "new_facts": A list of short, important facts learned from THIS specific interaction that should be remembered forever. If nothing new, return an empty list [].
                - "intent": The identified intent (e.g., "greeting", "result_query", "learning", "general_knowledge").
                """
                
                # Using Gemini to get structured output
                response = self.model.generate_content(full_prompt)
                
                # Attempt to parse JSON from response
                try:
                    # Clean up the response text in case it contains markdown code blocks
                    raw_text = response.text.strip()
                    if raw_text.startswith('```json'):
                        raw_text = raw_text[7:-3].strip()
                    elif raw_text.startswith('```'):
                        raw_text = raw_text[3:-3].strip()
                    
                    data = json.loads(raw_text)
                    response_text = data.get('answer', response.text)
                    new_facts = data.get('new_facts', [])
                    
                    # Store new facts automatically
                    for fact in new_facts:
                        AssistantKnowledge.objects.get_or_create(
                            school_id=self.school_id,
                            fact=fact,
                            defaults={'category': 'auto_learned', 'source': 'interaction'}
                        )
                except Exception as e:
                    # Fallback if JSON parsing fails - just return the text as is
                    response_text = response.text
                    
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "quota" in error_msg.lower():
                    response_text = "দুঃখিত, আমি এই মুহূর্তে অনেক বেশি অনুরোধ পাচ্ছি (Gemini API Quota Exceeded)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা একটি নতুন API Key ব্যবহার করুন।"
                else:
                    response_text = "দুঃখিত, আমি আপনার প্রশ্নটি এই মুহূর্তে বুঝতে পারছি না। আমার এআই ইঞ্জিনে একটি সাময়িক সমস্যা হয়েছে।"

        AIChatMessage.objects.create(session=session, role='assistant', content=response_text)
        return {
            'text': response_text,
            'session_id': session.id,
            'role': 'assistant'
        }

    def _fallback_response(self, query, context):
        # Basic rule-based fallback if LLM is not available
        q = query.lower()
        
        # Check if asking about learned knowledge in fallback mode
        if any(word in q for word in ['কি কি শিখেছ', 'learned', 'knowledge', 'স্মৃতি']):
            knowledge = AssistantKnowledge.objects.filter(school_id=self.school_id).order_by('-created_at')[:10]
            if knowledge.exists():
                text = "আমি এখন পর্যন্ত যা যা শিখেছি:\n"
                for k in knowledge:
                    text += f"- {k.fact}\n"
                return text
            return "আমার স্মৃতিতে এখনো কোনো নতুন তথ্য নেই। আমাকে নতুন কিছু শেখান!"

        if 'রক্ত' in q or 'blood' in q:
            return "রক্তের গ্রুপ সংক্রান্ত তথ্য ডাটাবেস থেকে চেক করা হচ্ছে... (Gemini API কী সেট করা থাকলে আমি আরও বিস্তারিত উত্তর দিতে পারতাম)"
            
        return "আমি আপনার প্রশ্নটি বুঝতে পেরেছি। তবে আমার পূর্ণ ক্ষমতার এআই ইঞ্জিন (Gemini) সক্রিয় করার জন্য একটি API কী প্রয়োজন। অনুগ্রহ করে .env ফাইলে GEMINI_API_KEY সেট করুন।"

    def get_history(self, session_id):
        try:
            session = AIChatSession.objects.get(id=session_id, school_id=self.school_id)
            messages = session.messages.order_by('timestamp')
            return [{
                'role': m.role,
                'content': m.content,
                'timestamp': m.timestamp.isoformat()
            } for m in messages]
        except AIChatSession.DoesNotExist:
            return []
