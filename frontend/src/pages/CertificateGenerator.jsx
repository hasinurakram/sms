import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  useTheme,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  School as SchoolIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  EmojiEvents as AwardIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../utils/api';
import { isAuthenticated } from '../utils/auth';

const StudentCard = ({ data, school, bloodGroup, isEditing, onEditProfile, onBloodGroupChange }) => {
  const theme = useTheme();
  const user = data?.user || {};
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const rollNumber = data?.roll_number || '';
  const classroom = data?.classroom?.name || '';
  const section = data?.section?.name || '';
  const dateOfBirth = user?.date_of_birth || '';
  const gender = user?.gender || '';

  // Function to process photo URLs
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    if (url.startsWith('/media/')) return `${base}${url}`;
    if (url.startsWith('media/')) return `${base}/${url}`;
    return `${base}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  const photoUrl = processPhotoUrl(user?.photo_url);

  return (
    <Box className="student-card-container" sx={{
      position: 'relative',
      backgroundColor: '#ffffff',
      width: '350px',
      minHeight: '200px',
      p: 2,
      border: '2px solid #1976d2',
      borderRadius: 2,
      boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
      backgroundImage: 'linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 75%, #f3f4f6 75%, #f3f4f6), linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 75%, #f3f4f6 75%, #f3f4f6)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 10px 10px'
    }}>
      {/* School Header */}
      <Box sx={{ textAlign: 'center', mb: 1, position: 'relative', zIndex: 1 }}>
        <Typography variant="h6" sx={{ 
          fontWeight: 'bold', 
          color: '#1976d2',
          fontFamily: 'Arial, sans-serif',
          fontSize: '0.9rem',
          mb: 0.5
        }}>
          {school?.name || 'SCHOOL NAME'}
        </Typography>
        <Typography variant="caption" sx={{ 
          color: '#666',
          fontSize: '0.7rem'
        }}>
          Student ID Card
        </Typography>
      </Box>

      {/* Student Info */}
      <Box sx={{ display: 'flex', gap: 2, position: 'relative', zIndex: 1 }}>
        {/* Photo Section */}
        <Box sx={{ flexShrink: 0 }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              style={{
                width: '80px',
                height: '100px',
                objectFit: 'cover',
                border: '1px solid #ddd',
                borderRadius: 1
              }}
            />
          ) : (
            <Box sx={{
              width: '80px',
              height: '100px',
              border: '1px solid #ddd',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f5f5f5'
            }}>
              <PersonIcon sx={{ fontSize: 40, color: '#999' }} />
            </Box>
          )}
        </Box>

        {/* Details Section */}
        <Box sx={{ flex: 1, fontSize: '0.75rem' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
            {name || 'Student Name'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Class: {classroom} {section && `(${section})`}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Roll: {rollNumber}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Gender: {gender || 'N/A'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            DOB: {dateOfBirth || 'N/A'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
            Blood Group: {isEditing ? (
              <Select
                value={bloodGroup}
                onChange={(e) => onBloodGroupChange(e.target.value)}
                size="small"
                sx={{ fontSize: '0.7rem', height: '25px' }}
              >
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="A+">A+</MenuItem>
                <MenuItem value="A-">A-</MenuItem>
                <MenuItem value="B+">B+</MenuItem>
                <MenuItem value="B-">B-</MenuItem>
                <MenuItem value="O+">O+</MenuItem>
                <MenuItem value="O-">O-</MenuItem>
                <MenuItem value="AB+">AB+</MenuItem>
                <MenuItem value="AB-">AB-</MenuItem>
              </Select>
            ) : (
              bloodGroup || 'Not Set'
            )}
          </Typography>
        </Box>
      </Box>

      {/* Edit Button */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<EditIcon />}
        onClick={onEditProfile}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          fontSize: '0.7rem',
          minHeight: '25px',
          px: 1
        }}
      >
        {isEditing ? 'Save' : 'Edit'}
      </Button>
    </Box>
  );
};

const Certificate = ({ data, school, session }) => {
  const theme = useTheme();
  
  // Add early return if no data
  if (!data) {
    console.log('Certificate component received no data!');
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          No student data available
        </Typography>
      </Box>
    );
  }
  
  // TEMPORARY: Use test data if real data is empty to verify rendering
  const testData = {
    student_name: 'সামিয়া আক্তার',
    name: 'Samia Akter',
    roll_number: '15',
    guardian_name: 'আব্দুল গফুর',
    classroom: { name: 'দশম শ্রেণি' },
    section: { name: 'বিজ্ঞান' },
    user: {
      first_name: 'Samia',
      last_name: 'Akter',
      username: 'samia'
    }
  };
  
  // Use test data if real data is missing key fields
  const effectiveData = (!data?.student_name && !data?.name && !data?.user?.first_name) ? testData : data;
  
  const user = effectiveData?.user || {};
  const name = effectiveData?.student_name || 
    effectiveData?.name ||
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || 
    user.username || 
    'Student Name';
  const rollNumber = effectiveData?.roll_number || '';
  const classroom = effectiveData?.classroom?.name || '';
  const section = effectiveData?.section?.name || '';
  const guardian = effectiveData?.guardian;
  const guardianName = effectiveData?.guardian_name || 
    effectiveData?.parent_name || 
    effectiveData?.father_name || 
    effectiveData?.mother_name ||
    guardian ? 
      `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() || 
      guardian.username || 
      guardian.name ||
      (guardian.user ? 
        `${guardian.user.first_name || ''} ${guardian.user.last_name || ''}`.trim() || 
        guardian.user.username || 
        guardian.user.name
        : '') 
      : '';
  
  // Debug logging for guardian data
  console.log('Guardian data:', guardian);
  console.log('Guardian name:', guardianName);
  console.log('Guardian name field:', data?.guardian_name);
  const dateOfBirth = user?.date_of_birth || '';
  const address = user?.address || '';
  const gender = user?.gender || '';

  // Function to process photo URLs
  const processPhotoUrl = (url) => {
    if (!url) return null;
    if (typeof url !== 'string') return url;
    if (url.startsWith('http')) return url;
    const base = (api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
    if (url.startsWith('/media/')) return `${base}${url}`;
    if (url.startsWith('media/')) return `${base}/${url}`;
    return `${base}/media/${url.replace(/^\/+|\/+$/g, '')}`;
  };

  // Function to translate Bengali class names to English
  const translateClassName = (className) => {
    const classTranslations = {
      'দশম শ্রেণি': 'Class Ten',
      'নবম শ্রেণি': 'Class Nine',
      'অষ্টম শ্রেণি': 'Class Eight',
      'সপ্তম শ্রেণি': 'Class Seven',
      'ষষ্ঠ শ্রেণি': 'Class Six',
      'পঞ্চম শ্রেণি': 'Class Five',
      'চতুর্থ শ্রেণি': 'Class Four',
      'তৃতীয় শ্রেণি': 'Class Three',
      'দ্বিতীয় শ্রেণি': 'Class Two',
      'প্রথম শ্রেণি': 'Class One',
      'কিন্ডারগার্টেন': 'Kindergarten',
      'নার্সারি': 'Nursery'
    };
    return classTranslations[className] || className;
  };

  // Function to translate Bengali section names to English
  const translateSectionName = (sectionName) => {
    const sectionTranslations = {
      'বিজ্ঞান': 'Science',
      'ব্যবসা': 'Commerce',
      'মানবিক': 'Arts',
      'ক': 'A',
      'খ': 'B',
      'গ': 'C',
      'ঘ': 'D',
      'ঙ': 'E',
      'চ': 'F'
    };
    return sectionTranslations[sectionName] || sectionName;
  };

  // Function to translate Bengali school names to English
  const translateSchoolName = (schoolName) => {
    const schoolTranslations = {
      'ভাটরা উচ্চ বিদ্যালয়': 'Bhatra High School',
      'রামগঞ্জ উচ্চ বিদ্যালয়': 'Ramganj High School',
      'লক্ষীপুর উচ্চ বিদ্যালয়': 'Lakshmipur High School',
      'সরকারি উচ্চ বিদ্যালয়': 'Government High School',
      'মডেল উচ্চ বিদ্যালয়': 'Model High School'
    };
    return schoolTranslations[schoolName] || schoolName;
  };

  // Function to translate Bengali locations to English
  const translateLocation = (location) => {
    const locationTranslations = {
      'ভাটরা': 'Bhatra',
      'রামগঞ্জ': 'Ramganj',
      'লক্ষীপুর': 'Lakshmipur',
      'ঢাকা': 'Dhaka',
      'চট্টগ্রাম': 'Chattogram',
      'খুলনা': 'Khulna',
      'রাজশাহী': 'Rajshahi',
      'সিলেট': 'Sylhet',
      'বরিশাল': 'Barishal',
      'রংপুর': 'Rangpur',
      'ময়মনসিংহ': 'Mymensingh'
    };
    return locationTranslations[location] || location;
  };

  // Function to clean garbled text
  const cleanGarbledText = (text) => {
    if (!text) return text;
    
    // Remove extra diacritical marks and normalize
    return text.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
      .trim();
  };

  // Function to translate Bengali names to English
  const translateName = (name) => {
    if (!name) return name;
    
    // Clean garbled text first
    const cleanName = cleanGarbledText(name);
    
    const nameTranslations = {
      // Full names
      'সামিয়া আক্তার': 'Samia Akter',
      'আয়েশা আক্তার': 'Ayesha Akter',
      'ফাতেমা আক্তার': 'Fatema Akter',
      'খাদিজা আক্তার': 'Khadija Akter',
      'মরিয়ম আক্তার': 'Mariam Akter',
      'জান্নাতুল ফেরদাউস': 'Jannatul Ferdous',
      'নুসরাত জাহান': 'Nusrat Jahan',
      'রুকাইয়া খাতুন': 'Rukaiya Khatun',
      'জান্নাতুল ফয়জুর': 'Jannatul Faizur',
      'মুহাম্মদ ইব্রাহিম': 'Muhammad Ibrahim',
      'মোঃ ইব্রাহিম': 'Md. Ibrahim',
      'মোহাম্মদ ইব্রাহিম': 'Mohammad Ibrahim',
      'মোস্তফা গাজী': 'Mostafa Gazi',
      'মোস্তফা': 'Mostafa',
      'গাজী': 'Gazi',
      'আব্দুল গফুর': 'Abdul Gofur',
      'আব্দুল গফুর': 'Abdul Gofur',
      'আব্দুল': 'Abdul',
      'গফুর': 'Gofur',
      'মোঃ গফুর': 'Md. Gofur',
      'আবু বকর': 'Abu Bakar',
      'আবু': 'Abu',
      'বকর': 'Bakar',
      'মোঃ বকর': 'Md. Bakar',
      
      // First names
      'সামিয়া': 'Samia',
      'আয়েশা': 'Ayesha',
      'ফাতেমা': 'Fatema',
      'খাদিজা': 'Khadija',
      'মরিয়ম': 'Mariam',
      'জান্নাতুল': 'Jannatul',
      'নুসরাত': 'Nusrat',
      'রুকাইয়া': 'Rukaiya',
      'মুহাম্মদ': 'Muhammad',
      'মোঃ': 'Md.',
      'মোহাম্মদ': 'Mohammad',
      'আব্দুল': 'Abdul',
      'আব্দুর': 'Abdur',
      'শেখ': 'Sheikh',
      'মিয়া': 'Mia',
      
      // Last names
      'আক্তার': 'Akter',
      'খাতুন': 'Khatun',
      'জাহান': 'Jahan',
      'ফেরদাউস': 'Ferdous',
      'ফয়জুর': 'Faizur',
      'রহমান': 'Rahman',
      'হক': 'Haque',
      'উদ্দিন': 'Uddin',
      'মিয়া': 'Mia',
      'শেখ': 'Sheikh',
      'সরকার': 'Sarker',
      'চৌধুরী': 'Chowdhury',
      'হাসান': 'Hasan',
      'হোসেন': 'Hossain',
      'আলী': 'Ali',
      'খান': 'Khan',
      'মিয়া': 'Mia'
    };
    
    // Try exact match first
    if (nameTranslations[cleanName]) {
      return nameTranslations[cleanName];
    }
    
    // Try word-by-word translation
    return cleanName.split(' ').map(word => nameTranslations[word] || word).join(' ');
  };

  // Function to translate school address
  const translateSchoolAddress = (address) => {
    if (!address) return address;
    return address.split(',').map(part => translateLocation(part.trim())).join(', ');
  };

  const photoUrl = processPhotoUrl(user?.photo_url);
  const englishClassroom = translateClassName(classroom);
  const englishSection = translateSectionName(section);
  const englishSchoolName = translateSchoolName(school?.name || '');
  const englishSchoolAddress = translateSchoolAddress(school?.address || '');
  const englishStudentName = translateName(name);
  const englishGuardianName = translateName(guardianName);
  
  // Debug logging for translations
  console.log('=== CERTIFICATE DEBUG INFO ===');
  console.log('Using test data:', effectiveData === testData);
  console.log('Original student data:', JSON.stringify(data, null, 2));
  console.log('Effective student data:', JSON.stringify(effectiveData, null, 2));
  console.log('User data:', JSON.stringify(user, null, 2));
  console.log('Original student name:', JSON.stringify(name));
  console.log('Cleaned student name:', cleanGarbledText(name));
  console.log('Translated student name:', englishStudentName);
  console.log('Guardian data:', JSON.stringify(guardian, null, 2));
  console.log('Original guardian name:', JSON.stringify(guardianName));
  console.log('Cleaned guardian name:', cleanGarbledText(guardianName));
  console.log('Translated guardian name:', englishGuardianName);
  console.log('Classroom:', JSON.stringify(classroom));
  console.log('English Classroom:', englishClassroom);
  console.log('Roll Number:', JSON.stringify(rollNumber));
  console.log('Session:', JSON.stringify(session));
  console.log('School data:', JSON.stringify(school, null, 2));
  console.log('=============================');

  return (
    <Box className="certificate-container" sx={{
      position: 'relative',
      backgroundColor: '#fff8dc',
      minHeight: '800px',
      p: 6,
      border: '3px solid #8B4513',
      borderRadius: 2,
      boxShadow: '0 4px 20px rgba(139, 69, 19, 0.3)',
      backgroundImage: 'none',
      backgroundSize: '20px 20px'
    }}>
      {/* Watermark Logo */}
      {school?.logo && (
        <Box className="watermark" sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.08,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 0
        }}>
          <img 
            src={processPhotoUrl(school.logo)} 
            alt={school.name}
            style={{ 
              width: '95%',
              height: '95%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center'
            }}
          />
        </Box>
      )}
      
      {/* Certificate Header */}
      <Box className="text-content" sx={{ textAlign: 'center', mb: 1, position: 'relative', zIndex: 1 }}>
        <Typography className="school-name" variant="h3" sx={{ 
          fontWeight: 'bold', 
          color: '#8B4513',
          fontFamily: 'Georgia, serif',
          mb: 0.5,
          fontSize: '2.5rem',
          textShadow: '1px 1px 2px rgba(139, 69, 19, 0.2)',
          fontStyle: 'italic',
          transform: 'perspective(500px) rotateX(1deg)'
        }}>
          {englishSchoolName || 'SCHOOL NAME'}
        </Typography>
        <Typography className="school-address" variant="h6" sx={{ 
          color: '#2c3e50',
          fontFamily: 'Georgia, serif',
          mb: 0.5,
          fontSize: '1rem',
          fontStyle: 'italic'
        }}>
          {englishSchoolAddress || 'SCHOOL ADDRESS'}
        </Typography>
        <Box className="divider" sx={{ 
          borderBottom: '3px solid #8B4513',
          width: '350px',
          mx: 'auto',
          mb: 2,
          borderRadius: '1px'
        }} />
      </Box>

      {/* Certificate Title */}
      <Box className="text-content" sx={{ textAlign: 'center', mb: 4, position: 'relative', zIndex: 1 }}>
        <Typography className="certificate-subtitle" variant="h4" sx={{ 
          fontWeight: '600', 
          color: '#2c3e50',
          fontFamily: 'Georgia, serif',
          mb: 4,
          fontSize: '1.1rem'
        }}>
          School Leaving Certificate & Testimonial
        </Typography>
      </Box>

      {/* Certificate Content */}
      <Box className="certificate-content" sx={{ 
        textAlign: 'left', 
        mb: 4,
        fontSize: '1.1rem',
        lineHeight: 2.2,
        color: '#2c3e50',
        position: 'relative',
        zIndex: 1,
        fontFamily: 'Georgia, serif',
        textIndent: '40px',
        textAlign: 'justify'
      }}>
        <Typography variant="body1" sx={{ 
          mb: 3,
          fontSize: '1.1rem',
          lineHeight: 2.2,
          fontFamily: 'Georgia, serif',
          color: '#2c3e50'
        }}>
          This is to certify that <strong className="underlined">{englishStudentName || 'Student Name'}</strong>, {' '}
          son/daughter of <strong className="underlined">{englishGuardianName || 'Parent/Guardian Name'}</strong>, {' '}
          was a pupil of <strong className="underlined">{englishClassroom || 'Class Name'}</strong> 
          {englishSection && <span> ({englishSection})</span>} of this institution, bearing Roll No. <strong className="underlined">{rollNumber || 'Roll Number'}</strong>, {' '}
          Session <strong style={{ color: '#8B4513' }}>{session || 'Session Year'}</strong>. {' '}
          He/she sat for the Annual Examination held in <strong style={{ color: '#8B4513' }}>{session || 'Session Year'}</strong> {' '}
          as a student of <strong style={{ color: '#2c3e50', fontSize: '1.15rem' }}>{englishClassroom || 'Class Name'}</strong> and passed the examination. {' '}
          He/she has been promoted to the next class. {' '}
          To the best of my knowledge, he/she bears a good moral character. {' '}
          I wish him/her every success in life.
        </Typography>
      </Box>

      {/* Certificate Footer */}
      <Box className="certificate-footer" sx={{ display: 'flex', justifyContent: 'space-between', mt: 16, position: 'relative', zIndex: 1 }}>
        <Box className="footer-section" sx={{ textAlign: 'center' }}>
          <Box className="seal-container" sx={{ mb: 1 }}>
            <img 
              className="seal-stamp"
              src="/images/seals/school-seal.png" 
              alt="School Seal"
              style={{ 
                width: '80px',
                height: '80px',
                objectFit: 'contain',
                opacity: 0.8
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </Box>
          <Typography className="footer-text" variant="body2" sx={{ 
            fontFamily: 'Georgia, serif',
            fontSize: '0.9rem',
            color: '#2c3e50',
            fontWeight: 'bold',
            fontStyle: 'italic'
          }}>
            Date of Issue
          </Typography>
        </Box>
        
        <Box className="footer-section" sx={{ textAlign: 'center' }}>
          <Box className="seal-container" sx={{ mb: 1 }}>
            <img 
              className="seal-stamp"
              src="/images/seals/school-seal.png" 
              alt="School Seal"
              style={{ 
                width: '80px',
                height: '80px',
                objectFit: 'contain',
                opacity: 0.8
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </Box>
          <Box className="footer-line" sx={{ 
            borderBottom: '2px solid #2c3e50',
            width: 180,
            mb: 1,
            mx: 'auto'
          }} />
          <Typography className="footer-text" variant="body2" sx={{ 
            fontFamily: 'Georgia, serif',
            fontSize: '0.9rem',
            color: '#2c3e50',
            fontWeight: 'bold',
            fontStyle: 'italic'
          }}>
            Class Teacher's Signature
          </Typography>
        </Box>
        
        <Box className="footer-section" sx={{ textAlign: 'center' }}>
          <Box sx={{ mb: 1 }}>
            <img 
              className="signature-img"
              src={(school?.id && String(school.id) === '19') ? `${(api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/,'')}/media/BHS/signature.png` : '/images/signatures/signature.png'} 
              alt="Head Master's Signature"
              style={{ 
                width: '150px',
                height: '80px',
                objectFit: 'contain'
              }}
            />
          </Box>
          <Box className="footer-line" sx={{ 
            borderBottom: '2px solid #2c3e50',
            width: 180,
            mb: 1,
            mx: 'auto'
          }} />
          <Typography className="footer-text" variant="body2" sx={{ 
            fontFamily: 'Georgia, serif',
            fontSize: '0.9rem',
            color: '#2c3e50',
            fontWeight: 'bold',
            fontStyle: 'italic'
          }}>
            Head Master's Signature
          </Typography>
        </Box>
      </Box>

      {/* Certificate Border Design */}
      <Box className="border-design" sx={{
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
        border: '2px solid #D4AF37',
        borderRadius: 1,
        pointerEvents: 'none',
        zIndex: 2
      }} />
    </Box>
  );
};

export default function CertificateGenerator() {
  const { id: schoolId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rollNumber, setRollNumber] = useState('');
  const [session, setSession] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [school, setSchool] = useState(null);
  const [error, setError] = useState('');
  const [certificateGenerated, setCertificateGenerated] = useState(false);
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [bloodGroup, setBloodGroup] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const certificateRef = useRef(null);

  // Handle profile edit toggle
  const handleEditProfile = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    setIsEditingProfile(!isEditingProfile);
  };

  // Handle blood group change
  const handleBloodGroupChange = (value) => {
    setBloodGroup(value);
  };

  // Handle print certificate
  const handlePrintCertificate = () => {
    const certificateElement = certificateRef.current;
    if (!certificateElement) return;
    (async () => {
      try {
        const rect = certificateElement.getBoundingClientRect();
        const canvas = await html2canvas(certificateElement, {
          scale: Math.min(3, window.devicePixelRatio || 2),
          useCORS: true,
          logging: false,
          backgroundColor: '#fff8dc',
          foreignObjectRendering: false,
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
          windowWidth: Math.ceil(rect.width),
          windowHeight: Math.ceil(rect.height)
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Certificate - ${student?.user?.username || 'Student'}</title>
              <style>
                @page { size: A4; margin: 0; }
                html, body { height: 100%; }
                body { margin: 0; background: #ffffff; }
                .sheet { width: 210mm; height: 297mm; display: flex; align-items: center; justify-content: center; background: #ffffff; overflow: hidden; }
                img { width: 200mm; height: auto; max-height: 277mm; display: block; margin: 0 auto; }
              </style>
            </head>
            <body>
              <div class="sheet">
                <img src="${imgData}" />
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
      } catch (_) { /* ignore */ }
    })();
  };

  // Handle download certificate as PDF
  const handleDownloadCertificate = async () => {
    const certificateElement = certificateRef.current;
    
    if (!certificateElement) {
      toast.error('Could not find the certificate to export');
      return;
    }
    
    try {
      toast.info('Generating PDF...');
      
      const rect = certificateElement.getBoundingClientRect();
      const canvas = await html2canvas(certificateElement, { 
        scale: Math.min(3, window.devicePixelRatio || 2),
        useCORS: true,
        logging: false,
        backgroundColor: '#fff8dc',
        allowTaint: false,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        removeContainer: false,
        scrollX: 0,
        scrollY: 0,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        windowWidth: Math.ceil(rect.width),
        windowHeight: Math.ceil(rect.height)
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Create PDF with A4 size
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate image dimensions to fit the page
      const imgWidth = pageWidth - 40; // 20px margins on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let y = 20;
      
      if (imgHeight > pageHeight - 40) {
        // Scale to fit height if needed
        const scale = (pageHeight - 40) / imgHeight;
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const x = (pageWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'JPEG', x, 20, scaledWidth, scaledHeight);
      } else {
        const x = (pageWidth - imgWidth) / 2;
        pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
      }
      
      // Save the PDF with student name and date
      const fileName = `certificate-${student?.user?.username || 'student'}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  useEffect(() => {
    if (!schoolId) return;
    loadSchool();
    loadClassrooms();
  }, [schoolId]);

  const loadSchool = () => {
    api.get(`/api/schools/${schoolId}/`)
      .then(res => setSchool(res.data))
      .catch(err => console.error(err));
  };

  const loadClassrooms = () => {
    api.get(`/api/academics/classrooms/?school=${schoolId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setClassrooms(data);
      })
      .catch(err => console.error(err));
  };

  const loadSections = (classroomId) => {
    if (!classroomId) {
      setSections([]);
      return;
    }
    api.get(`/api/academics/sections/?classroom=${classroomId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data.results || [];
        setSections(data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (classFilter) {
      loadSections(classFilter);
    } else {
      setSections([]);
    }
    setSectionFilter('');
  }, [classFilter]);

  const handleGenerateCertificate = async () => {
    if (!rollNumber || !session) {
      setError('Please enter both Roll Number and Session');
      return;
    }

    setLoading(true);
    setError('');
    setStudent(null);
    setCertificateGenerated(false);

    try {
      // Build URL with filters
      let url = `/api/academics/students/?school=${schoolId}&roll_number=${rollNumber}`;
      
      if (classFilter) url += `&classroom=${classFilter}`;
      if (sectionFilter) url += `&section=${sectionFilter}`;

      const res = await api.get(url);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      
      if (data.length === 0) {
        setError('No student found with these criteria');
        return;
      }

      const studentData = data[0];
      
      // Debug logging for student data
      console.log('Student data received:', studentData);
      console.log('Guardian in student data:', studentData.guardian);
      
      // Map student data to ensure photo URL is in the correct format
      const processedStudent = {
        ...studentData,
        user: {
          ...studentData.user,
          photo_url: studentData.photo || 
                      studentData.user?.photo || 
                      studentData.user?.photo_url
        }
      };
      
      setStudent(processedStudent);
      setCertificateGenerated(true);
    } catch (err) {
      console.error(err);
      setError('Failed to generate certificate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!certificateGenerated) return;
    
    const printWindow = window.open('', '_blank');
    const certificateElement = document.getElementById('certificate-content');
    
    if (certificateElement && printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Certificate - ${student?.user?.username || 'Student'}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              @media print {
                body { margin: 0; padding: 10px; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            ${certificateElement.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handleReset = () => {
    setRollNumber('');
    setSession('');
    setClassFilter('');
    setSectionFilter('');
    setStudent(null);
    setCertificateGenerated(false);
    setError('');
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          p: 3, 
          background: 'linear-gradient(135deg, #8B4513 0%, #D4AF37 100%)',
          color: 'white',
          borderRadius: 3
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          alignItems={{ xs: 'stretch', sm: 'center' }} 
          justifyContent="space-between" 
          spacing={2}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center' }}>
              <AwardIcon sx={{ mr: 1, fontSize: 40 }} />
              Certificate Generator
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Generate student certificates using Class, Section, Roll Number and Session
            </Typography>
            {certificateGenerated && (
              <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                Certificate generated for {student?.user?.first_name} {student?.user?.last_name}
              </Typography>
            )}
          </Box>
          {certificateGenerated && (
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrintCertificate}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                backdropFilter: 'blur(10px)'
              }}
            >
              Print Certificate
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Input Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
          Student Information
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Class</InputLabel>
              <Select
                value={classFilter}
                label="Class"
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <MenuItem value="">Select Class</MenuItem>
                {classrooms.map((classroom) => (
                  <MenuItem key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Section</InputLabel>
              <Select
                value={sectionFilter}
                label="Section"
                onChange={(e) => setSectionFilter(e.target.value)}
                disabled={!classFilter}
              >
                <MenuItem value="">Select Section</MenuItem>
                {sections.map((section) => (
                  <MenuItem key={section.id} value={section.id}>
                    {section.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <TextField
              label="Roll Number"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="Enter student roll number"
              fullWidth
              onKeyPress={(e) => e.key === 'Enter' && handleGenerateCertificate()}
              helperText="Search by student roll number"
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <TextField
              label="Session"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="e.g., 2024-2025"
              fullWidth
              onKeyPress={(e) => e.key === 'Enter' && handleGenerateCertificate()}
              helperText="Enter academic session"
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleGenerateCertificate}
            disabled={loading}
            sx={{ 
              bgcolor: '#2E7D32',
              '&:hover': { bgcolor: '#1B5E20' }
            }}
          >
            {loading ? 'Generating...' : 'Generate Certificate'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
            disabled={loading}
          >
            Reset
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {certificateGenerated && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Certificate generated successfully! Scroll down to view and print.
          </Alert>
        )}
      </Paper>

      {/* Certificate Display */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={60} />
        </Box>
      )}

      {certificateGenerated && student && (
        <Box>
          {/* Student Card Display */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
            <StudentCard
              data={student}
              school={school}
              bloodGroup={bloodGroup}
              isEditing={isEditingProfile}
              onEditProfile={handleEditProfile}
              onBloodGroupChange={handleBloodGroupChange}
            />
          </Box>

          {/* Certificate Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4, mb: 4 }}>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrintCertificate}
              sx={{
                backgroundColor: '#8B4513',
                '&:hover': { backgroundColor: '#6B3410' },
                fontFamily: 'Georgia, serif',
                fontWeight: 'bold'
              }}
            >
              Print Certificate
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCertificate}
              sx={{
                backgroundColor: '#2c3e50',
                '&:hover': { backgroundColor: '#1a252f' },
                fontFamily: 'Georgia, serif',
                fontWeight: 'bold'
              }}
            >
              Download Certificate
            </Button>
          </Box>

          {/* Certificate Preview */}
          <Box id="certificate-content" ref={certificateRef}>
            <Certificate 
              data={student} 
              school={school} 
              session={session}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
