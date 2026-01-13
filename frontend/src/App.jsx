// src/App.jsx
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { SchoolProvider } from './context/SchoolContext';
import { AcademicsProvider } from './context/AcademicsContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { isAuthenticated } from './utils/auth';

const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const SchoolDashboard = React.lazy(() => import('./pages/SchoolDashboard.jsx'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const RoleDashboard = React.lazy(() => import('./pages/RoleDashboard'));
const RoleDetail = React.lazy(() => import('./pages/RoleDetail'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const TeachersPage = React.lazy(() => import('./pages/TeachersPage'));
const AddTeacherPage = React.lazy(() => import('./pages/AddTeacherPage'));
const TeacherCardsPage = React.lazy(() => import('./pages/TeacherCardsPage'));
const SoftwareAssistant = React.lazy(() => import('./pages/SoftwareAssistant.jsx'));
const StudentsPage = React.lazy(() => import('./pages/StudentsPage'));
const AcademicsPage = React.lazy(() => import('./pages/AcademicsPage'));
const ParentsPage = React.lazy(() => import('./pages/ParentsPage'));
const AddParentPage = React.lazy(() => import('./pages/AddParentPage'));
const ParentDashboard = React.lazy(() => import('./pages/ParentDashboard'));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard'));
const ResultsPage = React.lazy(() => import('./pages/ResultsPage'));
const ResultCardGenerator = React.lazy(() => import('./pages/ResultCardGenerator'));
const RankListPage = React.lazy(() => import('./pages/RankListPage'));
const IDCardGenerator = React.lazy(() => import('./pages/IDCardGenerator'));
const CertificateGenerator = React.lazy(() => import('./pages/CertificateGenerator'));
const AdmissionCardGenerator = React.lazy(() => import('./pages/AdmissionCardGenerator'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const SMSPage = React.lazy(() => import('./pages/SMSPage'));
const SubjectsPage = React.lazy(() => import('./pages/SubjectsPage'));
const ClassroomsPage = React.lazy(() => import('./pages/ClassroomsPage'));
const AddCommitteePage = React.lazy(() => import('./pages/AddCommitteePage'));
const AttendancePageNew = React.lazy(() => import('./pages/AttendancePageNew'));
const AttendanceReportCard = React.lazy(() => import('./pages/AttendanceReportCard'));
const FeesPage = React.lazy(() => import('./pages/FeesPage'));
const FeePaymentReceipt = React.lazy(() => import('./components/FeePaymentReceipt'));
const ReceiptBook = React.lazy(() => import('./components/ReceiptBook'));
const GroupsPage = React.lazy(() => import('./pages/GroupsPage'));
const SchoolsPage = React.lazy(() => import('./pages/SchoolsPage'));
const AttendanceRecordsPage = React.lazy(() => import('./pages/AttendanceRecordsPage'));
const ExaminationsPage = React.lazy(() => import('./pages/ExaminationsPage'));
const DebugPage = React.lazy(() => import('./pages/DebugPage'));

const StartupRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    try {
      const unauth = !isAuthenticated();
      const path = location.pathname || '/';
      const protectedMatch = /^\/school\/[^/]+\/(results|examinations)(\/|$)/.test(path);
      if (unauth && (protectedMatch || path === '/login')) {
        navigate('/', { replace: true });
      }
    } catch (_) {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <SchoolProvider>
              <AcademicsProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <StartupRedirect />
              <Routes>
          {/* হোমপেজে WelcomePage */}
          <Route path="/" element={<WelcomePage />} />

        {/* স্কুল ড্যাশবোর্ড + nested */}
        <Route path="/school/:id" element={<SchoolDashboard />}>
          <Route index element={<Dashboard />} />
          <Route path="teacher" element={<TeachersPage />} />
          <Route path="teacher/add" element={<AddTeacherPage />} />
          <Route path="teacher/cards" element={<TeacherCardsPage />} />
          <Route path="student" element={<StudentsPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="classes" element={<ClassroomsPage />} />
          <Route path="attendance" element={<AttendancePageNew />} />
          <Route path="attendance/records" element={<AttendanceRecordsPage />} />
          <Route path="attendance/report-card" element={<AttendanceReportCard />} />
          <Route path="academics" element={<AcademicsPage />} />
          <Route path="results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
          <Route path="examinations" element={<ProtectedRoute><ExaminationsPage /></ProtectedRoute>} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="fee-receipt" element={<FeePaymentReceipt />} />
          <Route path="receipt-book" element={<ReceiptBook />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="result-card" element={<ResultCardGenerator />} />
          <Route path="rank-list" element={<RankListPage />} />
          <Route path="id-card" element={<IDCardGenerator />} />
          <Route path="certificate" element={<CertificateGenerator />} />
          <Route path="admission-cards" element={<AdmissionCardGenerator />} />
          <Route path="assistant" element={<SoftwareAssistant />} />
          <Route path="sms" element={<SMSPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<RoleDashboard role="admin" />} />
          <Route path="parent" element={<ParentsPage />} />
          <Route path="parent/add" element={<AddParentPage />} />
          <Route path="parent/:parentId/dashboard" element={<ParentDashboard />} />
          <Route path="student/:studentId/dashboard" element={<StudentDashboard />} />
          <Route path="committee" element={<RoleDashboard role="committee" />} />
          <Route path="committee/add" element={<AddCommitteePage />} />
          <Route path=":role/:itemId" element={<RoleDetail />} />
        </Route>

        {/* লগইন */}
        <Route path="/login" element={<LoginPage />} />
              </Routes>
            </Suspense>
              </AcademicsProvider>
            </SchoolProvider>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
