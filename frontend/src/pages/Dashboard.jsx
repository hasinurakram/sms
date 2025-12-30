import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDashboardStats, getCurrentSchoolId } from '../services/dashboardService';
import StatCard from '../components/dashboard/StatCard';
import AttendanceChart from '../components/dashboard/AttendanceChart';
import ClassDistributionChart from '../components/dashboard/ClassDistributionChart';
import FeeCollectionChart from '../components/dashboard/FeeCollectionChart';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';

// Icons for stat cards (using simple text as placeholders)
const icons = {
  students: '👨‍🎓',
  teachers: '👨‍🏫',
  classes: '🏫'
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id: paramId } = useParams();
  const schoolId = paramId || getCurrentSchoolId();
  const [summaryExamType, setSummaryExamType] = useState('annual');
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryFailBuckets, setSummaryFailBuckets] = useState(Array.from({ length: 10 }, (_, i) => i + 1));

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats(schoolId);
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [schoolId]);

  const isBanglaFirst = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n.includes('বাংলা প্রথম') || n.includes('bangla first') || n.includes('বাংলা-১') || n.includes('1st');
  };
  const isBanglaSecond = (name) => {
    const n = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    return n.includes('বাংলা দ্বিত') || n.includes('bangla second') || n.includes('বাংলা-২') || n.includes('2nd');
  };
  const isBanglaPaper = (name) => isBanglaFirst(name) || isBanglaSecond(name);
  const isClassNineOrTenName = (className) => {
    const lower = String(className || '').toLowerCase();
    return /নবম|দশম|\b9\b|\b10\b/.test(lower);
  };
  const computeBanglaCombinedPass = (resultsForStudent, passMarks) => {
    const banglaList = resultsForStudent.filter(r => isBanglaPaper(r.subject?.name || r.subject_name));
    if (!banglaList.length) return false;
    const sumCQ = banglaList.reduce((s, r) => s + (parseFloat(r.written_marks) || 0), 0);
    const sumMCQ = banglaList.reduce((s, r) => s + (parseFloat(r.mcq_marks) || 0), 0);
    return (sumCQ >= passMarks) && (sumMCQ >= passMarks);
  };
  const toBn = (val) => {
    const bn = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(val).replace(/\d/g, d => bn[d] ?? d);
  };
  const generateSummary = async () => {
    if (!schoolId) return;
    setSummaryLoading(true);
    try {
      const clsRes = await scopedGet('/api/academics/classrooms/', schoolId, {}, { timeout: 20000 });
      const classrooms = Array.isArray(clsRes.data) ? clsRes.data : (clsRes.data?.results || []);
      const allRows = [];
      let globalMaxFail = 0;
      for (const classroom of classrooms) {
        const secRes = await scopedGet('/api/academics/sections/', schoolId, { classroom: classroom.id }, { timeout: 20000 });
        const sections = Array.isArray(secRes.data) ? secRes.data : (secRes.data?.results || []);
        const exRes = await scopedGet('/api/results/examinations/', schoolId, { classroom: classroom.id }, { timeout: 20000 });
        let exams = Array.isArray(exRes.data) ? exRes.data : (exRes.data?.results || []);
        if (!exams.length) {
          const exAllRes = await scopedGet('/api/results/examinations/', schoolId, {}, { timeout: 20000 });
          exams = Array.isArray(exAllRes.data) ? exAllRes.data : (exAllRes.data?.results || []);
        }
        const bnMap = { '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9' };
        const normalizeYear = (y) => parseInt(String(y ?? '').replace(/[০-৯]/g, d => bnMap[d] ?? d), 10);
        const targetYear = normalizeYear(summaryYear);
        let exam = exams.find(e => (String(e.exam_type || '').toLowerCase() === String(summaryExamType).toLowerCase()) && (normalizeYear(e.academic_year) === targetYear));
        if (!exam && exams.length > 0) {
          const sorted = [...exams].sort((a, b) => (normalizeYear(b.academic_year) || 0) - (normalizeYear(a.academic_year) || 0));
          exam = sorted[0];
        }
        const passMarks = parseFloat(exam?.pass_marks) || 33;
        for (const section of sections) {
          const stuRes = await scopedGet('/api/academics/students/', schoolId, { classroom: classroom.id, section: section.id }, { timeout: 30000 });
          const studentsArr = Array.isArray(stuRes.data) ? stuRes.data : (stuRes.data?.results || []);
          let resultsArr = [];
          if (exam) {
            const rRes = await scopedGet('/api/results/results/', schoolId, { examination: exam.id, page_size: 2000 }, { timeout: 30000 });
            resultsArr = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.results || []);
          }
          const byStudent = new Map();
          for (const r of resultsArr) {
            const sid = typeof r.student === 'object' ? r.student?.id : r.student;
            if (!sid) continue;
            if (!byStudent.has(sid)) byStudent.set(sid, []);
            byStudent.get(sid).push(r);
          }
          const totalStudents = studentsArr.length;
          let absent = 0;
          let allPassedCount = 0;
          const failBucketsCounts = new Map();
          for (const stu of studentsArr) {
            const sid = stu.id;
            const list = byStudent.get(sid) || [];
            if (!list.length) {
              absent += 1;
              continue;
            }
            const classIs910 = isClassNineOrTenName(classroom.name);
            let combinedBanglaPass = false;
            if (classIs910) {
              combinedBanglaPass = computeBanglaCombinedPass(list, passMarks);
            }
            let failedSubjects = 0;
            for (const it of list) {
              const nm = it.subject?.name || it.subject_name || '';
              const isFail = (it?.grade === 'F') || (it?.is_passed === false);
              if (!isFail) continue;
              if (combinedBanglaPass && isBanglaPaper(nm)) continue;
              failedSubjects += 1;
            }
            if (failedSubjects === 0) {
              allPassedCount += 1;
            } else {
              failBucketsCounts.set(failedSubjects, (failBucketsCounts.get(failedSubjects) || 0) + 1);
              if (failedSubjects > globalMaxFail) globalMaxFail = failedSubjects;
            }
          }
          const row = {
            classLabel: `${classroom.name} (${section.name})`,
            total: totalStudents,
            absent,
            allPassed: allPassedCount,
            failBuckets: failBucketsCounts
          };
          allRows.push(row);
        }
      }
      const buckets = Array.from({ length: Math.max(globalMaxFail, 10) }, (_, i) => i + 1);
      setSummaryFailBuckets(buckets);
      setSummaryRows(allRows);
    } catch (e) {
      setSummaryRows([]);
      setSummaryFailBuckets([]);
    } finally {
      setSummaryLoading(false);
    }
  };
  useEffect(() => {
    generateSummary();
  }, [schoolId, summaryExamType, summaryYear]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">School Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard 
          title="Total Students" 
          value={stats?.students_count || 0} 
          icon={icons.students} 
          color="border-blue-500" 
        />
        <StatCard 
          title="Total Teachers" 
          value={stats?.teachers_count || 0} 
          icon={icons.teachers} 
          color="border-green-500" 
        />
        <StatCard 
          title="Total Classes" 
          value={stats?.classes_count || 0} 
          icon={icons.classes} 
          color="border-purple-500" 
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <AttendanceChart attendanceData={stats?.attendance_data || []} />
        <FeeCollectionChart feeData={stats?.fee_collection || []} />
      </div>
      
      <div className="mb-8">
        <ClassDistributionChart classDistribution={stats?.class_distribution || []} />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Result Summary (Pass-Fail)</h2>
          <div className="flex gap-2">
            <select
              className="border rounded px-3 py-2"
              value={summaryExamType}
              onChange={(e) => setSummaryExamType(e.target.value)}
            >
              <option value="test">বিশেষ মূল্যায়ন</option>
              <option value="half_yearly">অর্ধবার্ষিক</option>
              <option value="annual">বার্ষিক</option>
              <option value="terminal">টার্মিনাল</option>
              <option value="model">মডেল টেস্ট</option>
            </select>
            <input
              type="number"
              className="border rounded px-3 py-2 w-28"
              value={summaryYear}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setSummaryYear(Number.isNaN(v) ? '' : v);
              }}
            />
            <button
              className={`px-4 py-2 rounded ${summaryLoading ? 'bg-gray-400' : 'bg-blue-600 text-white'}`}
              onClick={async () => { await generateSummary(); }}
              disabled={summaryLoading}
            >
              {summaryLoading ? 'Loading…' : 'Generate'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-3 py-2 text-left">Class</th>
                <th className="px-3 py-2 text-center">Total Students</th>
                <th className="px-3 py-2 text-center">Absent Students</th>
                <th className="px-3 py-2 text-center">All Subject Passed</th>
                {summaryFailBuckets.map((n) => (
                  <th key={n} className="px-3 py-2 text-center">{toBn(n)} বিষয়ে ফেল</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-3 py-2">{row.classLabel}</td>
                  <td className="px-3 py-2 text-center">{row.total}</td>
                  <td className="px-3 py-2 text-center">{row.absent}</td>
                  <td className="px-3 py-2 text-center">{row.allPassed}</td>
                  {summaryFailBuckets.map((n) => (
                    <td key={n} className="px-3 py-2 text-center">{row.failBuckets.get(n) || 0}</td>
                  ))}
                </tr>
              ))}
              {summaryRows.length > 0 && (
                <tr className="border-t bg-blue-50">
                  <td className="px-3 py-2 font-semibold">Total</td>
                  <td className="px-3 py-2 text-center font-semibold">{summaryRows.reduce((s, r) => s + r.total, 0)}</td>
                  <td className="px-3 py-2 text-center font-semibold">{summaryRows.reduce((s, r) => s + r.absent, 0)}</td>
                  <td className="px-3 py-2 text-center font-semibold">{summaryRows.reduce((s, r) => s + r.allPassed, 0)}</td>
                  {summaryFailBuckets.map((n) => (
                    <td key={n} className="px-3 py-2 text-center font-semibold">
                      {summaryRows.reduce((s, r) => s + (r.failBuckets.get(n) || 0), 0)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
