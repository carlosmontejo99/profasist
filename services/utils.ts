
import { Group, Session, Student } from '../types';
import * as XLSX from 'xlsx';

declare global {
  interface Window {
    Android?: {
      startRecording: (sessionId: string, fileName: string, durationMinutes: number) => void;
      stopRecording: () => void;
      openFile: (path: string) => void;
      saveFile?: (base64Data: string, fileName: string, mimeType: string) => void;
      downloadFile?: (base64Data: string, fileName: string, mimeType: string) => void;
      exitApp?: () => void;
      openAppSettings?: () => void;
      isBiometricAvailable?: () => boolean;
      authenticateBiometric?: () => void;
    };
    NativeAudio?: {
      startRecording: (fileName: string) => void;
      stopRecording: () => string;
    };
    onRecordingComplete?: (sessionId: string, fileName: string, path: string, duration: number) => void;
  }
}

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const formatDateFriendly = (isoDate: string) => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d); 
  return dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const triggerDownload = async (fileName: string, blob: Blob) => {
  if (window.Android && (window.Android.saveFile || window.Android.downloadFile)) {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result as string;
        const base64Data = resultStr.split(',')[1];
        if (window.Android?.saveFile) {
          window.Android.saveFile(base64Data, fileName, blob.type);
        } else if (window.Android?.downloadFile) {
          window.Android.downloadFile!(base64Data, fileName, blob.type);
        }
      };
      reader.readAsDataURL(blob);
      return;
    } catch (err) {
      console.error("Error saving file via native Android bridge:", err);
    }
  }

  try {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (_) {}
  webDownload(fileName, blob);
};

const webDownload = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 150);
};

export interface StudentStats {
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
}

export const calculateStudentStats = (group: Group, studentId: string): StudentStats => {
  const validSessions = group.sessions.filter(s => Object.keys(s.attendance).length > 0);
  let present = 0, absent = 0, late = 0, excused = 0;

  validSessions.forEach(session => {
    const record = session.attendance[studentId];
    if (!record) { absent++; return; }
    switch (record.status) {
      case 'present': present++; break;
      case 'late': late++; break;
      case 'absent': absent++; break;
      case 'excused': excused++; break;
    }
  });

  const totalSessions = validSessions.length;
  const positiveAttendance = present + late + excused;
  const percentage = totalSessions === 0 ? 0 : Math.round((positiveAttendance / totalSessions) * 100);
  
  return { totalSessions, present, absent, late, excused, percentage };
};

export const parseStudentCSV = (text: string): Student[] => {
  const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l !== "");
  if (lines.length === 0) return [];
  const startIdx = (lines[0].toLowerCase().includes('nombre')) ? 1 : 0;
  const students: Student[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`)).map(p => p.replace(/^"|"$/g, '').trim());
    if (parts.length >= 2) {
      students.push({ id: generateUUID(), name: `${parts[0]} ${parts[1]}`.trim(), rollNumber: parts[2] || "" });
    } else if (parts[0]) {
      students.push({ id: generateUUID(), name: parts[0], rollNumber: "" });
    }
  }
  return students;
};

export const parseICSContent = (icsContent: string): Group[] => {
  const unfoldedContent = icsContent.replace(/\r\n /g, '').replace(/\n /g, '');
  const eventBlocks = unfoldedContent.split('BEGIN:VEVENT').slice(1);
  
  // Map to group sessions and schedule by subject name
  const groupsMap = new Map<string, { 
    sessions: Session[], 
    daysSet: Set<number>, 
    startTime: string, 
    endTime: string 
  }>();
  
  const DAYS_CODES: Record<string, number> = { 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6, 'SU': 0 };
  const daysShortNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  eventBlocks.forEach(block => {
    const summary = block.match(/SUMMARY:(.*)/)?.[1]?.trim() || 'Clase';
    const dtStartRaw = block.match(/DTSTART(?:;TZID=.*)?:(\d{8}T\d{6})/)?.[1];
    const dtEndRaw = block.match(/DTEND(?:;TZID=.*)?:(\d{8}T\d{6})/)?.[1];
    const rrule = block.match(/RRULE:(.*)/)?.[1];
    
    if (!dtStartRaw) return;

    // Parse precise times
    const startTime = `${dtStartRaw.substring(9, 11)}:${dtStartRaw.substring(11, 13)}`;
    const endTime = dtEndRaw ? `${dtEndRaw.substring(9, 11)}:${dtEndRaw.substring(11, 13)}` : '';
    
    const startDate = new Date(
      parseInt(dtStartRaw.substring(0, 4)), 
      parseInt(dtStartRaw.substring(4, 6)) - 1, 
      parseInt(dtStartRaw.substring(6, 8))
    );
    
    let untilDate = new Date(startDate); 
    untilDate.setMonth(untilDate.getMonth() + 6); // Default 6 months of classes
    
    const eventDays = new Set<number>();
    if (rrule) {
      const untilMatch = rrule.match(/UNTIL=(\d{8})/);
      if (untilMatch) untilDate = new Date(parseInt(untilMatch[1].substring(0, 4)), parseInt(untilMatch[1].substring(4, 6)) - 1, parseInt(untilMatch[1].substring(6, 8)));
      
      const byDayMatch = rrule.match(/BYDAY=([^;]*)/);
      if (byDayMatch) {
        byDayMatch[1].split(',').forEach(d => {
          const code = d.slice(-2);
          if (DAYS_CODES[code] !== undefined) eventDays.add(DAYS_CODES[code]);
        });
      }
    }
    
    // If no recurrency days found, it's just the day it starts
    if (eventDays.size === 0) eventDays.add(startDate.getDay());
    
    const sessions: Session[] = [];
    let curr = new Date(startDate);
    while (curr <= untilDate) {
      if (eventDays.has(curr.getDay())) {
        sessions.push({ 
          id: generateUUID(), 
          date: curr.toISOString().split('T')[0], 
          startTime, 
          endTime: endTime || '00:00', 
          attendance: {}, 
          totalPresent: 0, 
          totalStudents: 0 
        });
      }
      curr.setDate(curr.getDate() + 1);
    }

    // Consolidate in the map
    if (groupsMap.has(summary)) {
      const g = groupsMap.get(summary)!;
      g.sessions = [...g.sessions, ...sessions];
      eventDays.forEach(d => g.daysSet.add(d));
      // Keep the earliest start time if different events exist
      if (startTime < g.startTime) g.startTime = startTime;
      if (endTime > g.endTime) g.endTime = endTime;
    } else {
      groupsMap.set(summary, { 
        sessions, 
        daysSet: eventDays, 
        startTime, 
        endTime 
      });
    }
  });

  // Convert map to Group objects with complete schedule summaries
  return Array.from(groupsMap.entries()).map(([name, data]) => {
    // Sort days chronologically (Lun to Dom)
    const sortedDays = Array.from(data.daysSet).sort((a, b) => {
        // Adjust for Lun-Dom sort (1, 2, 3, 4, 5, 6, 0)
        const valA = a === 0 ? 7 : a;
        const valB = b === 0 ? 7 : b;
        return valA - valB;
    });

    const timeRange = data.endTime ? `${data.startTime} - ${data.endTime}` : data.startTime;
    const scheduleSummary = `${sortedDays.map(d => daysShortNames[d]).join(', ')} ${timeRange}`;

    return {
      id: generateUUID(),
      name,
      semester: '2026-A',
      scheduleSummary,
      students: [],
      sessions: data.sessions.sort((a, b) => a.date.localeCompare(b.date)),
      color: '#4f46e5',
      archived: false
    };
  });
};

export const generateXLSX = (group: Group, customTitle?: string): void => {
  const sortedSessions = [...group.sessions].sort((a, b) => a.date.localeCompare(b.date));
  
  const header = [
    [customTitle || "PROFASIST - REGISTRO Y CONTROL DE ASISTENCIA ACADÉMICA"],
    ["Materia:", group.name.toUpperCase(), "Ciclo / Semestre:", group.semester],
    ["Total Alumnos:", group.students.length, "Total Sesiones Impartidas:", sortedSessions.length],
    ["Fecha de Generación:", new Date().toLocaleDateString('es-MX')],
    []
  ];

  const tableHeaders = [
    "Matrícula", "Nombre Completo", "Asistencias (P)", "Retardos (R)", "Justificantes (J)", "Faltas (F)", "% Asistencia",
    ...sortedSessions.map(s => s.date)
  ];

  // Ordenar alfabéticamente a los alumnos por nombre para una exportación limpia y ordenada
  const sortedStudents = [...group.students].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  const rows = sortedStudents.map(student => {
    const stats = calculateStudentStats(group, student.id);
    const dayRecords = sortedSessions.map(s => {
      const r = s.attendance[student.id];
      if (!r) return '-';
      switch(r.status) {
        case 'present': return 'P';
        case 'absent': return 'F';
        case 'late': return 'R';
        case 'excused': return 'J';
        default: return '-';
      }
    });
    return [
      student.rollNumber || 'S/M', 
      student.name, 
      stats.present, 
      stats.late, 
      stats.excused, 
      stats.absent, 
      stats.percentage / 100, // Exported as standard decimal for Excel percentage format
      ...dayRecords
    ];
  });

  const footer = [
    [],
    ["", "TOTAL PRESENTES DEL DÍA", "", "", "", "", "", ...sortedSessions.map(s => {
      return Object.values(s.attendance).filter(a => a.status !== 'absent').length;
    })]
  ];

  const ws = XLSX.utils.aoa_to_sheet([...header, tableHeaders, ...rows, ...footer]);

  // Calculate maximum dynamic column widths
  const maxRollLen = Math.max(12, ...sortedStudents.map(s => (s.rollNumber || '').length + 3));
  const maxNameLen = Math.max(32, ...sortedStudents.map(s => (s.name || '').length + 3));

  ws['!cols'] = [
    { wch: maxRollLen }, 
    { wch: maxNameLen }, 
    { wch: 14 }, 
    { wch: 14 }, 
    { wch: 15 }, 
    { wch: 12 }, 
    { wch: 15 }, 
    ...sortedSessions.map(() => ({ wch: 13 }))
  ];

  // Freeze top metadata header & student name columns
  ws['!views'] = [
    { state: 'frozen', xSplit: 2, ySplit: 6, topLeftCell: 'C7', activePane: 'bottomRight' }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia Grupal");
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Limpiar caracteres no permitidos en nombres de archivos
  const sanitizedTitle = (customTitle || group.name).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-_]/g, '').trim().replace(/\s+/g, '_');
  triggerDownload(`${sanitizedTitle}_Asistencia.xlsx`, blob);
};
