import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, CheckCircle2, UserPlus, 
  Upload, ChevronLeft, Save, FileSpreadsheet, 
  Plus, ArrowRight, Clock, BookOpen, 
  Moon, Sun, X, Edit2, Trash2, User, AlertCircle, Archive,
  Settings, Palette, Sparkles, Bot, Send, Loader2,
  Copy, Check, MessageSquare, AlertTriangle, Wand2, Info,
  Mic, Pause, Play, Download, Volume2, Folder, FolderPlus,
  Sliders, UserCheck, TrendingUp, CloudRain, SunDim, BarChart3, Mail, FileAudio,
  Cloud, RefreshCw, CloudUpload, Unlink, Search, Filter, Bell, BellOff, Share2,
  Shield, Fingerprint, Dices, VolumeX, Smartphone
} from 'lucide-react';
import { AppData, Group, Session, Student, ViewState, AttendanceRecord, AttendanceStatus, AppTheme } from './types';
import * as Storage from './services/storage';
import { VoiceRecorder } from "@independo/capacitor-voice-recorder";
import * as Utils from './services/utils';
import * as GDriveService from './services/gdrive';
import { CalendarView } from './CalendarView';
import { AttendanceChart } from './AttendanceChart';
import { EvaluationSection } from './src/components/EvaluationSection';
import { AcademicAnalytics } from './src/components/AcademicAnalytics';
import { AcademicClosure } from './src/components/AcademicClosure';
import { StudentImporter } from './src/components/StudentImporter';
import { AudioHaptics } from './services/audioHaptics';
import { NotificationServ } from './services/notificationService';
import { StudentRandomizerModal } from './src/components/StudentRandomizerModal';
import { ClassroomTimerModal } from './src/components/ClassroomTimerModal';

const PRESET_COLORS = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', 
  '#ec4899', '#8b5cf6', '#64748b', '#000000'
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// --- DASHBOARD ---
const Dashboard: React.FC<{
  data: AppData;
  onGroupSelect: (g: Group) => void;
  onImportClick: () => void;
  onCreateClick: () => void;
  onGroupSettings: (g: Group) => void;
  onToggleTheme: () => void;
  isDark: boolean;
  onOpenRecorder: () => void;
  onSettingsClick: () => void;
}> = ({ 
  data, onGroupSelect, onImportClick, onCreateClick, onGroupSettings, onToggleTheme, isDark, onOpenRecorder, onSettingsClick
}) => {
  const [showArchived, setShowArchived] = useState(false);
  const activeGroups = data.groups.filter(g => !g.archived);
  const archivedGroups = data.groups.filter(g => g.archived);
  const groups = showArchived ? data.groups : activeGroups;

  if (data.groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 landscape:p-4 bg-slate-50 dark:bg-slate-950 transition-colors relative overflow-y-auto max-h-screen">
        <button onClick={onToggleTheme} className="absolute top-12 right-6 landscape:top-4 landscape:right-4 p-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full active:scale-90 shadow-lg border border-slate-100 dark:border-slate-700 z-50">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="w-28 h-28 landscape:w-20 landscape:h-20 mb-8 landscape:mb-3 shrink-0 flex items-center justify-center relative">
          <div className="absolute inset-0 bg-indigo-500/15 dark:bg-indigo-400/10 rounded-[2.5rem] blur-xl animate-pulse"></div>
          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10 drop-shadow-xl">
            <defs>
              <linearGradient id="logo-primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="logo-emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            {/* Elegant outer rounded square */}
            <rect x="15" y="15" width="90" height="90" rx="28" fill="url(#logo-primary-grad)" />
            {/* White journal lines representing attendance list */}
            <path d="M42 42 H78" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.35" />
            <path d="M42 56 H78" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.35" />
            <path d="M42 70 H62" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.35" />
            
            {/* Glowing attendance check badge */}
            <circle cx="84" cy="84" r="21" fill="url(#logo-emerald-grad)" stroke="#ffffff" strokeWidth="4" />
            <path d="M76 84 L81 89 L91 78" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl landscape:text-2xl font-black text-slate-900 dark:text-white mb-3 landscape:mb-1.5 text-center leading-tight">Bienvenido a ProfAsist</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 landscape:mb-4 text-center max-w-xs leading-relaxed text-sm">Gestión de asistencia profesional y segura para profesores.</p>
        
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button onClick={onImportClick} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2.5 active:scale-95 transition-all">
            <Upload size={18} /> Importar Horario (.ics)
          </button>
          <button onClick={onOpenRecorder} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-indigo-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Mic size={18} /> Grabar Clase o Nota
          </button>
          <button onClick={onSettingsClick} className="w-full py-4 bg-slate-900 dark:bg-slate-850 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
            <Settings size={18} /> Ajustes del Profesor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="px-6 pt-12 pb-6 portrait:pt-10 portrait:pb-5 landscape:pt-3 landscape:pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 landscape:w-9 landscape:h-9 shrink-0 relative flex items-center justify-center">
              <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-md">
                <defs>
                  <linearGradient id="header-logo-primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  <linearGradient id="header-logo-emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                {/* Elegant outer rounded square */}
                <rect x="15" y="15" width="90" height="90" rx="28" fill="url(#header-logo-primary-grad)" />
                {/* White journal lines representing attendance list */}
                <path d="M42 42 H78" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.35" />
                <path d="M42 56 H78" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.35" />
                <path d="M42 70 H62" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.35" />
                
                {/* Glowing attendance check badge */}
                <circle cx="84" cy="84" r="21" fill="url(#header-logo-emerald-grad)" stroke="#ffffff" strokeWidth="4" />
                <path d="M76 84 L81 89 L91 78" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mis Clases</h1>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">
                {showArchived ? 'Mostrando Clases Archivadas' : 'Panel Principal • Profesor'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {archivedGroups.length > 0 && (
              <button 
                onClick={() => setShowArchived(!showArchived)} 
                className={`p-2.5 rounded-full active:scale-90 transition border ${showArchived ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                title={showArchived ? "Ocultar Clases Archivadas" : "Mostrar Clases Archivadas"}
              >
                <Archive size={18} />
              </button>
            )}
            <button onClick={onToggleTheme} className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full active:scale-90 transition border border-indigo-100/30 dark:border-indigo-800/20" title="Galería de Temas Visuales (6 Estilos)">
              <Palette size={18} />
            </button>
            <button onClick={onSettingsClick} className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-full active:scale-90 transition border border-sky-100/30 dark:border-sky-800/20" title="Ajustes del Profesor (Respaldos y Alertas)">
              <Settings size={18} />
            </button>
            <button onClick={onImportClick} className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full active:scale-90 transition border border-indigo-100/30 dark:border-indigo-800/20" title="Importar Horario .ics">
              <Upload size={18} />
            </button>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="grid grid-cols-1 gap-4">
          {groups.map(group => (
            <div key={group.id} onClick={() => onGroupSelect(group)} className="relative bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm active:scale-[0.98] transition-all cursor-pointer overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: group.color }}></div>
              <div className="flex justify-between items-start mb-3 pr-2">
                <h3 className="font-bold text-xl text-slate-900 dark:text-white leading-tight break-words flex-1 truncate pr-2 flex items-center gap-2">
                  {group.name}
                  {group.archived && (
                    <span className="text-[9px] uppercase font-black bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-200/40 dark:border-amber-900/40">Archivada</span>
                  )}
                </h3>
                <button onClick={(e) => { e.stopPropagation(); onGroupSettings(group); }} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl active:bg-indigo-50 active:text-indigo-600 transition ml-2 shadow-sm border border-slate-100 dark:border-slate-700">
                  <Settings size={20} />
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-bold mb-4">
                <Clock size={16} className="text-indigo-500" /> {group.scheduleSummary}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center gap-2 text-slate-400">
                  <Users size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{group.students.length} ALUMNOS</span>
                </div>
                <span className="text-indigo-600 dark:text-indigo-400 text-sm font-black flex items-center gap-1">Entrar <ArrowRight size={16} /></span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Botón flotante para Grabar Audio */}
      <button onClick={onOpenRecorder} className="fixed bottom-8 left-6 py-4 px-6 bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white rounded-full shadow-2xl flex items-center gap-2 active:scale-90 transition-all z-30 font-black text-xs uppercase tracking-wider">
        <Mic size={18} className="animate-pulse" /> Grabar Clase
      </button>

      <button onClick={onCreateClick} className="fixed bottom-8 right-6 w-16 h-16 bg-slate-900 dark:bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition z-30">
        <Plus size={32} />
      </button>
    </div>
  );
};

// --- SESSION ATTENDANCE ---
const SessionAttendance: React.FC<{
  session: Session;
  group: Group;
  attendanceThreshold: number;
  onBack: () => void;
  onSave: (att: Record<string, AttendanceRecord>) => void;
}> = ({ session, group, attendanceThreshold, onBack, onSave }) => {
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>(session.attendance || {});
  const [activeStudentId, setActiveStudentId] = useState<string | null>(() => {
    // Inicializar con el primer alumno sin asistencia, o el primero de la lista
    const unmarked = group.students.find(s => !session.attendance?.[s.id]?.status);
    return unmarked ? unmarked.id : (group.students[0]?.id || null);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'present'>('all');

  const handleAll = (status: AttendanceStatus) => {
    AudioHaptics.playPresent();
    const newAtt: Record<string, AttendanceRecord> = { ...attendance };
    group.students.forEach(s => { newAtt[s.id] = { studentId: s.id, status, timestamp: Date.now() }; });
    setAttendance(newAtt);
    onSave(newAtt);
  };

  const handleStatus = (studentId: string, status: AttendanceStatus) => {
    if (status === 'present') AudioHaptics.playPresent();
    else if (status === 'absent') AudioHaptics.playAbsent();
    else AudioHaptics.playPop();

    const newAtt = { ...attendance, [studentId]: { studentId, status, timestamp: Date.now() } };
    setAttendance(newAtt);
    onSave(newAtt);

    // Auto-scroll: activar y centrar al siguiente alumno
    const currentIndex = group.students.findIndex(s => s.id === studentId);
    if (currentIndex !== -1 && currentIndex + 1 < group.students.length) {
      const nextStudent = group.students[currentIndex + 1];
      setActiveStudentId(nextStudent.id);
      
      setTimeout(() => {
        const el = document.getElementById(`student-card-${nextStudent.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      // Si es el último, simplemente desplaza al actual para mantener el foco
      setTimeout(() => {
        const el = document.getElementById(`student-card-${studentId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const filteredStudents = group.students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (student.rollNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const status = attendance[student.id]?.status;
    if (filterTab === 'pending') {
      return !status;
    }
    if (filterTab === 'present') {
      return status === 'present';
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <header className="px-4 pt-12 pb-4 portrait:pt-10 portrait:pb-3 landscape:pt-3 landscape:pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-500"><ChevronLeft size={32} className="landscape:w-6 landscape:h-6" /></button>
          <div className="min-w-0">
            <h2 className="font-black text-slate-900 dark:text-white leading-tight truncate landscape:text-lg">Pase de Lista</h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{Utils.formatDateFriendly(session.date)}</p>
          </div>
        </div>
        <button onClick={onBack} className="p-4 landscape:p-2.5 bg-indigo-600 text-white rounded-[1.25rem] active:scale-90 transition shadow-xl"><Save size={24} className="landscape:w-5 landscape:h-5" /></button>
      </header>
      
      {session.topic && (
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <BookOpen size={12} /> Tema de Clase
          </p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">{session.topic}</p>
        </div>
      )}

      {/* Alerta general en la parte superior si hay alumnos en riesgo */}
      {(() => {
        const atRiskCount = group.students.filter(st => {
          const stats = Utils.calculateStudentStats(group, st.id);
          return stats.totalSessions > 0 && stats.percentage < attendanceThreshold;
        }).length;
        if (atRiskCount === 0) return null;
        return (
          <div className="bg-rose-500 text-white px-6 py-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-inner animate-pulse shrink-0">
            <AlertTriangle size={14} />
            <span>Hay {atRiskCount} {atRiskCount === 1 ? 'alumno' : 'alumnos'} por debajo del {attendanceThreshold}% de asistencia</span>
          </div>
        );
      })()}

      <div className="bg-white dark:bg-slate-900 p-4 border-b border-slate-100 dark:border-slate-800 space-y-4 shrink-0">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleAll('present')} className="py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-[11px] rounded-2xl active:scale-95 transition uppercase tracking-tighter">Todos Presentes</button>
          <button onClick={() => handleAll('absent')} className="py-4 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 font-black text-[11px] rounded-2xl active:scale-95 transition uppercase tracking-tighter">Todos Faltaron</button>
        </div>

        {/* BÚSQUEDA Y FILTROS */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-slate-400 pointer-events-none" size={16} />
            <input 
              type="text"
              placeholder="Buscar por nombre o matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex p-1 bg-slate-50 dark:bg-slate-800/60 rounded-2xl gap-1">
            <button 
              onClick={() => setFilterTab('all')} 
              className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all duration-200 uppercase tracking-wider ${
                filterTab === 'all' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Todos ({group.students.length})
            </button>
            <button 
              onClick={() => setFilterTab('pending')} 
              className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all duration-200 uppercase tracking-wider ${
                filterTab === 'pending' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Pendientes ({group.students.filter(s => !attendance[s.id]?.status).length})
            </button>
            <button 
              onClick={() => setFilterTab('present')} 
              className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all duration-200 uppercase tracking-wider ${
                filterTab === 'present' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Presentes ({group.students.filter(s => attendance[s.id]?.status === 'present').length})
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28 flex flex-col gap-4">
        {filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <Users size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">No se encontraron alumnos</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Prueba cambiando tu búsqueda o filtros.</p>
          </div>
        ) : (
          filteredStudents.map(student => {
            const s = attendance[student.id]?.status;
            const stats = Utils.calculateStudentStats(group, student.id);
            const isAtRisk = stats.totalSessions > 0 && stats.percentage < attendanceThreshold;
            const isActive = activeStudentId === student.id;

            return (
              <div 
                key={student.id} 
                id={`student-card-${student.id}`}
                onClick={() => setActiveStudentId(student.id)}
                className={`p-6 rounded-[2.5rem] border shadow-sm transition-all duration-300 cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-50/15 dark:bg-indigo-950/10 border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/50 dark:ring-indigo-400/30 shadow-md transform scale-[1.01]' 
                    : isAtRisk 
                      ? 'bg-rose-50/10 dark:bg-rose-950/5 border-rose-200 dark:border-rose-950/40 bg-white dark:bg-slate-900' 
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight break-words flex items-center gap-2">
                      {student.name}
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-ping"></span>
                      )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{student.rollNumber || 'S/M'}</span>
                      {stats.totalSessions > 0 ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isAtRisk ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'}`}>
                          {stats.percentage}% Asistencia ({stats.present} P, {stats.absent} F)
                        </span>
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Sin historial</span>
                      )}
                    </div>
                  </div>
                  {isAtRisk && (
                    <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-900/30 shrink-0 flex items-center gap-1">
                      <AlertTriangle size={10} className="animate-pulse" /> RIESGO
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {['present','absent','late','excused'].map((k) => (
                    <button key={k} onClick={(e) => { e.stopPropagation(); handleStatus(student.id, k as any); }} className={`py-5 rounded-2xl font-black text-lg transition-all ${s === k ? (k==='present'?'bg-emerald-500':k==='absent'?'bg-red-500':k==='late'?'bg-amber-500':'bg-indigo-500') + ' text-white scale-105 shadow-xl' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80'}`}>
                      {k === 'present' ? 'P' : k === 'absent' ? 'F' : k === 'late' ? 'R' : 'J'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
const App: React.FC = () => {
  const [data, setData] = useState<AppData>({ groups: [], version: 1, settings: {} });
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null); 
  const [isDark, setIsDark] = useState(false);

  const [groupDetailTab, setGroupDetailTab] = useState<'sessions' | 'students' | 'calendar' | 'stats' | 'evaluations' | 'closure'>('sessions');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [pendingGroups, setPendingGroups] = useState<Group[]>([]);
  const [selectionMap, setSelectionMap] = useState<Record<string, boolean>>({});
  const [customColor, setCustomColor] = useState('#4f46e5');

  const icsInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const viewRef = useRef(view);
  viewRef.current = view;
  const selectedGroupRef = useRef(selectedGroup);
  selectedGroupRef.current = selectedGroup;
  const backPressCountRef = useRef(0);

  // --- CONFIGURACIÓN DE ALERTAS PREDICTIVAS ---
  const [attendanceThreshold, setAttendanceThreshold] = useState(80); // Porcentaje de asistencia mínimo
  // (email modal state removed — comunicación real se hace desde quickStudentRisk)

  // --- NUEVOS ESTADOS DE ANÁLISIS PREDICTIVO CON IA ---
  const [predictiveCity, setPredictiveCity] = useState('Guadalajara');
  const [predictiveWeather, setPredictiveWeather] = useState('sunny');
  const [predictiveTraffic, setPredictiveTraffic] = useState('low');
  const [predictiveClassTime, setPredictiveClassTime] = useState('morning_early');
  const [predictiveResult, setPredictiveResult] = useState<{
    weatherImpact: string;
    trafficImpact: string;
    timeImpact: string;
    overallConclusion: string;
    studentNotices: {
      studentId: string;
      studentName: string;
      notice: string;
      urgency: 'high' | 'medium' | 'low';
    }[];
  } | null>(null);
  const [isPredictiveLoading, setIsPredictiveLoading] = useState(false);
  const [predictiveError, setPredictiveError] = useState<string | null>(null);
  const [studentFollowUpStates, setStudentFollowUpStates] = useState<Record<string, 'pending' | 'chatting' | 'resolved'>>({});

  // --- ESTADOS DE LA GRABADORA DE AUDIO ---
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState('Clases y Lecciones');
  const [selectedFormat, setSelectedFormat] = useState<'mp3' | 'wav' | 'webm'>('mp3');
  const [selectedQuality, setSelectedQuality] = useState<'64' | '128' | '256'>('128');
  const [selectedLimit, setSelectedLimit] = useState<number>(0); // 0 = sin límite
  const [selectedMode, setSelectedMode] = useState<'profesor' | 'alumno'>('profesor');
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  // --- ESTADOS DE RESPALDO EN GOOGLE DRIVE ---
  const [gdriveAccessToken, setGdriveAccessToken] = useState<string | null>(() => {
    const token = localStorage.getItem('gdrive_access_token');
    const expiry = localStorage.getItem('gdrive_token_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
      return token;
    }
    if (token) {
      localStorage.removeItem('gdrive_access_token');
      localStorage.removeItem('gdrive_token_expiry');
    }
    return null;
  });
  const [gdriveClientId, setGdriveClientId] = useState<string>(() => {
    const d = Storage.loadData();
    return d.settings.gdriveClientId || '';
  });
  const [gdriveAutoBackup, setGdriveAutoBackup] = useState<boolean>(() => {
    const d = Storage.loadData();
    return d.settings.gdriveAutoBackup !== undefined ? d.settings.gdriveAutoBackup : false;
  });
  const [gdriveLastBackup, setGdriveLastBackup] = useState<string | null>(() => {
    const d = Storage.loadData();
    return d.settings.gdriveLastBackup || null;
  });
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isRestoreLoading, setIsRestoreLoading] = useState(false);
  const [isGDriveSettingsOpen, setIsGDriveSettingsOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'backup' | 'notifications' | 'theme' | 'audio'>('backup');
  const [currentTheme, setCurrentTheme] = useState<AppTheme>('light');
  const [isRandomizerOpen, setIsRandomizerOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => AudioHaptics.getSoundEnabled());
  const [hapticsEnabled, setHapticsEnabled] = useState(() => AudioHaptics.getHapticsEnabled());
  const [audioSettings, setAudioSettings] = useState(() => AudioHaptics.getSettings());
  const [gdriveFileInfo, setGdriveFileInfo] = useState<{ id: string; name: string; modifiedTime?: string; size?: string } | null>(null);
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Lista de grabaciones
  const [recordingsList, setRecordingsList] = useState<Array<{
    id: string;
    name: string;
    folder: string;
    format: string;
    quality: string;
    duration: string; // MM:SS
    date: string;
    url: string;
    mode: 'profesor' | 'alumno';
  }>>(() => {
    try {
      const raw = localStorage.getItem('profasist_recordings');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      {
        id: 'rec-1',
        name: 'Clase Introducción a Bioquímica',
        folder: 'Clases y Lecciones',
        format: 'm4a',
        quality: '128 kbps',
        duration: '45:12',
        date: '2026-07-20',
        url: '#',
        mode: 'profesor'
      },
      {
        id: 'rec-2',
        name: 'Nota rápida: Tarea de la Sesión 3',
        folder: 'Notas Pedagógicas',
        format: 'm4a',
        quality: '256 kbps',
        duration: '01:45',
        date: '2026-07-22',
        url: '#',
        mode: 'profesor'
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('profasist_recordings', JSON.stringify(recordingsList));
    } catch (e) {}
  }, [recordingsList]);

  // --- SERVICIO DE NOTIFICACIONES LOCALES ---
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('local_notifications_enabled') === 'true';
  });

  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  useEffect(() => {
    NotificationServ.getStatus().then(status => {
      setNotificationPermission(status.granted ? 'granted' : 'default');
      if (status.granted && localNotificationsEnabled) {
        NotificationServ.scheduleGroupReminders(data.groups);
      }
    });
  }, [data.groups, localNotificationsEnabled]);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);
  const selectedLimitRef = useRef(selectedLimit);
  const selectedFolderRef = useRef(selectedFolder);
  const selectedFormatRef = useRef(selectedFormat);
  const selectedQualityRef = useRef(selectedQuality);
  const selectedModeRef = useRef(selectedMode);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    selectedLimitRef.current = selectedLimit;
  }, [selectedLimit]);

  useEffect(() => {
    selectedFolderRef.current = selectedFolder;
  }, [selectedFolder]);

  useEffect(() => {
    selectedFormatRef.current = selectedFormat;
  }, [selectedFormat]);

  useEffect(() => {
    selectedQualityRef.current = selectedQuality;
  }, [selectedQuality]);

  useEffect(() => {
    selectedModeRef.current = selectedMode;
  }, [selectedMode]);

  // --- NUEVO ESTADO PARA PLANIFICADOR DE CLASES IA ---
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [plannerContext, setPlannerContext] = useState('');
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);
  const [generatedSessions, setGeneratedSessions] = useState<{ sessionIndex: number; topic: string; description: string }[]>([]);

  // --- NUEVO ESTADO PARA ANÁLISIS DE RIESGO DE ALUMNOS CON IA ---
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [insightsResult, setInsightsResult] = useState<{
    generalSummary: string;
    attendanceTrends: string[];
    atRiskStudents: {
      studentId: string;
      studentName: string;
      percentage: number;
      riskLevel: string;
      reasoning: string;
      messageTemplate: string;
    }[];
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado temporal para un alumno específico con Alerta de Riesgo rápida
  const [quickStudentRisk, setQuickStudentRisk] = useState<{
    student: Student;
    percentage: number;
    stats: any;
    messageTemplate: string;
  } | null>(null);

  // --- NUEVO ESTADO PARA EXPORTAR EXCEL CON TÍTULO ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTitleInput, setExportTitleInput] = useState('');

  // --- LÓGICA DE NAVEGACIÓN SECUENCIAL ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        const { view: v, groupId, sessionId } = event.state;
        setView(v || ViewState.DASHBOARD);
        const currentData = Storage.loadData();
        const g = groupId ? currentData.groups.find(x => x.id === groupId) : null;
        setSelectedGroup(g || null);
        const s = (g && sessionId) ? g.sessions.find(x => x.id === sessionId) : null;
        setSelectedSession(s || null);
      } else {
        setView(ViewState.DASHBOARD);
        setSelectedGroup(null);
        setSelectedSession(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    if (!window.history.state) window.history.replaceState({ view: ViewState.DASHBOARD }, '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (newView: ViewState, group: Group | null = null, session: Session | null = null) => {
    setView(newView); setSelectedGroup(group); setSelectedSession(session);
    window.history.pushState({ view: newView, groupId: group?.id, sessionId: session?.id }, '');
  };

  const goBack = () => window.history.back();

  // --- BOTÓN ATRÁS DE ANDROID ---
  useEffect(() => {
    const handleBack = () => {
      // 1. Close active modals/drawers first if open
      if (isTimerOpen) {
        setIsTimerOpen(false);
        return;
      }
      if (isRandomizerOpen) {
        setIsRandomizerOpen(false);
        return;
      }
      if (isDeleteConfirmOpen) {
        setIsDeleteConfirmOpen(false);
        return;
      }
      if (isGroupModalOpen) {
        setIsGroupModalOpen(false);
        return;
      }
      if (isStudentModalOpen) {
        setIsStudentModalOpen(false);
        return;
      }
      if (isImportModalOpen) {
        setIsImportModalOpen(false);
        return;
      }
      if (isExportModalOpen) {
        setIsExportModalOpen(false);
        return;
      }
      if (isRecorderOpen) {
        setIsRecorderOpen(false);
        return;
      }
      if (isGDriveSettingsOpen) {
        setIsGDriveSettingsOpen(false);
        return;
      }
      if (quickStudentRisk) {
        setQuickStudentRisk(null);
        return;
      }

      // 2. Otherwise navigate view state
      const currentView = view;
      if (currentView === ViewState.DASHBOARD) {
        if (backPressCountRef.current === 0) {
          backPressCountRef.current = 1;
          setNotification('Presiona atrás de nuevo para salir');
          setTimeout(() => { backPressCountRef.current = 0; }, 3000);
        } else {
          if (window.Android && window.Android.exitApp) {
            window.Android.exitApp();
          } else {
            window.close();
          }
        }
      } else {
        window.history.back();
      }
    };
    document.addEventListener('backbutton', handleBack);
    return () => document.removeEventListener('backbutton', handleBack);
  }, [
    view, 
    isTimerOpen,
    isRandomizerOpen,
    isDeleteConfirmOpen, 
    isGroupModalOpen, 
    isStudentModalOpen, 
    isImportModalOpen, 
    isExportModalOpen, 
    isRecorderOpen, 
    isGDriveSettingsOpen, 
    quickStudentRisk
  ]);

  // --- MANEJADORES DE NOTIFICACIONES PUSH & LOCALES PERSISTENTES ---
  const registerAndSubscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Web Push is not supported in this browser.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // 1. Get the VAPID Public Key from our server
      const keyResponse = await fetch('/api/notifications/vapid-public-key');
      if (!keyResponse.ok) {
        throw new Error('No se pudo obtener la clave pública VAPID del servidor.');
      }
      const { publicKey } = await keyResponse.json();

      // 2. Convert base64 URL VAPID key to UInt8Array
      const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
      const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      // 3. Subscribe the user via PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      });

      // 4. Send subscription to our backend
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });

      console.log('User subscribed to push notifications successfully!');
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe user to push notifications:', error);
    }
  };

  const syncSchedulesWithServer = async (groupsList: Group[]) => {
    try {
      const timezoneOffset = new Date().getTimezoneOffset();
      const schedules = groupsList
        .filter(g => !g.archived && g.scheduleSummary)
        .map(g => ({
          id: g.id,
          name: g.name,
          scheduleSummary: g.scheduleSummary
        }));

      await fetch('/api/notifications/sync-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezoneOffset, schedules })
      });
      console.log('Schedules successfully synchronized with backend for closed-app reminders!');
    } catch (error) {
      console.error('Failed to sync schedules with backend:', error);
    }
  };

  const handleRequestNotificationPermission = async () => {
    setNotification('Solicitando permiso de notificaciones...');
    const granted = await NotificationServ.requestPermissions();
    if (granted) {
      setNotificationPermission('granted');
      setLocalNotificationsEnabled(true);
      localStorage.setItem('local_notifications_enabled', 'true');
      await NotificationServ.scheduleGroupReminders(data.groups);
      setNotification('¡Notificaciones nativas activadas correctamente! 🔔');
    } else {
      setNotificationPermission('denied');
      setNotification('Permiso denegado. Actívalo en los ajustes de tu sistema/navegador.');
    }
  };

  const handleToggleLocalNotifications = async () => {
    const newVal = !localNotificationsEnabled;
    setLocalNotificationsEnabled(newVal);
    localStorage.setItem('local_notifications_enabled', String(newVal));

    if (newVal) {
      await NotificationServ.scheduleGroupReminders(data.groups);
      setNotification('Recordatorios de clases activados.');
    } else {
      await NotificationServ.cancelAll();
      setNotification('Recordatorios de clases desactivados.');
    }
  };

  const handleSendTestNotification = async () => {
    setNotification('Enviando alerta de prueba a tu dispositivo...');
    const success = await NotificationServ.sendTestNotification();
    if (success) {
      setNotification('¡Alerta de prueba enviada con éxito! 🔔');
    } else {
      setNotification('No se pudo enviar la alerta. Verifica los permisos.');
    }
  };

  // Escuchar mensajes del Service Worker al hacer clic en notificaciones push
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_GROUP') {
        const group = data.groups.find(g => g.id === event.data.groupId);
        if (group) {
          navigateTo(ViewState.GROUP_DETAIL, group);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [data.groups]);

  // Sincronizar automáticamente los horarios con el servidor cuando cambien
  useEffect(() => {
    if (localNotificationsEnabled && notificationPermission === 'granted' && data.groups.length > 0) {
      syncSchedulesWithServer(data.groups);
    }
  }, [localNotificationsEnabled, notificationPermission, data.groups]);

  // Efecto para monitorear el tiempo y alertar al inicio de las clases
  useEffect(() => {
    if (!localNotificationsEnabled || notificationPermission !== 'granted') return;

    const checkSchedules = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const dayIndex = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      const daysMap: Record<number, string[]> = {
        0: ['dom', 'sun', 'domingo'],
        1: ['lun', 'mon', 'lunes'],
        2: ['mar', 'tue', 'martes'],
        3: ['mie', 'wed', 'miércoles', 'miercoles'],
        4: ['jue', 'thu', 'jueves'],
        5: ['vie', 'fri', 'viernes'],
        6: ['sab', 'sat', 'sábado', 'sabado']
      };

      const currentDayNames = daysMap[dayIndex] || [];

      data.groups.forEach(group => {
        if (group.archived || !group.scheduleSummary) return;

        const summary = group.scheduleSummary.toLowerCase();
        // Verificar si es el día correcto
        const matchesDay = currentDayNames.some(dayName => summary.includes(dayName));
        if (!matchesDay) return;

        // Buscar patrón de hora, ej: 10:00 o 14:15 o 09:30
        const timeRegex = /(\d{1,2}):(\d{2})/;
        const match = summary.match(timeRegex);
        if (!match) return;

        const targetHour = parseInt(match[1], 10);
        const targetMin = parseInt(match[2], 10);

        // Si coincide la hora exacta
        if (currentHour === targetHour && currentMin === targetMin) {
          const todayStr = now.toISOString().split('T')[0];
          const notifyKey = `${group.id}-${todayStr}-${targetHour}-${targetMin}`;

          if (!notifiedKeysRef.current.has(notifyKey)) {
            notifiedKeysRef.current.add(notifyKey);

            try {
              const notificationObj = new Notification(`ProfAsist: Pase de Lista`, {
                body: `Es hora de pasar asistencia en la clase: ${group.name} (${group.scheduleSummary}).`,
                requireInteraction: true,
                tag: group.id
              });

              notificationObj.onclick = () => {
                window.focus();
                navigateTo(ViewState.GROUP_DETAIL, group);
              };
            } catch (err) {
              console.error('Error al instanciar notificación:', err);
            }
          }
        }
      });
    };

    // Ejecutar inmediatamente y programar intervalo cada 30 segundos
    checkSchedules();
    const interval = setInterval(checkSchedules, 30000);

    return () => clearInterval(interval);
  }, [localNotificationsEnabled, notificationPermission, data.groups]);

  useEffect(() => {
    const d = Storage.loadData(); setData(d);
    
    // Check if opened from a notification targeting a group
    const urlParams = new URLSearchParams(window.location.search);
    const targetGroupId = urlParams.get('groupId');
    if (targetGroupId) {
      const foundGroup = d.groups.find(g => g.id === targetGroupId);
      if (foundGroup) {
        setView(ViewState.GROUP_DETAIL);
        setSelectedGroup(foundGroup);
      }
    }

    const handleTheme = (e: boolean | MediaQueryListEvent) => {
      const isD = (typeof e === 'boolean' ? e : e.matches);
      const currentData = Storage.loadData();
      const savedTheme = currentData.settings.theme as AppTheme | undefined;
      const themeToApply: AppTheme = savedTheme || (currentData.settings.darkMode ? 'dark' : isD ? 'dark' : 'light');
      applyTheme(themeToApply);
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    handleTheme(mq.matches); mq.addEventListener('change', handleTheme);
    return () => mq.removeEventListener('change', handleTheme);
  }, []);

  const applyTheme = (themeName: AppTheme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-solarized-dark', 'theme-solarized-light', 'theme-emerald', 'theme-nord');
    
    if (themeName === 'dark') {
      root.classList.add('dark');
    } else if (themeName === 'solarized-dark') {
      root.classList.add('dark', 'theme-solarized-dark');
    } else if (themeName === 'solarized-light') {
      root.classList.add('theme-solarized-light');
    } else if (themeName === 'emerald') {
      root.classList.add('dark', 'theme-emerald');
    } else if (themeName === 'nord') {
      root.classList.add('dark', 'theme-nord');
    }
    
    setCurrentTheme(themeName);
    const isDarkTheme = themeName !== 'light' && themeName !== 'solarized-light';
    setIsDark(isDarkTheme);
    Storage.updateSettings({ theme: themeName, darkMode: isDarkTheme });
  };

  const toggleTheme = () => {
    const themes: AppTheme[] = ['light', 'dark', 'solarized-dark', 'solarized-light', 'emerald', 'nord'];
    const currentIdx = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIdx + 1) % themes.length];
    applyTheme(nextTheme);
  };

  // Direct OAuth inside Android WebView is intentionally disabled. Backups use
  // the native Android share/file picker instead. Remove stale credentials so
  // older installations cannot perform unexpected background network calls.
  useEffect(() => {
    localStorage.removeItem('gdrive_access_token');
    localStorage.removeItem('gdrive_token_expiry');
    setGdriveAccessToken(null);
    setGdriveAutoBackup(false);
    Storage.updateSettings({ gdriveAutoBackup: false });
  }, []);

  const triggerBackgroundAutoBackup = async (token: string, fileInfo: any) => {
    try {
      let fileId = fileInfo?.id || null;
      if (!fileId) {
        const file = await GDriveService.searchBackupFile(token);
        if (file) fileId = file.id;
      }
      
      const backupData = Storage.createBackupPayload();
      const result = await GDriveService.uploadBackup(token, backupData, fileId);
      
      setGdriveLastBackup(result.modifiedTime);
      Storage.updateSettings({ gdriveLastBackup: result.modifiedTime });
      setGdriveFileInfo({
        id: result.fileId,
        name: 'profasist_backup.json',
        modifiedTime: result.modifiedTime
      });
      console.log('Copia de seguridad automática en Google Drive completada.');
    } catch (err) {
      console.error('La copia de seguridad automática en Google Drive falló:', err);
    }
  };

  const refresh = () => {
    const d = Storage.loadData(); setData(d);
    if (selectedGroup) setSelectedGroup(d.groups.find(g => g.id === selectedGroup.id) || null);
  };

  const handleGDriveBackup = async (showNotification = true) => {
    if (!gdriveAccessToken) {
      setNotification('Primero debes conectar tu cuenta de Google Drive.');
      return;
    }
    
    setIsBackupLoading(true);
    try {
      let fileId = gdriveFileInfo?.id || null;
      if (!fileId) {
        const file = await GDriveService.searchBackupFile(gdriveAccessToken);
        if (file) fileId = file.id;
      }
      
      const backupData = Storage.createBackupPayload();
      const result = await GDriveService.uploadBackup(gdriveAccessToken, backupData, fileId);
      
      setGdriveLastBackup(result.modifiedTime);
      Storage.updateSettings({ gdriveLastBackup: result.modifiedTime });
      setGdriveFileInfo({
        id: result.fileId,
        name: 'profasist_backup.json',
        modifiedTime: result.modifiedTime
      });

      if (showNotification) {
        setNotification('¡Copia de seguridad guardada en Google Drive!');
      }
    } catch (error: any) {
      console.error('Error al realizar copia en Google Drive:', error);
      if (error.message === 'UNAUTHORIZED') {
        setGdriveAccessToken(null);
        localStorage.removeItem('gdrive_access_token');
        localStorage.removeItem('gdrive_token_expiry');
        setNotification('Tu sesión de Google Drive ha expirado. Vuelve a conectarte.');
      } else if (showNotification) {
        setNotification('Ocurrió un error al guardar la copia en Google Drive.');
      }
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleGDriveRestore = async (mode: 'overwrite' | 'merge') => {
    if (!gdriveAccessToken) {
      setNotification('Primero debes conectar tu cuenta de Google Drive.');
      return;
    }
    
    const message = mode === 'overwrite' 
      ? '¿Estás seguro de que deseas sobrescribir? Se eliminarán todos tus datos locales actuales y se reemplazarán con la copia de la nube. Esta acción es irreversible.'
      : '¿Deseas realizar una fusión inteligente? Se mantendrán tus clases locales actuales y solo se agregarán o actualizarán las clases de la nube que no existan o estén incompletas localmente.';

    const confirmRestore = window.confirm(message);
    if (!confirmRestore) return;

    setIsRestoreLoading(true);
    try {
      let fileId = gdriveFileInfo?.id || null;
      if (!fileId) {
        const file = await GDriveService.searchBackupFile(gdriveAccessToken);
        if (file) fileId = file.id;
      }

      if (!fileId) {
        setNotification('No se encontró ninguna copia de seguridad en Google Drive.');
        setIsRestoreLoading(false);
        return;
      }
      
      const backupData = await GDriveService.downloadBackup(gdriveAccessToken, fileId);
      
      let restoreResult;
      if (mode === 'overwrite') {
        restoreResult = Storage.restoreFromBackup(JSON.stringify(backupData));
      } else {
        restoreResult = Storage.mergeFromBackup(JSON.stringify(backupData));
      }
      
      if (restoreResult.success) {
        // Force refresh state completely
        const d = Storage.loadData();
        setData(d);
        setSelectedGroup(null);
        setSelectedSession(null);
        setView(ViewState.DASHBOARD);
        setNotification(restoreResult.message || '¡Datos restaurados desde Google Drive exitosamente!');
      } else {
        setNotification(`Error de restauración: ${restoreResult.message}`);
      }
    } catch (error: any) {
      console.error('Error al restaurar desde Google Drive:', error);
      if (error.message === 'UNAUTHORIZED') {
        setGdriveAccessToken(null);
        localStorage.removeItem('gdrive_access_token');
        localStorage.removeItem('gdrive_token_expiry');
        setNotification('Tu sesión de Google Drive ha expirado. Vuelve a conectarte.');
      } else {
        setNotification('No se pudo descargar o aplicar la copia de seguridad.');
      }
    } finally {
      setIsRestoreLoading(false);
    }
  };

  const handleShareBackup = async () => {
    try {
      const backupData = Storage.createBackupPayload();
      const fileName = `profasist_respaldo_${new Date().toISOString().slice(0, 10)}.json`;
      const jsonText = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonText], { type: 'application/json' });

      if (navigator.share) {
        const file = new File([blob], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Respaldo de ProfAsist v2',
            text: 'Copia de seguridad completa de clases, alumnos, asistencias y notas de ProfAsist.'
          });
          setNotification('¡Respaldo enviado o guardado en la Nube con éxito!');
          return;
        }
      }
      Utils.triggerDownload(fileName, blob);
      setNotification('Copia de seguridad descargada en el almacenamiento del dispositivo.');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error al compartir respaldo:', err);
        handleLocalExport();
      }
    }
  };

  const handleOpenWhatsApp = (phone?: string, textMessage?: string) => {
    const rawNumber = (phone || '').replace(/\D/g, '');
    const cleanPhone = rawNumber.length === 10 ? `52${rawNumber}` : rawNumber;
    const defaultMsg = textMessage || 'Hola, me comunico desde la materia en ProfAsist.';
    if (!cleanPhone) {
      setNotification('Registra un número de WhatsApp para este alumno o tutor.');
      return;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`;
    window.open(url, '_blank');
  };

  const handleOpenEmail = (email?: string, subject?: string, textMessage?: string) => {
    if (!email || !email.trim()) {
      setNotification('No se ha registrado un correo institucional para este alumno.');
      return;
    }
    const cleanEmail = email.trim();
    const mailSubject = encodeURIComponent(subject || `ProfAsist: Seguimiento de ${selectedGroup?.name || 'Materia'}`);
    const mailBody = encodeURIComponent(textMessage || `Estimado(a) alumno(a),\n\nTe escribo desde la materia ${selectedGroup?.name || ''} para dar seguimiento a tu desempeño académico y asistencias.\n\nQuedo atento a tus comentarios.\nSaludos cordiales.`);
    window.location.href = `mailto:${cleanEmail}?subject=${mailSubject}&body=${mailBody}`;
  };

  const handleLocalExport = () => {
    try {
      const backupData = Storage.createBackupPayload();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      Utils.triggerDownload(`profasist_respaldo_${new Date().toISOString().slice(0, 10)}.json`, blob);
      setNotification('Copia de seguridad local descargada correctamente.');
    } catch (err) {
      console.error(err);
      setNotification('Error al exportar la copia de seguridad local.');
    }
  };

  const handleLocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const choice = window.confirm(
        '¿Deseas realizar una fusión inteligente con el archivo de respaldo seleccionado?\n\n' +
        'Aceptar -> Fusión inteligente (Conserva tus clases locales actuales y añade las del archivo).\n' +
        'Cancelar -> Reemplazar todo (Sobrescribirá todo tu estado local de forma destructiva).'
      );

      let restoreResult;
      if (choice) {
        restoreResult = Storage.mergeFromBackup(content);
      } else {
        const confirmOverwrite = window.confirm('¡ATENCIÓN! Reemplazar todo eliminará irreversiblemente tus datos locales actuales. ¿Proceder?');
        if (!confirmOverwrite) {
          e.target.value = '';
          return;
        }
        restoreResult = Storage.restoreFromBackup(content);
      }

      if (restoreResult.success) {
        const d = Storage.loadData();
        setData(d);
        setSelectedGroup(null);
        setSelectedSession(null);
        setView(ViewState.DASHBOARD);
        setNotification(restoreResult.message || '¡Datos restaurados con éxito!');
      } else {
        setNotification(`Error: ${restoreResult.message}`);
      }
      e.target.value = '';
    };

    reader.onerror = () => {
      setNotification('No se pudo leer el archivo seleccionado.');
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  const handleDisconnectGDrive = () => {
    setGdriveAccessToken(null);
    localStorage.removeItem('gdrive_access_token');
    localStorage.removeItem('gdrive_token_expiry');
    setGdriveFileInfo(null);
    setNotification('Desconectado de Google Drive correctamente.');
  };

  const handleStartTodaySession = () => {
    if (!selectedGroup) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sess = selectedGroup.sessions.find(s => s.date === today);
    if (sess) navigateTo(ViewState.SESSION_ATTENDANCE, selectedGroup, sess);
    else setNotification("No hay sesiones programadas para hoy.");
  };

  // --- LÓGICA DE GRABADORA DE AUDIO ---
  const recordingDurationRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const perm = await VoiceRecorder.requestAudioRecordingPermission();
      if (!perm.value) {
        setNotification('Permiso de microfono denegado. Ve a Ajustes y activalo.');
        return;
      }
      await VoiceRecorder.startRecording();
      recordingDurationRef.current = 0;
      setRecordingDuration(0);
      setIsRecording(true);
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        if (isPausedRef.current) return;
        recordingDurationRef.current += 1;
        const next = recordingDurationRef.current;
        setRecordingDuration(next);
        if (selectedLimitRef.current > 0 && next >= Math.round(selectedLimitRef.current * 60)) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      console.error('VoiceRecorder error:', err);
      setNotification('Error al iniciar grabacion: ' + err);
    }
  };

  const pauseRecording = async () => {
    try {
      await VoiceRecorder.pauseRecording();
      setIsPaused(true);
      AudioHaptics.playPop();
    } catch (err) {
      console.error('Error al pausar grabacion:', err);
      setIsPaused(true);
    }
  };

  const resumeRecording = async () => {
    try {
      await VoiceRecorder.resumeRecording();
      setIsPaused(false);
      AudioHaptics.playPop();
    } catch (err) {
      console.error('Error al reanudar grabacion:', err);
      setIsPaused(false);
    }
  };

  const stopRecording = (cancelled = false) => {
    VoiceRecorder.stopRecording().then(result => {
      if (cancelled) {
        setIsRecording(false);
        setIsPaused(false);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        return;
      }
      if (result && result.value && result.value.recordDataBase64 && result.value.recordDataBase64.length > 0) {
        const byteString = atob(result.value.recordDataBase64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        
        const mime = result.value.mimeType || 'audio/mp4';
        const blob = new Blob([ab], { type: mime });
        
        // Determine correct file extension from mimeType
        let extension = 'm4a';
        if (mime.includes('webm')) extension = 'webm';
        else if (mime.includes('mp3')) extension = 'mp3';
        else if (mime.includes('wav')) extension = 'wav';
        else if (mime.includes('ogg')) extension = 'ogg';
        else if (mime.includes('aac')) extension = 'aac';
        
        const recordName = "Grabacion_" + (selectedFolderRef.current || 'Audio').replace(/\s+/g, '_') + "_" + Date.now().toString().slice(-4);
        const fileNameWithExt = recordName + "." + extension;
        
        Utils.triggerDownload(fileNameWithExt, blob);
        
        // Create recording object with permanent base64 dataUrl and add to library
        const dataUrl = `data:${mime};base64,${result.value.recordDataBase64}`;
        const newRecording = {
          id: `rec-${Date.now()}`,
          name: recordName,
          folder: selectedFolderRef.current,
          format: extension,
          quality: selectedQualityRef.current + ' kbps',
          duration: formatDuration(recordingDurationRef.current),
          date: new Date().toISOString().split('T')[0],
          url: dataUrl,
          mode: selectedModeRef.current
        };
        
        setRecordingsList(prev => [newRecording, ...prev]);
        setNotification('Grabación guardada correctamente.');
      }
    }).catch(err => {
      console.error('stop error:', err);
      setNotification('Error al detener grabación: ' + err);
    });
    setIsRecording(false);
    setIsPaused(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const deleteRecording = (id: string) => {
    setRecordingsList(prev => prev.filter(r => r.id !== id));
    setNotification('Grabación eliminada de la biblioteca local.');
  };

  // --- GENERAR PLANIFICADOR DE CLASES CON IA ---
  const handleGeneratePlanner = async () => {
    if (!selectedGroup) return;
    setIsPlannerLoading(true);
    setGeneratedSessions([]);

    try {
      const res = await fetch('/api/ai/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: selectedGroup.name,
          scheduleSummary: selectedGroup.scheduleSummary,
          sessionCount: selectedGroup.sessions.length,
          semester: selectedGroup.semester,
          additionalContext: plannerContext
        })
      });

      if (!res.ok) throw new Error('Error al generar la planeación');
      const result = await res.json();

      if (result.sessions && Array.isArray(result.sessions)) {
        setGeneratedSessions(result.sessions);
      } else {
        setNotification('La IA no devolvió un formato de temario adecuado.');
      }
    } catch (error: any) {
      setNotification('Error al contactar con la IA para la planificación.');
    } finally {
      setIsPlannerLoading(false);
    }
  };

  // --- APLICAR TEMARIO EN LAS SESIONES REALES ---
  const handleApplyPlanner = () => {
    if (!selectedGroup || generatedSessions.length === 0) return;

    // Crear copia de las sesiones con los temas aplicados por índice
    const updatedSessions = selectedGroup.sessions.map((sess, idx) => {
      const match = generatedSessions.find(gs => gs.sessionIndex === idx);
      if (match) {
        return {
          ...sess,
          topic: `${match.topic}: ${match.description}`
        };
      }
      return sess;
    });

    const updatedGroup = {
      ...selectedGroup,
      sessions: updatedSessions
    };

    Storage.saveGroup(updatedGroup);
    refresh();
    setIsPlannerOpen(false);
    setNotification(`¡Se han aplicado con éxito los temas para las ${generatedSessions.length} sesiones de ${selectedGroup.name}!`);
  };

  // --- GENERAR ANÁLISIS DE RIESGO DE ALUMNOS CON IA ---
  const handleRunAIInsights = async () => {
    if (!selectedGroup) return;
    setIsInsightsOpen(true);
    setIsInsightsLoading(true);
    setInsightsResult(null);

    try {
      const studentsData = selectedGroup.students.map(s => {
        const stats = Utils.calculateStudentStats(selectedGroup, s.id);
        return {
          id: s.id,
          nombre: s.name,
          matricula: s.rollNumber || 'S/M',
          porcentajeAsistencia: stats.percentage,
          totalClases: stats.totalSessions,
          asistencias: stats.present,
          faltas: stats.absent,
          retardos: stats.late,
          justificados: stats.excused
        };
      });

      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: selectedGroup.name,
          studentsData
        })
      });

      if (!res.ok) throw new Error('Error en análisis de la IA');
      const result = await res.json();
      setInsightsResult(result);
    } catch (error) {
      setNotification('No se pudo generar el análisis de riesgo en este momento.');
      setIsInsightsOpen(false);
    } finally {
      setIsInsightsLoading(false);
    }
  };

  // --- EJECUTAR ANÁLISIS PREDICTIVO DE ASISTENCIA CON IA ---
  const handleRunPredictiveAI = async () => {
    if (!selectedGroup) return;
    setIsPredictiveLoading(true);
    setPredictiveResult(null);
    setPredictiveError(null);

    const studentsData = selectedGroup.students.map(s => {
      const stats = Utils.calculateStudentStats(selectedGroup, s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        percentage: stats.percentage,
        totalSessions: stats.totalSessions,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        excused: stats.excused
      };
    });

    try {
      const res = await fetch('/api/ai/predictive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: predictiveCity,
          weather: predictiveWeather === 'sunny' ? 'Despejado / Templado' :
                   predictiveWeather === 'raining' ? '🌧️ Lluvia / Tormenta' :
                   predictiveWeather === 'cold' ? '❄️ Frío Extremo' :
                   predictiveWeather === 'hot' ? '☀️ Calor Intenso' :
                   predictiveWeather === 'foggy' ? '🌫️ Niebla / Bruma' : 'Templado',
          traffic: predictiveTraffic === 'low' ? '🚲 Tráfico Fluido' :
                   predictiveTraffic === 'medium' ? '🚙 Tráfico Moderado' : '🚗 Tráfico Pesado / Caos Vial',
          classTime: predictiveClassTime === 'morning_early' ? '🌅 Temprano (7:00 AM - 9:00 AM)' :
                     predictiveClassTime === 'morning_mid' ? '☀️ Media Mañana (9:00 AM - 1:00 PM)' :
                     predictiveClassTime === 'afternoon' ? '🌇 Tarde (1:00 PM - 6:00 PM)' : '🌙 Noche (6:00 PM - 10:00 PM)',
          subjectName: selectedGroup.name,
          studentsData
        })
      });

      if (res.ok) {
        const result = await res.json();
        setPredictiveResult(result);
        setPredictiveError(null);
        setNotification('¡Análisis predictivo de asistencia generado con éxito!');
      } else {
        const err = await res.json();
        const errMsg = err.error || 'No se pudo generar el análisis predictivo.';
        setPredictiveError(errMsg);
        setNotification(`Error: ${errMsg}`);
      }
    } catch (error) {
      console.error('Error running predictive AI:', error);
      setPredictiveError('Error de conexión con el servidor de IA. Asegúrate de que tengas una clave API configurada y conexión a internet.');
      setNotification('Error de conexión con el servidor de IA.');
    } finally {
      setIsPredictiveLoading(false);
    }
  };

  // --- COPIAR MENSAJE AL PORTAPAPELES ---
  const handleCopyToClipboard = (text: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  // --- ALERTA RÁPIDA DE UN ALUMNO EN PARTICULAR ---
  const handleOpenQuickRisk = async (student: Student) => {
    if (!selectedGroup) return;
    const stats = Utils.calculateStudentStats(selectedGroup, student.id);
    
    setQuickStudentRisk({
      student,
      percentage: stats.percentage,
      stats,
      messageTemplate: 'Generando mensaje empático...'
    });

    try {
      // Generar plantilla de reenganche inmediata para el alumno
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Escribe únicamente un mensaje empático, asertivo y directo en español para enviarle por WhatsApp a mi alumno "${student.name}" de la materia "${selectedGroup.name}". Él tiene actualmente un ${stats.percentage}% de asistencia con un total de ${stats.absent} inasistencias en lo que va del periodo escolar. Pregúntale con amabilidad si todo está bien y cómo puedo apoyarlo para que recupere el ritmo de la materia. No uses más texto explicativo, entrega directamente el mensaje listo para copiar.`
            }
          ]
        })
      });

      if (res.ok) {
        const result = await res.json();
        setQuickStudentRisk(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messageTemplate: result.text
          };
        });
      }
    } catch (err) {
      setQuickStudentRisk(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messageTemplate: `¡Hola ${student.name}! Espero que te encuentres muy bien. Te escribo de la materia ${selectedGroup.name} porque he notado tu ausencia en las últimas clases (tienes un ${stats.percentage}% de asistencia). Me interesa mucho que no te quedes atrás y saber si todo está bien o si hay algo en lo que te pueda apoyar para que te pongas al día. ¡Quedo atento!`
        };
      });
    }
  };

  const getAbsenceStatsByDay = (group: Group) => {
    const daysMap: Record<number, { count: number; total: number; label: string }> = {
      1: { count: 0, total: 0, label: 'Lunes' },
      2: { count: 0, total: 0, label: 'Martes' },
      3: { count: 0, total: 0, label: 'Miércoles' },
      4: { count: 0, total: 0, label: 'Jueves' },
      5: { count: 0, total: 0, label: 'Viernes' },
      6: { count: 0, total: 0, label: 'Sábado' },
    };

    group.sessions.forEach(session => {
      const dateParts = session.date.split('-');
      if (dateParts.length === 3) {
        const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const dayOfWeek = dateObj.getDay(); 
        if (daysMap[dayOfWeek]) {
          const absentCount = session.totalStudents - session.totalPresent;
          daysMap[dayOfWeek].count += absentCount;
          daysMap[dayOfWeek].total += session.totalStudents;
        }
      }
    });

    return Object.values(daysMap).map(d => {
      const rate = d.total > 0 ? Math.round((d.count / d.total) * 100) : 0;
      return {
        label: d.label,
        absentRate: rate,
        absentCount: d.count,
        totalCount: d.total
      };
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden font-sans">
      <input type="file" accept=".ics" className="hidden" ref={icsInputRef} onChange={async e => {
        const f = e.target.files?.[0];
        if(f) {
          const groups = Utils.parseICSContent(await f.text());
          if(groups.length > 0) { 
            setPendingGroups(groups);
            const initialMap: Record<string, boolean> = {};
            groups.forEach(g => initialMap[g.id] = true);
            setSelectionMap(initialMap);
            navigateTo(ViewState.IMPORT_ICS);
          } else setNotification("No se encontraron clases válidas.");
        }
        e.target.value = "";
      }} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {view === ViewState.DASHBOARD && <Dashboard data={data} 
          onGroupSelect={g => navigateTo(ViewState.GROUP_DETAIL, g)}
          onImportClick={() => icsInputRef.current?.click()}
          onCreateClick={() => { setEditingGroup(null); setCustomColor('#4f46e5'); setIsGroupModalOpen(true); }}
          onGroupSettings={g => { setEditingGroup(g); setCustomColor(g.color); setIsGroupModalOpen(true); }}
          onToggleTheme={() => { setSettingsActiveTab('theme'); setIsGDriveSettingsOpen(true); }} isDark={isDark}
          onOpenRecorder={() => setIsRecorderOpen(true)}
          onSettingsClick={() => { setSettingsActiveTab('backup'); setIsGDriveSettingsOpen(true); }}
        />}
        
        {view === ViewState.GROUP_DETAIL && selectedGroup && <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors">
          <header className="px-4 pt-12 pb-4 portrait:pt-10 portrait:pb-3 landscape:pt-3 landscape:pb-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3 mb-8 portrait:mb-6 landscape:mb-3">
              <button onClick={goBack} className="p-2 -ml-2 text-slate-500"><ChevronLeft size={32} className="landscape:w-6 landscape:h-6" /></button>
              <div className="flex-1 min-w-0"><h1 className="text-xl font-black text-slate-900 dark:text-white truncate pr-4 landscape:text-lg">{selectedGroup.name}</h1></div>
              <button 
                onClick={() => { AudioHaptics.playPop(); setIsRandomizerOpen(true); }}
                className="p-3 landscape:p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl active:scale-95 transition flex items-center gap-1 text-xs font-black"
                title="Elegir Alumno al Azar (Ruleta)"
              >
                <Dices size={20} className="landscape:w-5 landscape:h-5" />
                <span className="hidden sm:inline">Ruleta</span>
              </button>
              <button 
                onClick={() => { AudioHaptics.playPop(); setIsTimerOpen(true); }}
                className="p-3 landscape:p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl active:scale-95 transition flex items-center gap-1 text-xs font-black"
                title="Temporizador de Clase"
              >
                <Clock size={20} className="landscape:w-5 landscape:h-5" />
                <span className="hidden sm:inline">Tiempo</span>
              </button>
              <button onClick={() => { setExportTitleInput(`REPORTE DE ASISTENCIA - ${selectedGroup.name}`); setIsExportModalOpen(true); }} className="p-3 landscape:p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl active:scale-95 transition" title="Exportar Reporte Excel"><FileSpreadsheet size={24} className="landscape:w-5 landscape:h-5" /></button>
            </div>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-3xl gap-0.5 overflow-x-auto no-scrollbar">
              <button onClick={() => setGroupDetailTab('sessions')} className={`flex-grow px-2 py-3 landscape:py-2 text-[10px] font-black rounded-[1.25rem] transition-all duration-200 shrink-0 ${groupDetailTab === 'sessions' ? 'shadow bg-white dark:bg-slate-700 text-indigo-600 dark:text-white' : 'text-slate-500'}`}>SESIONES</button>
              <button onClick={() => setGroupDetailTab('students')} className={`flex-grow px-2 py-3 landscape:py-2 text-[10px] font-black rounded-[1.25rem] transition-all duration-200 shrink-0 ${groupDetailTab === 'students' ? 'shadow bg-white dark:bg-slate-700 text-indigo-600 dark:text-white' : 'text-slate-500'}`}>ALUMNOS ({selectedGroup.students.length})</button>
              <button onClick={() => setGroupDetailTab('evaluations')} className={`flex-grow px-2 py-3 landscape:py-2 text-[10px] font-black rounded-[1.25rem] transition-all duration-200 shrink-0 ${groupDetailTab === 'evaluations' ? 'shadow bg-white dark:bg-slate-700 text-indigo-600 dark:text-white' : 'text-slate-500'}`}>EVALUACIÓN</button>
              <button onClick={() => setGroupDetailTab('calendar')} className={`flex-grow px-2 py-3 landscape:py-2 text-[10px] font-black rounded-[1.25rem] transition-all duration-200 shrink-0 ${groupDetailTab === 'calendar' ? 'shadow bg-white dark:bg-slate-700 text-indigo-600 dark:text-white' : 'text-slate-500'}`}>CALENDARIO</button>
              <button onClick={() => setGroupDetailTab('stats')} className={`flex-grow px-2 py-3 landscape:py-2 text-[10px] font-black rounded-[1.25rem] transition-all duration-200 shrink-0 ${groupDetailTab === 'stats' ? 'shadow bg-white dark:bg-slate-700 text-indigo-600 dark:text-white' : 'text-slate-500'} flex items-center justify-center gap-1`}>
                ANÁLISIS
                {selectedGroup.students.some(st => Utils.calculateStudentStats(selectedGroup, st.id).percentage < attendanceThreshold) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse inline-block shrink-0"></span>
                )}
              </button>
              <button onClick={() => setGroupDetailTab('closure')} className={`flex-grow px-2 py-3 landscape:py-2 text-[10px] font-black rounded-[1.25rem] transition-all duration-200 shrink-0 ${groupDetailTab === 'closure' ? 'shadow bg-white dark:bg-slate-700 text-indigo-600 dark:text-white' : 'text-slate-500'}`}>CIERRE</button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
            {groupDetailTab === 'sessions' ? (
              <>
                <button onClick={handleStartTodaySession} className="w-full py-5 bg-indigo-600 text-white rounded-[2.5rem] font-black shadow-xl flex items-center justify-center gap-3 mb-4 active:scale-95 transition"><Calendar size={22} /> INICIAR PASE DE HOY</button>
                
                {selectedGroup.sessions.map(session => {
                   const pct = selectedGroup.students.length > 0 ? Math.round((session.totalPresent / selectedGroup.students.length) * 100) : 0;
                   return (
                    <div key={session.id} onClick={() => navigateTo(ViewState.SESSION_ATTENDANCE, selectedGroup, session)} className="flex flex-col p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 transition cursor-pointer shadow-sm">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 mr-5 font-black shrink-0">
                          <span className="text-[11px] uppercase mb-1">{session.date.split('-')[1]}</span>
                          <span className="text-xl">{session.date.split('-')[2]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">{Utils.formatDateFriendly(session.date)}</h4>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-black uppercase mt-1">{pct}% Asistencia ({session.totalPresent}/{selectedGroup!.students.length})</p>
                        </div>
                        <ChevronLeft className="rotate-180 text-slate-200" size={24} />
                      </div>
                      
                      {session.topic && (
                        <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/60">
                          <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">Tema planeado:</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">{session.topic}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : groupDetailTab === 'students' ? (
              <div className="space-y-4">
                {/* Panel de Alerta de Asistencia Práctico y Nativo (Menor al 80% o threshold) */}
                {(() => {
                  const atRiskStudents = selectedGroup.students.filter(s => {
                    const stats = Utils.calculateStudentStats(selectedGroup, s.id);
                    return stats.totalSessions > 0 && stats.percentage < attendanceThreshold;
                  });

                  if (atRiskStudents.length > 0) {
                    return (
                      <div className="p-5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-[2rem] shadow-sm mb-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                            <AlertTriangle size={20} className="animate-pulse" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-black text-rose-800 dark:text-rose-400 uppercase tracking-wide">Alerta de Asistencia</h4>
                            <p className="text-xs text-rose-700 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                              Tienes <strong>{atRiskStudents.length}</strong> {atRiskStudents.length === 1 ? 'alumno' : 'alumnos'} con promedio menor al <strong>{attendanceThreshold}%</strong> configurado.
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {atRiskStudents.map(st => {
                                const stats = Utils.calculateStudentStats(selectedGroup, st.id);
                                return (
                                  <span 
                                    key={st.id} 
                                    onClick={() => { setEditingStudent(st); setIsStudentModalOpen(true); }}
                                    className="cursor-pointer text-[10px] font-bold bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-950 px-2.5 py-1 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/60 transition"
                                  >
                                    {st.name.split(' ')[0]} ({stats.percentage}%)
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (selectedGroup.students.length > 0) {
                    return (
                      <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-[2rem] shadow-sm mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                            <CheckCircle2 size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">Asistencia Correcta</h4>
                            <p className="text-xs text-emerald-700 dark:text-slate-300 mt-0.5 font-medium">
                              Todos los alumnos están al corriente, con asistencia superior o igual al {attendanceThreshold}%.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => { setEditingStudent(null); setIsStudentModalOpen(true); }} className="py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-lg flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                    <UserPlus size={20} /> <span className="text-[10px] uppercase tracking-tighter">Agregar Manual</span>
                  </button>
                  <button onClick={() => setIsImportModalOpen(true)} className="py-5 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-800 rounded-[2rem] font-black shadow-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition">
                    <Upload size={20} /> <span className="text-[10px] uppercase tracking-tighter">Importación Inteligente</span>
                  </button>
                </div>

                {selectedGroup.students.map(student => {
                  const stats = Utils.calculateStudentStats(selectedGroup, student.id);
                  const isAtRisk = stats.percentage < attendanceThreshold && stats.totalSessions > 0;
                  return (
                    <div key={student.id} className="p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm transition-all relative overflow-hidden">
                      <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => { setEditingStudent(student); setIsStudentModalOpen(true); }}>
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 shrink-0"><User size={24} /></div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white leading-tight truncate">{student.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest shrink-0">{student.rollNumber || 'S/M'}</span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black">{stats.percentage}% Asistencia</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Alerta de riesgo interactiva */}
                      {isAtRisk ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenQuickRisk(student); }}
                          className={`mr-3 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 active:scale-95 transition ${stats.percentage < 70 ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}
                        >
                          <AlertTriangle size={12} className="animate-bounce" /> Riesgo
                        </button>
                      ) : null}

                      <button onClick={() => { setEditingStudent(student); setIsStudentModalOpen(true); }} className="p-2 text-slate-200 hover:text-slate-400">
                        <Edit2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : groupDetailTab === 'evaluations' ? (
              <EvaluationSection 
                group={selectedGroup}
                onSaveGroup={(updatedGroup) => {
                  Storage.saveGroup(updatedGroup);
                  refresh();
                }}
                onNotification={(msg) => setNotification(msg)}
              />
            ) : groupDetailTab === 'calendar' ? (
              <CalendarView 
                group={selectedGroup}
                onNavigateToSession={(session) => navigateTo(ViewState.SESSION_ATTENDANCE, selectedGroup, session)}
                onRefresh={refresh}
                onNotification={(msg) => setNotification(msg)}
                attendanceThreshold={attendanceThreshold}
              />
            ) : groupDetailTab === 'closure' ? (
              <AcademicClosure 
                group={selectedGroup}
                attendanceThreshold={attendanceThreshold}
                onSaveGroup={(updatedGroup) => {
                  Storage.saveGroup(updatedGroup);
                  refresh();
                }}
                onNotification={(msg) => setNotification(msg)}
              />
            ) : (
              <AcademicAnalytics 
                group={selectedGroup} 
                attendanceThreshold={attendanceThreshold} 
                onChangeThreshold={setAttendanceThreshold} 
              />
            )}
          </div>
        </div>}
        
        {view === ViewState.SESSION_ATTENDANCE && selectedSession && selectedGroup && <SessionAttendance 
          key={selectedSession.id} 
          session={selectedSession} 
          group={selectedGroup}
          attendanceThreshold={attendanceThreshold}
          onBack={goBack}
          onSave={att => { Storage.saveSessionAttendance(selectedGroup.id, selectedSession.id, att); refresh(); }}
        />}
        
        {view === ViewState.IMPORT_ICS && (
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 p-8 pt-16">
            <div className="flex justify-between mb-8 items-center">
              <h2 className="text-3xl font-black dark:text-white">Seleccionar Clases</h2>
              <button onClick={goBack} className="text-slate-400 p-2"><X size={32} /></button>
            </div>
            <p className="text-slate-500 text-sm font-bold mb-6 uppercase tracking-widest">Se detectaron {pendingGroups.length} clases potenciales</p>
            <div className="flex-1 overflow-y-auto space-y-4 mb-8">
              {pendingGroups.map(g => (
                <div key={g.id} onClick={() => setSelectionMap(prev => ({...prev, [g.id]: !prev[g.id]}))} className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center gap-5 ${selectionMap[g.id] ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-100 dark:border-slate-800'}`}>
                  <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center ${selectionMap[g.id] ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-200 dark:border-slate-700'}`}>{selectionMap[g.id] && <CheckCircle2 size={20} className="text-white" />}</div>
                  <div className="flex-1 min-w-0 pr-2"><h4 className="font-black text-slate-800 dark:text-white truncate">{g.name}</h4><p className="text-xs text-slate-400 font-bold uppercase tracking-tight">{g.sessions.length} sesiones generadas</p></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={goBack} className="py-6 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-[2rem] font-black uppercase tracking-widest text-xs">Cancelar</button>
              <button onClick={() => { pendingGroups.filter(g => selectionMap[g.id]).forEach(g => Storage.saveGroup(g)); refresh(); goBack(); }} className="py-6 bg-indigo-600 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">Importar ({Object.values(selectionMap).filter(Boolean).length})</button>
            </div>
          </div>
        )}
      </main>

      {/* --- NUEVO MODAL: ALERTA RÁPIDA DE ALUMNO INDIVIDUAL --- */}
      {quickStudentRisk && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} /> Reenganche Rápido
              </h3>
              <button onClick={() => setQuickStudentRisk(null)} className="text-slate-400">
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-center items-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300"><User size={32} /></div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{quickStudentRisk.student.name}</h4>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">{quickStudentRisk.percentage}% de asistencia • {quickStudentRisk.stats.absent} Faltas</p>
              </div>

              <div className="w-full text-left bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-800/60 mt-1 relative">
                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Mensaje Sugerido por IA:</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic mt-1">{quickStudentRisk.messageTemplate}</p>
              </div>

              {/* Botón Copiar Mensaje */}
              <button 
                onClick={() => handleCopyToClipboard(quickStudentRisk.messageTemplate, 'quick')}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {copiedId === 'quick' ? (
                  <><Check size={14} /><span>¡Copiado!</span></>
                ) : (
                  <><Copy size={14} /><span>Copiar Mensaje</span></>
                )}
              </button>

              {/* Botones de Acción Real según datos del alumno */}
              <div className="w-full grid grid-cols-2 gap-2.5">
                {/* Correo institucional - solo si tiene email registrado */}
                {quickStudentRisk.student.email ? (
                  <button
                    onClick={() => {
                      handleOpenEmail(
                        quickStudentRisk.student.email,
                        `ProfAsist: Seguimiento de Asistencia — ${selectedGroup?.name || 'Materia'}`,
                        quickStudentRisk.messageTemplate
                      );
                      setQuickStudentRisk(null);
                    }}
                    className="py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Mail size={13} />
                    <span>Correo</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setQuickStudentRisk(null);
                      // Abrir perfil del alumno para registrar correo
                      setTimeout(() => {
                        setEditingStudent(quickStudentRisk.student);
                        setIsStudentModalOpen(true);
                        setNotification('Registra el correo institucional del alumno para poder enviarle alertas.');
                      }, 100);
                    }}
                    className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-dashed border-slate-300 dark:border-slate-700"
                    title="Registra el correo del alumno para habilitar esta función"
                  >
                    <Mail size={13} />
                    <span>+ Correo</span>
                  </button>
                )}

                {/* WhatsApp - solo si tiene teléfono registrado */}
                {quickStudentRisk.student.phone ? (
                  <button
                    onClick={() => {
                      handleOpenWhatsApp(quickStudentRisk.student.phone, quickStudentRisk.messageTemplate);
                      setQuickStudentRisk(null);
                    }}
                    className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setQuickStudentRisk(null);
                      setTimeout(() => {
                        setEditingStudent(quickStudentRisk.student);
                        setIsStudentModalOpen(true);
                        setNotification('Registra el teléfono del alumno para poder contactar por WhatsApp.');
                      }, 100);
                    }}
                    className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-dashed border-slate-300 dark:border-slate-700"
                    title="Registra el teléfono del alumno para habilitar WhatsApp"
                  >
                    <MessageSquare size={13} />
                    <span>+ WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESPALDO GOOGLE DRIVE */}
      {isGDriveSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-2xl font-black dark:text-white tracking-tight flex items-center gap-2">
                <Settings size={28} className="text-indigo-600 dark:text-indigo-400" /> Ajustes del Profesor
              </h2>
              <button onClick={() => setIsGDriveSettingsOpen(false)} className="text-slate-300 hover:text-slate-500 transition">
                <X size={32} />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6 shrink-0">
              <button 
                onClick={() => setSettingsActiveTab('backup')}
                className={`py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                  settingsActiveTab === 'backup' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                💾 Nube
              </button>
              <button 
                onClick={() => setSettingsActiveTab('notifications')}
                className={`py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                  settingsActiveTab === 'notifications' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                🔔 Alertas
              </button>
              <button 
                onClick={() => setSettingsActiveTab('theme')}
                className={`py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                  settingsActiveTab === 'theme' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                🎨 Temas
              </button>
              <button 
                onClick={() => setSettingsActiveTab('audio')}
                className={`py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                  settingsActiveTab === 'audio' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                🔊 Audio
              </button>
            </div>

            {/* SCROLLABLE TAB CONTENT */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-4">
              {settingsActiveTab === 'backup' && (
                <div className="space-y-6">
                  {/* CARD 1: EXPORT / IMPORT BACKUP (RECOMMENDED) */}
                  <div className="p-6 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border border-emerald-500/20 dark:border-emerald-400/20 shadow-xs">
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm shrink-0 mt-0.5">
                        <Share2 size={22} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Gestión de Copia de Seguridad
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                          Guarda o restaura tus materias, alumnos, asistencias y notas en un archivo <strong>.json</strong>. Puedes guardarlo en <strong>Google Drive</strong>, enviarlo por <strong>WhatsApp</strong> o guardarlo en tu teléfono.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <button
                        onClick={handleShareBackup}
                        className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Share2 size={16} /> Exportar y Guardar Respaldo
                      </button>

                      <button
                        onClick={() => jsonInputRef.current?.click()}
                        className="w-full py-4 px-4 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black rounded-2xl text-xs uppercase tracking-wider border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Upload size={16} /> Restaurar o Importar Respaldo
                      </button>
                    </div>

                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      ref={jsonInputRef} 
                      onChange={handleLocalImport} 
                    />
                  </div>

                  {/* CARD 2: AUTOMATIC GOOGLE DRIVE API SYNC (OPTIONAL) */}
                  <details className="hidden" aria-hidden="true">
                    <summary className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 cursor-pointer list-none flex items-center justify-between select-none">
                      <div className="flex items-center gap-2">
                        <Cloud size={16} className="text-indigo-500" />
                        <span>Sincronización Automática en la Nube (Opcional)</span>
                      </div>
                      <span className="transition-transform group-open:rotate-180 text-slate-400">▼</span>
                    </summary>

                    <div className="mt-4 space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Permite que ProfAsist guarde copias automáticas en segundo plano en tu Google Drive. Requiere vincular un Client ID propio de Google Cloud Console.
                      </p>

                      {gdriveAccessToken ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span>Conectado a Google Drive API</span>
                            </div>
                            <button onClick={handleDisconnectGDrive} className="px-3 py-1.5 text-xs font-black text-rose-600 bg-white dark:bg-slate-800 rounded-xl flex items-center gap-1 active:scale-95 transition-all shadow-xs shrink-0">
                              <Unlink size={13} /> Desconectar
                            </button>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between">
                              <span className="font-bold">Archivo en Drive:</span>
                              <span className="font-mono font-medium">profasist_backup.json</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-bold">Último Respaldo Localizado:</span>
                              <span className="font-medium">
                                {gdriveFileInfo?.modifiedTime 
                                  ? new Date(gdriveFileInfo.modifiedTime).toLocaleString() 
                                  : gdriveLastBackup 
                                    ? new Date(gdriveLastBackup).toLocaleString() 
                                    : 'Nunca'
                                }
                              </span>
                            </div>
                            {gdriveFileInfo?.size && (
                              <div className="flex justify-between">
                                <span className="font-bold">Tamaño en la Nube:</span>
                                <span className="font-medium">{(parseInt(gdriveFileInfo.size) / 1024).toFixed(1)} KB</span>
                              </div>
                            )}
                          </div>

                          <button
                            disabled={isBackupLoading}
                            onClick={() => handleGDriveBackup(true)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                          >
                            {isBackupLoading ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <CloudUpload size={16} />
                            )}
                            {isBackupLoading ? 'Guardando Copia en Drive...' : 'Respaldar Datos en Drive Ahora'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                              Google OAuth Client ID
                            </label>
                            <input 
                              className="w-full bg-transparent border-none focus:ring-0 font-bold text-slate-800 dark:text-white p-0 text-xs placeholder:text-slate-400"
                              value={gdriveClientId}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                setGdriveClientId(val);
                                Storage.updateSettings({ gdriveClientId: val });
                              }}
                              placeholder="Ej: 123456-abcdef.apps.googleusercontent.com"
                            />
                          </div>

                          <button 
                            disabled={!gdriveClientId}
                            onClick={() => {
                              const redirectUri = window.location.origin;
                              window.location.href = GDriveService.getAuthUrl(gdriveClientId, redirectUri);
                            }}
                            className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 ${
                              gdriveClientId 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <CloudUpload size={16} /> Vincular Client ID de Google Drive
                          </button>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}



              {settingsActiveTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="p-5 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Bell size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Recordatorios de Pase de Lista</h3>
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">Alertas Locales</p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                      ProfAsist puede enviar alertas locales directamente a tu dispositivo a la hora exacta de tus clases para recordarte realizar el pase de lista. No requiere internet.
                    </p>

                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Estado de Notificaciones Nativas</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${
                          notificationPermission === 'granted' 
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                        }`}>
                          {notificationPermission === 'granted' ? 'Activo' : 'Pendiente'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/60">
                        {notificationPermission !== 'granted' ? (
                          <button 
                            onClick={handleRequestNotificationPermission}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2"
                          >
                            <Bell size={16} /> Permitir Notificaciones Nativas
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <button 
                              onClick={handleToggleLocalNotifications}
                              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs ${
                                localNotificationsEnabled 
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              {localNotificationsEnabled ? 'Desactivar Recordatorios' : 'Activar Recordatorios'}
                            </button>

                            {localNotificationsEnabled && (
                              <button 
                                onClick={handleSendTestNotification}
                                className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-indigo-200/50 dark:border-indigo-800/50"
                              >
                                🔔 Enviar Alerta de Prueba a la Barra de Estado
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {settingsActiveTab === 'theme' && (
                <div className="space-y-6">
                  <div className="p-5 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Palette size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Estilos Visuales de la App</h3>
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">Elige tu tema preferido</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                      Personaliza los colores de la interfaz con paletas optimizadas para lectura nocturna o diurna.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'light', name: 'Modo Claro', desc: 'Luminoso estándar', bg: 'bg-slate-100 text-slate-900 border-slate-300' },
                        { id: 'dark', name: 'Modo Oscuro', desc: 'Noche estándar', bg: 'bg-slate-900 text-white border-slate-700' },
                        { id: 'solarized-dark', name: 'Solarized Oscuro', desc: 'Azul-Verde medianoche', bg: 'bg-[#002b36] text-[#93a1a1] border-[#2aa198]' },
                        { id: 'solarized-light', name: 'Solarized Claro', desc: 'Crema cálido', bg: 'bg-[#fdf6e3] text-[#657b83] border-[#b58900]' },
                        { id: 'emerald', name: 'Esmeralda', desc: 'Verde bosque profundo', bg: 'bg-[#022c22] text-[#ecfdf5] border-[#10b981]' },
                        { id: 'nord', name: 'Ártico Nord', desc: 'Gris helado nórdico', bg: 'bg-[#2e3440] text-[#eceff4] border-[#88c0d0]' },
                      ].map((t) => {
                        const isActive = currentTheme === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => applyTheme(t.id as AppTheme)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden ${t.bg} ${
                              isActive ? 'ring-2 ring-indigo-500 ring-offset-2 scale-[1.02]' : 'hover:opacity-90 opacity-80'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-black">{t.name}</span>
                              {isActive && <Check size={16} className="text-indigo-400 font-bold" />}
                            </div>
                            <span className="text-[10px] opacity-75 font-semibold block">{t.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {settingsActiveTab === 'audio' && (
                <div className="space-y-6">
                  {/* CONFIGURACIÓN INTELIGENTE DE SONIDO Y HÁPTICA */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Volume2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sistema Inteligente de Audio y Vibración</h3>
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">Control fino y feedback táctil</p>
                      </div>
                    </div>

                    {/* INTERRUPTOR PRINCIPAL DE SONIDO */}
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Volume2 size={14} className="text-indigo-500" /> Efectos de Sonido Sintetizado
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Sonido offline Web Audio API sin consumir datos</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={audioSettings.soundEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const updated = { ...audioSettings, soundEnabled: val };
                          setAudioSettings(updated);
                          AudioHaptics.updateSettings({ soundEnabled: val });
                          if (val) AudioHaptics.playPop();
                        }}
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* CONTROL DE VOLUMEN (SLIDER) */}
                    {audioSettings.soundEnabled && (
                      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                          <span>Volumen General de Efectos</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono">{Math.round(audioSettings.soundVolume * 100)}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={audioSettings.soundVolume}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            const updated = { ...audioSettings, soundVolume: val };
                            setAudioSettings(updated);
                            AudioHaptics.updateSettings({ soundVolume: val });
                          }}
                          onMouseUp={() => AudioHaptics.playPop()}
                          onTouchEnd={() => AudioHaptics.playPop()}
                          className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
                        />
                      </div>
                    )}

                    {/* INTERRUPTOR PRINCIPAL DE VIBRACIÓN Y SELECTOR DE INTENSIDAD HÁPTICA */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Smartphone size={14} className="text-indigo-500" /> Vibración y Respuesta Háptica
                          </span>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Feedback físico al presionar botones y tomar lista</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={audioSettings.hapticsEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            const updated = { ...audioSettings, hapticsEnabled: val };
                            setAudioSettings(updated);
                            AudioHaptics.updateSettings({ hapticsEnabled: val });
                            if (val) AudioHaptics.vibrateSuccess();
                          }}
                          className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                        />
                      </div>

                      {audioSettings.hapticsEnabled && (
                        <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Intensidad Háptica</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'light', label: 'Suave', desc: 'Discreta' },
                              { id: 'medium', label: 'Normal', desc: 'Estándar' },
                              { id: 'heavy', label: 'Intensa', desc: 'Fuerte' }
                            ].map((lvl) => (
                              <button
                                key={lvl.id}
                                onClick={() => {
                                  const updated = { ...audioSettings, hapticsIntensity: lvl.id as any };
                                  setAudioSettings(updated);
                                  AudioHaptics.updateSettings({ hapticsIntensity: lvl.id as any });
                                  AudioHaptics.vibrateSuccess();
                                }}
                                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                                  audioSettings.hapticsIntensity === lvl.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                                    : 'bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="text-xs font-black">{lvl.label}</div>
                                <div className="text-[9px] opacity-80 mt-0.5">{lvl.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* EVENTOS ACTIVOS */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Efectos por Acción</label>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={audioSettings.soundAttendance}
                            onChange={(e) => {
                              const updated = { ...audioSettings, soundAttendance: e.target.checked };
                              setAudioSettings(updated);
                              AudioHaptics.updateSettings({ soundAttendance: e.target.checked });
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span>Pase de Lista</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={audioSettings.soundTimer}
                            onChange={(e) => {
                              const updated = { ...audioSettings, soundTimer: e.target.checked };
                              setAudioSettings(updated);
                              AudioHaptics.updateSettings({ soundTimer: e.target.checked });
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span>Temporizador</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={audioSettings.soundRoulette}
                            onChange={(e) => {
                              const updated = { ...audioSettings, soundRoulette: e.target.checked };
                              setAudioSettings(updated);
                              AudioHaptics.updateSettings({ soundRoulette: e.target.checked });
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span>Ruleta Alumnos</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={audioSettings.soundUI}
                            onChange={(e) => {
                              const updated = { ...audioSettings, soundUI: e.target.checked };
                              setAudioSettings(updated);
                              AudioHaptics.updateSettings({ soundUI: e.target.checked });
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span>Botones e Interfaz</span>
                        </label>
                      </div>
                    </div>

                    {/* VISTA PREVIA E INTERACTIVA DE PRUEBAS */}
                    <div className="pt-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Probar Tono y Vibración al Instante</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => AudioHaptics.playPresent()}
                          className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-all border border-emerald-200/50 dark:border-emerald-800/50"
                        >
                          Presente (P)
                        </button>
                        <button 
                          onClick={() => AudioHaptics.playAbsent()}
                          className="py-2.5 px-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-rose-100 transition-all border border-rose-200/50 dark:border-rose-800/50"
                        >
                          Falta (F)
                        </button>
                        <button 
                          onClick={() => AudioHaptics.playAlarm()}
                          className="py-2.5 px-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-all border border-amber-200/50 dark:border-amber-800/50"
                        >
                          Alarma Fin
                        </button>
                        <button 
                          onClick={() => AudioHaptics.vibrateSuccess()}
                          className="py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-all border border-indigo-200/50 dark:border-indigo-800/50"
                        >
                          Vibración Háptica
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CONFIGURACIÓN DE CALIDAD DE GRABACIÓN DE AUDIO */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Mic size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">Calidad y Formato de Grabación de Voz</h3>
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">Ajuste de bitrate y codificador</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Calidad de Audio (Bitrate)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: '64', label: '64 kbps', desc: 'Baja (Económica)' },
                            { id: '128', label: '128 kbps', desc: 'Estándar (Recomendada)' },
                            { id: '256', label: '256 kbps', desc: 'Alta (Voz HD)' }
                          ].map(q => (
                            <button
                              key={q.id}
                              onClick={() => {
                                setSelectedQuality(q.id as any);
                                AudioHaptics.playPop();
                                setNotification(`Calidad de audio configurada en ${q.label}.`);
                              }}
                              className={`p-3 rounded-xl border text-center transition-all ${
                                selectedQuality === q.id 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold' 
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                              }`}
                            >
                              <div className="text-xs font-black">{q.label}</div>
                              <div className="text-[9px] opacity-80 font-medium mt-0.5">{q.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Formato de Contenedor</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'mp3', label: 'M4A / AAC', desc: 'Nativo Android' },
                            { id: 'webm', label: 'WebM', desc: 'Web Estándar' },
                            { id: 'wav', label: 'WAV', desc: 'Sin Compresión' }
                          ].map(fmt => (
                            <button
                              key={fmt.id}
                              onClick={() => {
                                setSelectedFormat(fmt.id as any);
                                AudioHaptics.playPop();
                                setNotification(`Formato configurado en ${fmt.label}.`);
                              }}
                              className={`p-3 rounded-xl border text-center transition-all ${
                                selectedFormat === fmt.id 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold' 
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                              }`}
                            >
                              <div className="text-xs font-black">{fmt.label}</div>
                              <div className="text-[9px] opacity-80 font-medium mt-0.5">{fmt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Botón de Diagnóstico de Micrófono */}
                      <button
                        onClick={() => {
                          setIsGDriveSettingsOpen(false);
                          setIsRecorderOpen(true);
                          AudioHaptics.playPop();
                          setNotification("Abriendo grabadora para prueba de diagnóstico de micrófono.");
                        }}
                        className="w-full py-3 mt-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Mic size={16} /> Probar Micrófono Ahora
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                onClick={() => setIsGDriveSettingsOpen(false)} 
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Cerrar Panel de Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJUSTES GRUPO (PERSONALIZACIÓN / ELIMINACIÓN) */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 landscape:p-6 shadow-2xl overflow-y-auto max-h-[90vh] landscape:max-h-[95vh]">
            <div className="flex justify-between items-center mb-8 landscape:mb-4"><h2 className="text-2xl landscape:text-xl font-black dark:text-white tracking-tight flex items-center gap-2"><Settings size={24} className="text-indigo-500" /> Ajustes</h2><button onClick={() => setIsGroupModalOpen(false)} className="text-slate-300"><X size={32} className="landscape:w-6 landscape:h-6" /></button></div>
            
            <div className="space-y-6 mb-10">
              <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">NOMBRE DE MATERIA</label><input className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0 text-lg" defaultValue={editingGroup?.name} id="mname" placeholder="Ej: Bioquímica" /></div>
              
              <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">HORARIO (RESUMEN)</label><input className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0" defaultValue={editingGroup?.scheduleSummary || 'Lun, Mie 10:00'} id="msched" /></div>
              
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block flex items-center gap-2"><Palette size={14} /> Paleta de Colores</label>
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setCustomColor(c)} className={`w-10 h-10 rounded-full border-4 transition-all ${customColor === c ? 'border-indigo-400 scale-110 shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700">
                    <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)} className="absolute inset-0 w-full h-full scale-150 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => {
                const name = (document.getElementById('mname') as HTMLInputElement).value;
                const sched = (document.getElementById('msched') as HTMLInputElement).value;
                if(name) { 
                  Storage.saveGroup({
                    id: editingGroup?.id || Utils.generateUUID(), 
                    name, 
                    semester: editingGroup?.semester || '2026-A', 
                    color: customColor, 
                    scheduleSummary: sched, 
                    students: editingGroup?.students || [], 
                    sessions: editingGroup?.sessions || [], 
                    archived: editingGroup?.archived || false
                  }); 
                  refresh(); 
                  setIsGroupModalOpen(false); 
                }
              }} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl active:scale-95 transition-all">GUARDAR CAMBIOS</button>
              
              {editingGroup && (
                <>
                  <button 
                    onClick={() => {
                      if (editingGroup) {
                        const duplicated: Group = {
                          ...editingGroup,
                          id: Utils.generateUUID(),
                          name: `${editingGroup.name} (Copia)`,
                          sessions: [], // clean slate
                          archived: false
                        };
                        Storage.saveGroup(duplicated);
                        refresh();
                        setIsGroupModalOpen(false);
                        setNotification(`Clase "${editingGroup.name}" duplicada con éxito.`);
                      }
                    }} 
                    className="w-full py-3.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 active:scale-95 transition-all"
                  >
                    <Copy size={14} /> Duplicar Clase (Copia Limpia)
                  </button>

                  <button 
                    onClick={() => {
                      if (editingGroup) {
                        const updated: Group = {
                          ...editingGroup,
                          archived: !editingGroup.archived
                        };
                        Storage.saveGroup(updated);
                        refresh();
                        setIsGroupModalOpen(false);
                        setNotification(updated.archived ? `Clase "${editingGroup.name}" archivada.` : `Clase "${editingGroup.name}" desarchivada.`);
                      }
                    }} 
                    className="w-full py-3.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                  >
                    <Archive size={14} /> {editingGroup.archived ? 'Desarchivar Clase' : 'Archivar Clase'}
                  </button>
                </>
              )}

              {editingGroup && (
                <button onClick={() => setIsDeleteConfirmOpen(true)} className="w-full py-2 text-red-500 font-black text-xs uppercase flex items-center justify-center gap-2 active:opacity-60 transition">
                  <Trash2 size={16} /> Eliminar Esta Clase
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE ELIMINACIÓN */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6"><Trash2 size={40} /></div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">¿Eliminar Clase?</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">Se borrarán alumnos y asistencias de <span className="text-slate-900 dark:text-slate-100 font-bold">{editingGroup?.name}</span> de forma irreversible.</p>
            <div className="grid grid-cols-2 gap-3 w-full">
               <button onClick={() => setIsDeleteConfirmOpen(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest">Cancelar</button>
               <button onClick={() => { if(editingGroup) { Storage.deleteGroup(editingGroup.id); refresh(); setIsDeleteConfirmOpen(false); setIsGroupModalOpen(false); }}} className="py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase shadow-lg tracking-widest">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* OTROS MODALES (ESTUDIANTES, NOTIFICACIONES) */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 landscape:p-6 shadow-2xl overflow-y-auto max-h-[90vh] landscape:max-h-[95vh]">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl landscape:text-xl font-black dark:text-white tracking-tight">{editingStudent ? 'Editar Alumno' : 'Nuevo Alumno'}</h2><button onClick={() => setIsStudentModalOpen(false)} className="text-slate-300"><X size={28} className="landscape:w-6 landscape:h-6" /></button></div>
            <div className="space-y-4 mb-8">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">NOMBRE COMPLETO</label><input className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0 text-base" defaultValue={editingStudent?.name} id="sname" placeholder="Ej: Juan Pérez Morales" /></div>
              
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1.5 block">CORREO INSTITUCIONAL (TEAMS / OUTLOOK)</label>
                <input className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0 text-sm placeholder:text-slate-400" defaultValue={editingStudent?.email} id="semail" placeholder="ejemplo@universidad.edu.mx" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">MATRÍCULA / ID</label><input className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0 text-sm" defaultValue={editingStudent?.rollNumber} id="sroll" placeholder="Ej: 20261048" /></div>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">WHATSAPP (OPCIONAL)</label><input className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0 text-sm" defaultValue={editingStudent?.phone} id="sphone" placeholder="Ej: 3312345678" /></div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl"><label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">ETIQUETA / ROL EN CLASE</label>
                <select className="w-full bg-transparent border-none focus:ring-0 font-bold dark:text-white p-0 text-sm" defaultValue={editingStudent?.tag || ''} id="stag">
                  <option value="" className="dark:bg-slate-900">Sin etiqueta</option>
                  <option value="Apoyo Especial" className="dark:bg-slate-900">Requiere Apoyo Especial</option>
                  <option value="Becado" className="dark:bg-slate-900">Alumno Becado</option>
                  <option value="Excelencia" className="dark:bg-slate-900">Alto Rendimiento / Excelencia</option>
                  <option value="Representante" className="dark:bg-slate-900">Jefe de Grupo / Representante</option>
                </select>
              </div>

              {editingStudent?.email && (
                <button
                  onClick={() => handleOpenEmail(editingStudent.email, `ProfAsist: Seguimiento - ${selectedGroup?.name || 'Materia'}`, `Estimado(a) ${editingStudent.name.split(' ')[0]},\n\nTe escribo respecto a la materia ${selectedGroup?.name || ''}.`)}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  ✉️ Redactar Correo en Outlook / Gmail
                </button>
              )}

              {editingStudent?.phone && (
                <button
                  onClick={() => handleOpenWhatsApp(editingStudent.phone, `Hola ${editingStudent.name.split(' ')[0]}, te escribo de la materia ${selectedGroup?.name || ''}.`)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  💬 Abrir Chat de WhatsApp (Opcional)
                </button>
              )}
            </div>
            <button onClick={() => {
              const name = (document.getElementById('sname') as HTMLInputElement).value;
              const email = (document.getElementById('semail') as HTMLInputElement).value;
              const rollNumber = (document.getElementById('sroll') as HTMLInputElement).value;
              const phone = (document.getElementById('sphone') as HTMLInputElement).value;
              const tag = (document.getElementById('stag') as HTMLSelectElement).value;
              if(name && selectedGroup) {
                const s = { id: editingStudent?.id || Utils.generateUUID(), name, email, rollNumber, phone, tag };
                if (editingStudent) Storage.updateStudentInGroup(selectedGroup.id, s); else Storage.addStudentToGroup(selectedGroup.id, s);
                refresh(); setIsStudentModalOpen(false);
              }
            }} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs">Guardar Alumno</button>
          </div>
        </div>
      )}

      {isImportModalOpen && selectedGroup && (
        <StudentImporter 
          group={selectedGroup}
          onImport={(students) => {
            const updatedGroup = {
              ...selectedGroup,
              students: students
            };
            Storage.saveGroup(updatedGroup);
            refresh();
          }}
          onClose={() => setIsImportModalOpen(false)}
          onNotification={(msg) => setNotification(msg)}
        />
      )}

      {notification && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/60 backdrop-blur-md" onClick={() => setNotification(null)}>
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-full flex items-center justify-center mb-6"><AlertCircle size={32} /></div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">Información</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">{notification}</p>
            <button onClick={() => setNotification(null)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg uppercase tracking-widest text-xs">Entendido</button>
          </div>
        </div>
      )}

      {/* MODAL PARA TÍTULO DE EXCEL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Exportar Excel</h3>
                  <p className="text-[9px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-wider">Configuración de Reporte</p>
                </div>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 p-1 rounded-full"><X size={24} /></button>
            </div>

            <div className="space-y-6 mb-8">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-relaxed">
                Se generará una hoja de cálculo con el pase de lista de tus alumnos ordenados <strong>alfabéticamente</strong> de forma automática.
              </p>
              
              <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Título de la Lista / Reporte</label>
                <input 
                  type="text"
                  value={exportTitleInput} 
                  onChange={e => setExportTitleInput(e.target.value)}
                  placeholder="Ej: Reporte de Asistencia Bioquímica - 2026"
                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 font-bold text-slate-800 dark:text-white p-0 text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button 
                onClick={() => setIsExportModalOpen(false)} 
                className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (selectedGroup) {
                    Utils.generateXLSX(selectedGroup, exportTitleInput);
                    setIsExportModalOpen(false);
                    setNotification("¡Excel exportado con éxito en orden alfabético!");
                  }
                }} 
                className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg tracking-widest active:scale-95 transition-all"
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de correo simulado eliminado — la comunicación real se hace desde el modal Reenganche Rápido con mailto: y WhatsApp directos */}

      {/* --- NUEVO DRAWER: GRABADORA DE AUDIO MULTIFUNCIONAL --- */}
      {isRecorderOpen && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-end p-0 bg-black/60 backdrop-blur-xs">
          <div className="w-full sm:max-w-md h-full sm:h-[95vh] bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-l-[2.5rem] sm:rounded-tr-none p-6 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-300">
            
            {/* Cabecera */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-indigo-600 rounded-2xl text-white">
                  <Mic size={22} className={isRecording && !isPaused ? "animate-pulse" : ""} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">Grabadora de Notas de Audio</h3>
                  <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">ProfAsist Audio Recorder</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (isRecording) {
                    if (confirm('¿Deseas detener la grabación en curso?')) {
                      stopRecording(true);
                      setIsRecorderOpen(false);
                    }
                  } else {
                    setIsRecorderOpen(false);
                  }
                }} 
                className="text-slate-400 dark:text-slate-500 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido principal scrolleable */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-16">
              
              {/* INTERFAZ EN TIEMPO REAL */}
              <div className="p-6 bg-slate-50 dark:bg-slate-850 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden">
                {isRecording ? (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                    <span className="text-[9px] font-black uppercase text-red-500 tracking-wider">
                      {isPaused ? "Pausado" : "Grabando"}
                    </span>
                  </div>
                ) : null}

                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${isRecording && !isPaused ? 'bg-red-500 text-white scale-110 shadow-xl shadow-red-500/20' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'}`}>
                  <Mic size={36} className={isRecording && !isPaused ? "animate-pulse" : ""} />
                </div>

                <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                  {formatDuration(recordingDuration)}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  {isRecording ? (isPaused ? "Grabación en pausa" : "Capturando audio del micrófono...") : "Listo para grabar"}
                </p>

                {/* BOTONES DE CONTROL */}
                <div className="flex items-center gap-4 mt-6">
                  {isRecording ? (
                    <>
                      <button 
                        onClick={() => stopRecording(true)}
                        className="p-4 bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-full active:scale-90 transition shadow-sm"
                        title="Cancelar y borrar"
                      >
                        <Trash2 size={20} />
                      </button>

                      {isPaused ? (
                        <button 
                          onClick={resumeRecording}
                          className="p-5 bg-indigo-600 text-white rounded-full active:scale-90 transition shadow-lg"
                          title="Reanudar"
                        >
                          <Mic size={24} />
                        </button>
                      ) : (
                        <button 
                          onClick={pauseRecording}
                          className="p-5 bg-amber-500 text-white rounded-full active:scale-90 transition shadow-lg"
                          title="Pausar"
                        >
                          <Pause size={24} />
                        </button>
                      )}

                      <button 
                        onClick={() => stopRecording(false)}
                        className="p-4 bg-emerald-500 text-white rounded-full active:scale-90 transition shadow-lg"
                        title="Guardar grabación"
                      >
                        <Check size={20} />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={startRecording}
                      className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-indigo-600 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg hover:from-emerald-600 hover:to-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Mic size={16} /> Iniciar Grabación
                    </button>
                  )}
                </div>
              </div>

              {/* CONFIGURACIÓN Y PARÁMETROS */}
              <div className="space-y-4">
                <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Ajustes de Grabación</h4>

                {/* Perfil de Enfoque */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Propósito de la Grabación</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setSelectedMode('profesor')}
                      className={`w-full py-3 rounded-xl text-xs font-bold transition ${selectedMode === 'profesor' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800'}`}
                    >
                      Exposición de Clase
                    </button>
                    <button 
                      onClick={() => setSelectedMode('alumno')}
                      className={`w-full py-3 rounded-xl text-xs font-bold transition ${selectedMode === 'alumno' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800'}`}
                    >
                      Nota de Alumno / Retro
                    </button>
                  </div>
                </div>

                {/* Ubicación de guardado / Carpeta */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Destino de Almacenamiento</span>
                    <button 
                      onClick={() => setIsAddFolderOpen(true)}
                      className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5"
                    >
                      <Plus size={10} /> Nueva Carpeta
                    </button>
                  </div>
                  
                  <select 
                    value={selectedFolder}
                    onChange={e => setSelectedFolder(e.target.value)}
                    className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value="Clases y Lecciones">📂 Clases y Lecciones</option>
                    <option value="Notas Pedagógicas">📂 Notas Pedagógicas</option>
                    <option value="Reuniones y Mentorías">📂 Reuniones y Mentorías</option>
                    {customFolders.map(folder => (
                      <option key={folder} value={folder}>📂 {folder}</option>
                    ))}
                  </select>
                </div>

                {/* Formato y Calidad de Audio */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Formato</span>
                    <div className="flex gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                      {(['mp3', 'wav', 'webm'] as const).map(fmt => (
                        <button 
                          key={fmt}
                          onClick={() => setSelectedFormat(fmt)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase ${selectedFormat === fmt ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Calidad de Audio</span>
                    <select 
                      value={selectedQuality}
                      onChange={e => setSelectedQuality(e.target.value as any)}
                      className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-800 dark:text-white"
                    >
                      <option value="64">64 kbps (Eco)</option>
                      <option value="128">128 kbps (Estándar)</option>
                      <option value="256">256 kbps (HQ)</option>
                    </select>
                  </div>
                </div>

                {/* Límite de tiempo */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Límite Máximo de Tiempo</span>
                  <select 
                    value={selectedLimit}
                    onChange={e => setSelectedLimit(Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-white"
                  >
                    <option value={0}>∞ Ilimitado</option>
                    <option value={0.166667}>⏱ 10 Segundos (Prueba rápida)</option>
                    <option value={0.5}>⏱ 30 Segundos</option>
                    <option value={1}>⏱ 1 Minuto</option>
                    <option value={5}>⏱ 5 Minutos</option>
                    <option value={10}>⏱ 10 Minutos</option>
                    <option value={30}>⏱ 30 Minutos</option>
                  </select>
                </div>
              </div>

              {/* BIBLIOTECA DE GRABACIONES LOCALES */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Biblioteca Local ({recordingsList.length})</h4>
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-1 rounded-md">
                    Guardado automático
                  </span>
                </div>

                <div className="space-y-3">
                  {recordingsList.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">Aún no hay grabaciones locales guardadas.</p>
                  ) : (
                    recordingsList.map(rec => (
                      <div key={rec.id} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate" title={rec.name}>{rec.name}</h5>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">{rec.folder}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 uppercase">{rec.mode === 'profesor' ? 'Clase' : 'Retro'}</span>
                              <span className="text-[9px] font-bold text-slate-400">{rec.duration} • {rec.format.toUpperCase()} • {rec.date}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteRecording(rec.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg active:scale-95 transition shrink-0"
                            title="Eliminar grabación"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Reproductor de Audio HTML5 Estándar Integrado */}
                        <div className="w-full">
                          <audio 
                            src={rec.url} 
                            controls 
                            className="w-full h-8 accent-indigo-600 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR CARPETA NUEVA */}
      {isAddFolderOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-black dark:text-white mb-4 uppercase tracking-widest text-slate-400">Crear Carpeta Personalizada</h3>
            
            <input 
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Ej: Trabajos Finales"
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white text-xs font-bold border border-slate-100 dark:border-slate-700 focus:outline-none mb-6"
            />

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setIsAddFolderOpen(false); setNewFolderName(''); }}
                className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (newFolderName.trim()) {
                    setCustomFolders(prev => [...prev, newFolderName.trim()]);
                    setSelectedFolder(newFolderName.trim());
                    setIsAddFolderOpen(false);
                    setNewFolderName('');
                    setNotification(`Carpeta "${newFolderName.trim()}" creada con éxito.`);
                  }
                }}
                className="py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BENCHMARK MODAL 1: RULETA DE ALUMNO AL AZAR */}
      {isRandomizerOpen && selectedGroup && (
        <StudentRandomizerModal
          students={selectedGroup.students}
          onClose={() => setIsRandomizerOpen(false)}
        />
      )}

      {/* BENCHMARK MODAL 2: TEMPORIZADOR DE CLASE */}
      {isTimerOpen && (
        <ClassroomTimerModal
          onClose={() => setIsTimerOpen(false)}
        />
      )}

    </div>
  );
};

export default App;
