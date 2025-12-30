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
      const response = await scopedGet('/api/academics/classrooms/', schoolId, {}, { timeout: 15000 });
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
    
    try {
      const response = await scopedGet('/api/academics/students/', schoolId, {}, { timeout: 15000 });
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      const sorted = [...data].sort((a, b) => {
        const ar = parseInt(String(a?.roll_number ?? '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b?.roll_number ?? '').replace(/\D/g, ''), 10);
        const aNum = Number.isNaN(ar) ? null : ar;
        const bNum = Number.isNaN(br) ? null : br;
        if (aNum !== null && bNum !== null) return aNum - bNum;
        const as = String(a?.roll_number ?? '');
        const bs = String(b?.roll_number ?? '');
        return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
      });
      setStudents(sorted);
      return sorted;
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
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
