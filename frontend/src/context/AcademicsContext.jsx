import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../utils/api';
import { scopedGet } from '../utils/schoolApi';

const AcademicsContext = createContext();

export const useAcademics = () => {
  const context = useContext(AcademicsContext);
  if (!context) {
    throw new Error('useAcademics must be used within an AcademicsProvider');
  }
  return context;
};

export const AcademicsProvider = ({ children }) => {
  const [classrooms, setClassrooms] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSchoolId, setCurrentSchoolId] = useState(null);

  // Fetch classrooms
  const refreshClassrooms = useCallback(async (schoolId = currentSchoolId) => {
    if (!schoolId) return;
    
    try {
      const response = await scopedGet('/api/academics/classrooms/', schoolId, {}, { timeout: 30000 });
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setClassrooms(data);
      return data;
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      throw error;
    }
  }, [currentSchoolId]);

  // Fetch sections
  const refreshSections = useCallback(async (schoolId = currentSchoolId) => {
    if (!schoolId) return;
    
    try {
      const response = await scopedGet('/api/academics/sections/', schoolId, {}, { timeout: 15000 });
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setSections(data);
      return data;
    } catch (error) {
      console.error('Error fetching sections:', error);
      throw error;
    }
  }, [currentSchoolId]);

  // Fetch students
  const refreshStudents = useCallback(async (schoolId = currentSchoolId) => {
    if (!schoolId) return;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const pageSize = 500;
        const maxPages = 50;
        const all = [];
        const seenIds = new Set();
        let page = 1;
        let repeatedStreak = 0;
        for (; page <= maxPages; page++) {
          const res = await scopedGet('/api/academics/students/', schoolId, { page, page_size: pageSize }, { timeout: 60000 });
          const data = res.data;
          const arr = Array.isArray(data) ? data : (data?.results || []);
          if (!arr.length) break;
          let newAdded = 0;
          for (const s of arr) {
            const sid = String(s.id ?? s.student_id ?? '');
            if (!sid) continue;
            if (!seenIds.has(sid)) {
              seenIds.add(sid);
              all.push(s);
              newAdded++;
            }
          }
          if (newAdded === 0) {
            repeatedStreak += 1;
          } else {
            repeatedStreak = 0;
          }
          const hasNext = Boolean((data?.next || '').length);
          if (hasNext) continue;
          if (typeof data?.count === 'number') {
            if (page * pageSize >= data.count) break;
          } else {
            if (arr.length < pageSize) break;
            if (repeatedStreak >= 2) break;
          }
        }
        const dataAll = all;
        console.log(`Fetched ${dataAll.length} students across pages. Sorting...`);
        let sorted = [];
        try {
          sorted = [...dataAll].sort((a, b) => {
            const rA = String(a?.roll_number ?? '').trim();
            const rB = String(b?.roll_number ?? '').trim();
            const emptyA = !rA;
            const emptyB = !rB;
            if (emptyA && !emptyB) return 1;
            if (!emptyA && emptyB) return -1;
            if (emptyA && emptyB) return 0;
            const ar = parseInt(rA.replace(/\D/g, ''), 10);
            const br = parseInt(rB.replace(/\D/g, ''), 10);
            const aNum = Number.isNaN(ar) ? null : ar;
            const bNum = Number.isNaN(br) ? null : br;
            if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
            return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
          });
        } catch (sortErr) {
          console.error('Sorting failed, using unsorted data:', sortErr);
          sorted = dataAll;
        }
        setStudents(sorted);
        return sorted;
      } catch (error) {
        attempts++;
        console.error(`Error fetching students (attempt ${attempts}/${maxAttempts}):`, error);
        if (attempts >= maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, attempts * 1000));
      }
    }
  }, [currentSchoolId]);

  const fetchStudentsScoped = useCallback(async (schoolId = currentSchoolId, filters = {}) => {
    if (!schoolId) return [];
    let all = [];
    try {
      const pageSize = 500;
      const maxPages = 30;
      const seenIds = new Set();
      for (let page = 1; page <= maxPages; page++) {
        const params = { page, page_size: pageSize, ...filters };
        const res = await scopedGet('/api/academics/students/', schoolId, params, { timeout: 60000 });
        const data = res.data;
        const arr = Array.isArray(data) ? data : (data?.results || []);
        if (!arr.length) break;
        for (const s of arr) {
          const sid = String(s.id ?? s.student_id ?? '');
          if (!sid || seenIds.has(sid)) continue;
          seenIds.add(sid);
          all.push(s);
        }
        const hasNext = Boolean((data?.next || '').length);
        if (hasNext) continue;
        if (typeof data?.count === 'number') {
          if (page * pageSize >= data.count) break;
        } else {
          if (arr.length < pageSize) break;
        }
      }
    } catch (error) {
        return [];
    }
      let sorted = [];
      try {
        sorted = [...all].sort((a, b) => {
          const rA = String(a?.roll_number ?? '').trim();
          const rB = String(b?.roll_number ?? '').trim();
          const emptyA = !rA;
          const emptyB = !rB;
          if (emptyA && !emptyB) return 1;
          if (!emptyA && emptyB) return -1;
          if (emptyA && emptyB) return 0;
          const ar = parseInt(rA.replace(/\D/g, ''), 10);
          const br = parseInt(rB.replace(/\D/g, ''), 10);
          const aNum = Number.isNaN(ar) ? null : ar;
          const bNum = Number.isNaN(br) ? null : br;
          if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
          return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
        });
      } catch (_) {
        sorted = all;
      }
      return sorted;
  }, [currentSchoolId]);

  // Fetch subjects
  const refreshSubjects = useCallback(async (schoolId = currentSchoolId) => {
    if (!schoolId) return;
    
    try {
      const response = await scopedGet('/api/academics/subjects/', schoolId, {}, { timeout: 15000 });
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setSubjects(data);
      return data;
    } catch (error) {
      console.error('Error fetching subjects:', error);
      throw error;
    }
  }, [currentSchoolId]);

  // Refresh all academic data
  const refreshAll = useCallback(async (schoolId) => {
    if (!schoolId) return;
    
    setLoading(true);
    setCurrentSchoolId(schoolId);
    
    try {
      const results = await Promise.allSettled([
        refreshClassrooms(schoolId),
        refreshSections(schoolId),
        refreshStudents(schoolId),
        refreshSubjects(schoolId)
      ]);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length) {
        console.warn('Some academic data failed to refresh:', failed.map(f => f.reason?.message || f.reason));
      }
    } catch (error) {
      console.error('Error refreshing academic data:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshClassrooms, refreshSections, refreshStudents, refreshSubjects]);

  // Clear all data (useful when switching schools or logging out)
  const clearData = useCallback(() => {
    setClassrooms([]);
    setSections([]);
    setStudents([]);
    setSubjects([]);
    setCurrentSchoolId(null);
  }, []);

  const value = {
    // Data
    classrooms,
    sections,
    students,
    subjects,
    loading,
    currentSchoolId,
    
    // Actions
    refreshClassrooms,
    refreshSections,
    refreshStudents,
    refreshSubjects,
    refreshAll,
    clearData,
    fetchStudentsScoped,
    
    // Setters (for external updates)
    setClassrooms,
    setSections,
    setStudents,
    setSubjects
  };

  return (
    <AcademicsContext.Provider value={value}>
      {children}
    </AcademicsContext.Provider>
  );
};

export default AcademicsContext;
