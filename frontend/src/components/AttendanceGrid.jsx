import React, { useEffect, useState } from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell, Checkbox, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

export default function AttendanceGrid({ students = [], date, schoolId, onSave }) {
  const [records, setRecords] = useState([]);
  const navigate = useNavigate();

  useEffect(()=> {
    const initial = students.map(s => ({ student: s.id, present: true, date, school: schoolId }));
    setRecords(initial);
  }, [students, date, schoolId]);

  const toggle = (index) => {
    const copy = [...records];
    copy[index].present = !copy[index].present;
    setRecords(copy);
  };

  const handleSave = () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    onSave(records);
  };

  if (!students.length) return <div>No students</div>;

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Student</TableCell>
            <TableCell>Present</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {students.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell>{s.user?.first_name} {s.user?.last_name}</TableCell>
              <TableCell>
                <Checkbox checked={records[i]?.present || false} onChange={() => toggle(i)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button variant="contained" sx={{ mt:2 }} onClick={handleSave}>Save Attendance</Button>
    </>
  );
}
