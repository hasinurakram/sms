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
      console.log(`Fetched ${data.length} students. Sorting...`);
      
      let sorted = [];
      try {
        sorted = [...data].sort((a, b) => {
          const rA = String(a?.roll_number ?? '').trim();
          const rB = String(b?.roll_number ?? '').trim();
  
          const emptyA = !rA;
          const emptyB = !rB;
  
          if (emptyA && !emptyB) return 1;
          if (!emptyA && emptyB) return -1;
          if (emptyA && emptyB) return 0;
  
          // Try numeric sort for non-empty values
          const ar = parseInt(rA.replace(/\D/g, ''), 10);
          const br = parseInt(rB.replace(/\D/g, ''), 10);
          
          const aNum = Number.isNaN(ar) ? null : ar;
          const bNum = Number.isNaN(br) ? null : br;
          
          // If both have extractable numbers, compare them first
          if (aNum !== null && bNum !== null && aNum !== bNum) {
              return aNum - bNum;
          }
          
          // Fallback to string comparison
          return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
        });
      } catch (sortErr) {
        console.error('Sorting failed, using unsorted data:', sortErr);
        sorted = data;
      }
      
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
