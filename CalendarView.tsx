import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  User, 
  Check, 
  X, 
  Clock, 
  Edit2, 
  Plus, 
  AlertTriangle 
} from 'lucide-react';
import { Group, Session, Student, AttendanceStatus, AttendanceRecord } from './types';
import * as Storage from './services/storage';
import * as Utils from './services/utils';

interface CalendarViewProps {
  group: Group;
  onNavigateToSession: (session: Session) => void;
  onRefresh: () => void;
  onNotification: (msg: string) => void;
  attendanceThreshold: number;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  group,
  onNavigateToSession,
  onRefresh,
  onNotification,
  attendanceThreshold
}) => {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0-indexed
  
  // Selected day number in the current calendar view
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(now.getDate());

  const monthsEs = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Handle month change
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    setSelectedDayNum(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDayNum(null);
  };

  // Get days in the selected month
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Day of the week for the first day of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayRaw = new Date(currentYear, currentMonth, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  // Helper to get formatted date string: YYYY-MM-DD
  const formatDateString = (day: number) => {
    return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getSessionForDay = (day: number) => {
    const dateStr = formatDateString(day);
    return group.sessions.find(s => s.date === dateStr);
  };

  // Quick edit status for a student in a session
  const handleQuickStatusChange = (session: Session, studentId: string, status: AttendanceStatus) => {
    const updatedSessions = group.sessions.map(s => {
      if (s.id !== session.id) return s;

      const currentRecord = s.attendance[studentId];
      const nowTimestamp = Date.now();

      const newAttendance = { ...s.attendance };
      newAttendance[studentId] = {
        studentId,
        status,
        timestamp: currentRecord?.timestamp || nowTimestamp
      };

      // Recalculate present count
      let presentCount = 0;
      (Object.values(newAttendance) as any[]).forEach(rec => {
        if (rec.status === 'present' || rec.status === 'late' || rec.status === 'excused') {
          presentCount++;
        }
      });

      return {
        ...s,
        attendance: newAttendance,
        totalPresent: presentCount,
        totalStudents: group.students.length
      };
    });

    const updatedGroup = {
      ...group,
      sessions: updatedSessions
    };

    Storage.saveGroup(updatedGroup);
    onRefresh();
    onNotification(`Asistencia actualizada.`);
  };

  // Create a session for a specific day
  const handleCreateSession = (day: number) => {
    const dateStr = formatDateString(day);
    
    // Check if session already exists
    if (group.sessions.some(s => s.date === dateStr)) {
      onNotification('Ya existe una sesión para este día.');
      return;
    }

    const newSession: Session = {
      id: Utils.generateUUID(),
      date: dateStr,
      startTime: '08:00',
      endTime: '10:00',
      attendance: {},
      totalPresent: 0,
      totalStudents: group.students.length
    };

    const updatedGroup = {
      ...group,
      sessions: [...group.sessions, newSession]
    };

    Storage.saveGroup(updatedGroup);
    onRefresh();
    onNotification(`Sesión iniciada para el ${Utils.formatDateFriendly(dateStr)}`);
    // Automatically select the new day's session
    setSelectedDayNum(day);
  };

  // Selected Day Information
  const selectedDateStr = selectedDayNum ? formatDateString(selectedDayNum) : null;
  const selectedSession = selectedDayNum ? getSessionForDay(selectedDayNum) : null;

  return (
    <div className="space-y-6">
      {/* CALENDARIO MENSUAL CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm">
        {/* Encabezado del mes */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-indigo-600 dark:text-indigo-400" size={22} />
            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">
              {monthsEs[currentMonth]} {currentYear}
            </h3>
          </div>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={handleNextMonth}
              className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition text-slate-600 dark:text-slate-300"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {daysOfWeek.map((day, i) => (
            <span key={i} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1">
              {day}
            </span>
          ))}
        </div>

        {/* Cuadrícula de días */}
        <div className="grid grid-cols-7 gap-2">
          {/* Espacios vacíos al principio */}
          {Array.from({ length: startOffset }).map((_, idx) => (
            <div key={`empty-${idx}`} className="aspect-square"></div>
          ))}

          {/* Días del mes */}
          {Array.from({ length: totalDays }).map((_, idx) => {
            const dayNum = idx + 1;
            const session = getSessionForDay(dayNum);
            const isSelected = selectedDayNum === dayNum;
            const isToday = now.getDate() === dayNum && now.getMonth() === currentMonth && now.getFullYear() === currentYear;

            // Highlight color based on the group color if session exists
            const sessionColor = group.color || '#4f46e5';

            return (
              <button
                key={`day-${dayNum}`}
                onClick={() => setSelectedDayNum(dayNum)}
                style={{
                  borderColor: isSelected ? sessionColor : undefined
                }}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-between p-1.5 transition-all relative border active:scale-95 ${
                  isSelected 
                    ? 'border-2 shadow-sm' 
                    : 'border-slate-100 dark:border-slate-800/60'
                } ${
                  isToday 
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20' 
                    : 'bg-slate-50/20 dark:bg-slate-900/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Indicador de Clase superior */}
                <div className="w-full flex justify-end">
                  {session ? (
                    <span 
                      style={{ backgroundColor: sessionColor }}
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm animate-pulse"
                      title="Día de Clase"
                    />
                  ) : (
                    <span className="w-2.5 h-2.5" />
                  )}
                </div>

                {/* Número del día */}
                <span className={`text-sm font-black ${
                  isSelected 
                    ? 'text-indigo-600 dark:text-indigo-400' 
                    : isToday 
                      ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' 
                      : 'text-slate-700 dark:text-slate-300'
                }`}>
                  {dayNum}
                </span>

                {/* Mini información de asistencia */}
                <div className="w-full h-1.5 flex gap-0.5 rounded-full overflow-hidden mt-0.5">
                  {session && group.students.length > 0 ? (
                    (() => {
                      const present = (Object.values(session.attendance) as any[]).filter(r => r.status === 'present').length;
                      const absent = (Object.values(session.attendance) as any[]).filter(r => r.status === 'absent').length;
                      const late = (Object.values(session.attendance) as any[]).filter(r => r.status === 'late').length;
                      const excused = (Object.values(session.attendance) as any[]).filter(r => r.status === 'excused').length;
                      const totalWithStatus = present + absent + late + excused;

                      if (totalWithStatus === 0) {
                        return <div className="w-full h-full bg-slate-200 dark:bg-slate-700"></div>;
                      }

                      return (
                        <>
                          {present > 0 && <div className="bg-emerald-500 h-full" style={{ flexGrow: present }}></div>}
                          {late > 0 && <div className="bg-amber-500 h-full" style={{ flexGrow: late }}></div>}
                          {excused > 0 && <div className="bg-blue-500 h-full" style={{ flexGrow: excused }}></div>}
                          {absent > 0 && <div className="bg-rose-500 h-full" style={{ flexGrow: absent }}></div>}
                        </>
                      );
                    })()
                  ) : (
                    <div className="w-full h-full bg-transparent"></div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DETALLES DEL DÍA SELECCIONADO */}
      {selectedDayNum && selectedDateStr && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-slate-50 dark:border-slate-800/80 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">
                  Fecha Seleccionada
                </span>
                <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                  {Utils.formatDateFriendly(selectedDateStr)}
                </h4>
              </div>
              <CalendarIcon size={24} className="text-slate-300 shrink-0" />
            </div>

            {selectedSession ? (
              <div className="space-y-4">
                {/* Resumen del pase de lista */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Asistencia General
                    </span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase">
                      {selectedSession.totalStudents > 0 
                        ? Math.round((selectedSession.totalPresent / selectedSession.totalStudents) * 100) 
                        : 0}% ({selectedSession.totalPresent}/{selectedSession.totalStudents})
                    </span>
                  </div>

                  {/* Barra de progreso de asistencia */}
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    {(() => {
                      const present = (Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'present').length;
                      const late = (Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'late').length;
                      const excused = (Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'excused').length;
                      const absent = (Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'absent').length;
                      const unrecorded = group.students.length - (present + late + excused + absent);

                      return (
                        <>
                          {present > 0 && (
                            <div 
                              className="bg-emerald-500 h-full" 
                              style={{ width: `${(present / group.students.length) * 100}%` }}
                              title={`${present} Presentes`}
                            />
                          )}
                          {late > 0 && (
                            <div 
                              className="bg-amber-400 h-full" 
                              style={{ width: `${(late / group.students.length) * 100}%` }}
                              title={`${late} Retardos`}
                            />
                          )}
                          {excused > 0 && (
                            <div 
                              className="bg-blue-400 h-full" 
                              style={{ width: `${(excused / group.students.length) * 100}%` }}
                              title={`${excused} Justificados`}
                            />
                          )}
                          {absent > 0 && (
                            <div 
                              className="bg-rose-500 h-full" 
                              style={{ width: `${(absent / group.students.length) * 100}%` }}
                              title={`${absent} Faltas`}
                            />
                          )}
                          {unrecorded > 0 && (
                            <div 
                              className="bg-slate-200 dark:bg-slate-700 h-full" 
                              style={{ width: `${(unrecorded / group.students.length) * 100}%` }}
                              title={`${unrecorded} Sin registrar`}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Etiquetas del Resumen de Clases */}
                  <div className="grid grid-cols-4 gap-2 text-center mt-3 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-2xl">
                    <div>
                      <span className="text-[9px] font-black text-emerald-600 uppercase block">PRESENTE</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        {(Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'present').length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-amber-500 uppercase block">RETARDO</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        {(Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'late').length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-blue-500 uppercase block">JUSTIFICADO</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        {(Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'excused').length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-rose-500 uppercase block">FALTA</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">
                        {(Object.values(selectedSession.attendance) as any[]).filter(r => r.status === 'absent').length}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedSession.topic && (
                  <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/10 p-4 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">TEMA PLANEADO</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{selectedSession.topic}</p>
                  </div>
                )}

                {/* Botón para pantalla completa de asistencia */}
                <button 
                  onClick={() => onNavigateToSession(selectedSession)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transitionactive:scale-95"
                >
                  <Edit2 size={16} /> Ver Pantalla de Pase Completa
                </button>

                {/* --- SECCIÓN EDICIÓN RÁPIDA --- */}
                <div className="pt-4 border-t border-slate-50 dark:border-slate-800/80">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                    Edición Rápida de Alumnos
                  </h5>
                  
                  {group.students.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No hay alumnos agregados a esta materia.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {group.students.map(student => {
                        const record = selectedSession.attendance[student.id];
                        const currentStatus = record?.status;

                        return (
                          <div 
                            key={student.id} 
                            className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 shadow-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <h6 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate leading-tight">
                                {student.name}
                              </h6>
                              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-0.5">
                                {student.rollNumber || 'S/M'}
                              </span>
                            </div>
                            
                            {/* Control rápido de asistencia */}
                            <div className="flex gap-1 shrink-0 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                              <button
                                onClick={() => handleQuickStatusChange(selectedSession, student.id, 'present')}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                  currentStatus === 'present'
                                    ? 'bg-emerald-500 text-white shadow'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                                title="Presente"
                              >
                                P
                              </button>
                              <button
                                onClick={() => handleQuickStatusChange(selectedSession, student.id, 'late')}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                  currentStatus === 'late'
                                    ? 'bg-amber-400 text-slate-900 shadow'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                                title="Retardo"
                              >
                                R
                              </button>
                              <button
                                onClick={() => handleQuickStatusChange(selectedSession, student.id, 'excused')}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                  currentStatus === 'excused'
                                    ? 'bg-blue-500 text-white shadow'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                                title="Justificado"
                              >
                                J
                              </button>
                              <button
                                onClick={() => handleQuickStatusChange(selectedSession, student.id, 'absent')}
                                className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-all ${
                                  currentStatus === 'absent'
                                    ? 'bg-rose-500 text-white shadow'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                                title="Falta"
                              >
                                F
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
                  No hay clases registradas para este día de la semana.
                </p>
                <button
                  onClick={() => handleCreateSession(selectedDayNum)}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 active:scale-95 transition shadow-md"
                >
                  <Plus size={16} /> Iniciar Pase Para Esta Fecha
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
