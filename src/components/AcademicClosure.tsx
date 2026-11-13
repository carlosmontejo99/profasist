import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, FileText, Printer, Check, X, 
  Settings, Award, Sparkles, BookOpen, User, 
  Percent, AlertCircle, RefreshCw, Calculator, HelpCircle,
  Download, Calendar, ChevronRight, CheckCircle2, ChevronDown, Sliders
} from 'lucide-react';
import { Group, ClosureConfig, GradingPolicy } from '../../types';
import * as Utils from '../../services/utils';
import { AudioHaptics } from '../../services/audioHaptics';
import { calculateParcialScore, calculateFinalScore, formatGrade } from '../../services/grading';
import * as XLSX from 'xlsx';

export type { ClosureConfig } from '../../types';

interface AcademicClosureProps {
  group: Group;
  attendanceThreshold: number;
  onSaveGroup: (updatedGroup: Group) => void;
  onNotification: (msg: string) => void;
}

// Convert numbers to Spanish text helper
const numberToSpanishWords = (num: number | null, status?: string): string => {
  if (status === 'S/D' || status === 'Sin derecho') return 'SIN DERECHO';
  if (num === null || status === 'Pendiente') return 'PENDIENTE';
  
  const rounded = Math.round(num * 10) / 10;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 10);

  const words: Record<number, string> = {
    0: 'CERO', 1: 'UNO', 2: 'DOS', 3: 'TRES', 4: 'CUATRO',
    5: 'CINCO', 6: 'SEIS', 7: 'SIETE', 8: 'OCHO', 9: 'NUEVE', 10: 'DIEZ'
  };

  const integerWord = words[integerPart] || integerPart.toString();
  if (decimalPart === 0) {
    if (integerPart === 10) return 'DIEZ';
    return `${integerWord} PUNTO CERO`;
  }
  const decimalWord = words[decimalPart] || decimalPart.toString();
  return `${integerWord} PUNTO ${decimalWord}`;
};

export const AcademicClosure: React.FC<AcademicClosureProps> = ({ 
  group, 
  attendanceThreshold, 
  onSaveGroup, 
  onNotification 
}) => {
  const [activeTab, setActiveTab] = useState<'parcial' | 'semestral' | 'acta' | 'config'>('semestral');
  const [selectedParcial, setSelectedParcial] = useState<'p1' | 'p2' | 'p3'>('p1');
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  
  // Load configuration or set defaults
  const [config, setConfig] = useState<ClosureConfig>({
    universityName: 'UNIVERSIDAD AUTÓNOMA DE CIUDAD JUÁREZ · DCQB',
    formulaType: 'simple',
    weights: { p1: 30, p2: 30, p3: 40 },
    minAttendancePass: false,
    attendanceMinRate: attendanceThreshold,
    roundingRule: 'round',
    failIfAnyParcialFailed: false,
    teacherName: '',
    minPass: 7.0,
  });

  // Extract settings on group load
  useEffect(() => {
    // Check if group has a saved closure config
    const savedConfig = group.closureConfig;
    if (savedConfig) {
      setConfig(savedConfig);
    } else {
      // Default teacher name from global settings if available
      const teacherName = localStorage.getItem('profasist_v1_data') 
        ? JSON.parse(localStorage.getItem('profasist_v1_data')!).settings?.teacherName 
        : '';
      
      setConfig(prev => ({
        ...prev,
        attendanceMinRate: attendanceThreshold,
        teacherName: teacherName || ''
      }));
    }
  }, [group, attendanceThreshold]);

  // Handle saving the configuration
  const handleSaveConfig = (newConfig: ClosureConfig) => {
    setConfig(newConfig);
    const updatedGroup = {
      ...group,
      closureConfig: newConfig
    };
    onSaveGroup(updatedGroup);
    onNotification('Configuración de cierre académico guardada.');
  };

  // Effective policy for this screen. The engine is shared with the
  // evaluation grid and the institutional export.
  const gradingPolicy: GradingPolicy = {
    formula: config.formulaType === 'weighted' ? 'weighted' : 'simple',
    weights: config.weights,
    rounding: config.roundingRule,
    minPass: config.minPass ?? 7.0,
    attendanceGate: {
      enabled: config.minAttendancePass,
      minRate: config.attendanceMinRate,
    },
    missingPolicy: 'renormalize',
  };

  // Safe helper to evaluate student averages for a single parcial.
  const getParcialGrade = (
    studentId: string,
    parcialKey: 'parcial1' | 'parcial2' | 'parcial3',
  ): number | null =>
    calculateParcialScore(studentId, group.evaluations?.[parcialKey], gradingPolicy).value;

  // Compile the final score with the same engine used by the rest of the app.
  const getStudentFinalScore = (studentId: string) => {
    const result = calculateFinalScore(group, studentId, gradingPolicy);
    return {
      p1: result.p1,
      p2: result.p2,
      p3: result.p3,
      rawGrade: result.rawFinal ?? 0,
      finalGrade: result.final,
      status: result.status,
      attendancePercentage: result.attendancePercentage,
      reason: result.reason,
      warnings: result.warnings,
    };
  };

  // EXPORT TO EXCEL NATIVE FUNCTION WITH STYLING AND FREEZE PANES
  const handleExportXLSX = () => {
    const workbook = XLSX.utils.book_new();
    
    // Prepare metadata block
    const titleBlock = [
      [config.universityName.toUpperCase()],
      ["ACTA DE EVALUACIÓN SEMESTRAL - CIERRE ACADÉMICO"],
      [],
      ["MATERIA:", group.name.toUpperCase(), "PROFESOR:", (config.teacherName || "S/D").toUpperCase()],
      ["SEMESTRE:", group.semester, "FECHA:", new Date().toLocaleDateString('es-MX')],
      ["FÓRMULA:", config.formulaType === 'simple' ? "PROMEDIO SIMPLE (P1+P2+P3)/3" : `PROMEDIO PONDERADO (${config.weights.p1}% / ${config.weights.p2}% / ${config.weights.p3}%)`, "REGLA DE REDONDEO:", config.roundingRule.toUpperCase()],
      []
    ];

    // Table Headers
    const headers = [
      "Matrícula", 
      "Nombre Completo", 
      "Parcial 1", 
      "Parcial 2", 
      "Parcial 3", 
      "Final (Num)", 
      "Final (Letra)", 
      "Asistencia %", 
      "Estatus"
    ];

    // Compile rows
    const dataRows = group.students.map(student => {
      const summary = getStudentFinalScore(student.id);
      return [
        student.rollNumber || 'S/M',
        student.name,
        summary.p1 === null ? '' : Number(summary.p1.toFixed(1)),
        summary.p2 === null ? '' : Number(summary.p2.toFixed(1)),
        summary.p3 === null ? '' : Number(summary.p3.toFixed(1)),
        summary.finalGrade === null ? '' : Number(summary.finalGrade.toFixed(1)),
        numberToSpanishWords(summary.finalGrade, summary.status),
        `${summary.attendancePercentage}%`,
        summary.status
      ];
    });

    // Summary Statistics
    const approvedCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'Acreditado').length;
    const reprobadosCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'No Acreditado').length;
    const sdCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'Sin derecho').length;
    const pendienteCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'Pendiente').length;
    const totalStudents = group.students.length;
    const approvedRate = totalStudents > 0 ? ((approvedCount / totalStudents) * 100).toFixed(1) : '0';

    const footerRows = [
      [],
      ["ESTADÍSTICAS DEL GRUPO"],
      ["Alumnos Registrados:", totalStudents, "Acreditados:", approvedCount],
      ["No Acreditados:", reprobadosCount, "Sin Derecho (S/D):", sdCount],
      ["Pendientes:", pendienteCount, "Porcentaje de Acreditación:", `${approvedRate}%`]
    ];

    // Build worksheet with All Data
    const sheetContent = [...titleBlock, headers, ...dataRows, ...footerRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetContent);

    // Set dynamic column widths
    const maxNameLen = Math.max(32, ...(group.students || []).map(s => (s.name || '').length + 3));
    ws['!cols'] = [
      { wch: 15 }, // Matrícula
      { wch: maxNameLen }, // Nombre
      { wch: 14 }, // P1
      { wch: 14 }, // P2
      { wch: 14 }, // P3
      { wch: 16 }, // Final (Num)
      { wch: 28 }, // Final (Letra)
      { wch: 15 }, // Asistencia
      { wch: 16 }  // Estatus
    ];

    // FREEZE PANES!
    // Row 8 is where student data begins (indices are 0-based, so row 8 = index 7, and we freeze cols A & B which is split index 2)
    ws['!views'] = [
      { state: 'frozen', xSplit: 2, ySplit: 7, topLeftCell: 'C8', activePane: 'bottomRight' }
    ];

    XLSX.utils.book_append_sheet(workbook, ws, "Acta de Cierre");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const sanitizedName = group.name.replace(/[^a-zA-Z0-9]/g, '_');
    Utils.triggerDownload(`Acta_Final_${sanitizedName}_${group.semester}.xlsx`, blob);
    AudioHaptics.playSuccess();
    onNotification('Se ha generado el archivo XLSX nativo con congelación de paneles.');
  };

  const triggerSystemPrint = () => {
    AudioHaptics.playSuccess();
    window.print();
  };

  // Statistics calculation for overview
  const totalStudents = group.students.length;
  const approvedCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'Acreditado').length;
  const reprobadosCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'No Acreditado').length;
  const sdCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'Sin derecho').length;
  const pendienteCount = group.students.filter(s => getStudentFinalScore(s.id).status === 'Pendiente').length;
  const passRate = totalStudents > 0 ? Math.round((approvedCount / totalStudents) * 100) : 0;

  // Calculate average final grade of entire class, ignoring pending students.
  const gradedFinals = group.students
    .map(s => getStudentFinalScore(s.id).finalGrade)
    .filter((value): value is number => value !== null);
  const classAverage = gradedFinals.length > 0
    ? (gradedFinals.reduce((acc, value) => acc + value, 0) / gradedFinals.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      
      {/* HEADER CARD */}
      <div className="p-6 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-[2rem] shadow-xl relative overflow-hidden border border-indigo-950">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Award size={180} className="text-white" />
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="px-3.5 py-1.5 bg-indigo-500/25 border border-indigo-500/40 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-200">
              Cierre de Curso Oficial
            </span>
            <span className="text-xs font-mono text-indigo-300">
              Ciclo: {group.semester}
            </span>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">
              {group.name}
            </h1>
            <p className="text-indigo-200/80 text-xs mt-1 max-w-2xl leading-relaxed">
              Termina tu curso emitiendo actas consolidadas y actas finales listas para captura institucional. Realiza ponderaciones, redondeos e inasistencias en segundos.
            </p>
          </div>

          {/* QUICK CHIPS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Promedio Grupal</p>
              <p className="text-xl font-black mt-1 text-white">{classAverage}</p>
            </div>
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Acreditados</p>
              <p className="text-xl font-black mt-1 text-emerald-400">{approvedCount} <span className="text-xs text-white/50 font-medium">({passRate}%)</span></p>
            </div>
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">No Acreditados</p>
              <p className="text-xl font-black mt-1 text-rose-400">{reprobadosCount}</p>
            </div>
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Sin Derecho (S/D)</p>
              <p className="text-xl font-black mt-1 text-amber-400">{sdCount} <span className="text-xs text-white/50 font-medium">· {pendienteCount} pend.</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION TABS & EXPORTS HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-3xl">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
          <button 
            onClick={() => { setActiveTab('semestral'); setIsPrintPreview(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
              activeTab === 'semestral' && !isPrintPreview
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Concentrado Semestral
          </button>
          
          <button 
            onClick={() => { setActiveTab('parcial'); setIsPrintPreview(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
              activeTab === 'parcial' && !isPrintPreview
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Por Parcial
          </button>

          <button 
            onClick={() => { setActiveTab('acta'); setIsPrintPreview(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
              activeTab === 'acta' && !isPrintPreview
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            Acta Final
          </button>

          <button 
            onClick={() => { setActiveTab('config'); setIsPrintPreview(false); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === 'config' && !isPrintPreview
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Settings size={14} /> Ajustes
          </button>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPrintPreview(true)}
            className={`px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              isPrintPreview ? 'ring-2 ring-indigo-500' : ''
            }`}
          >
            <Printer size={15} /> Vista Impresión
          </button>

          <button 
            onClick={handleExportXLSX}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10 active:scale-[0.98]"
          >
            <FileSpreadsheet size={15} /> Exportar XLSX
          </button>
        </div>
      </div>

      {/* PRINT PREVIEW OVERLAY / INTERACTIVE MODE */}
      {isPrintPreview ? (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Printer size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-indigo-900 dark:text-white">Modo Vista de Impresión Activado</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">Se ha estructurado un formato limpio, de alto contraste institucional listo para imprimirse.</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={triggerSystemPrint}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={14} /> Imprimir Ahora
              </button>
              <button 
                onClick={() => setIsPrintPreview(false)}
                className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-650 text-slate-700 dark:text-white font-black text-xs uppercase tracking-wider rounded-lg"
              >
                Salir de Vista
              </button>
            </div>
          </div>

          {/* BEAUTIFUL INSTITUTIONAL FORMAT */}
          <div className="bg-white text-slate-900 p-8 md:p-12 border border-slate-200 rounded-[2rem] shadow-sm max-w-4xl mx-auto font-sans" id="print-area">
            {/* Styles specific to print media to optimize output on physical sheet */}
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                #print-area, #print-area * {
                  visibility: visible;
                }
                #print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

            {/* University & Division Header */}
            <div className="text-center space-y-2 border-b-2 border-slate-800 pb-5">
              <div className="text-xl font-black tracking-wider uppercase text-slate-950">{config.universityName}</div>
              <div className="text-xs font-black uppercase text-slate-500 tracking-widest">Servicios Escolares & Registro Académico</div>
              <div className="text-[11px] font-bold bg-slate-100 text-slate-800 px-4 py-1.5 rounded-md inline-block mt-2 uppercase tracking-wide">
                ACTA OFICIAL DE EVALUACIÓN SEMESTRAL
              </div>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3.5 gap-x-6 text-xs py-6 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Asignatura</span>
                <span className="font-bold text-slate-800 uppercase">{group.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Catedrático</span>
                <span className="font-bold text-slate-800 uppercase">{config.teacherName || 'S/D'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Ciclo Escolar</span>
                <span className="font-bold text-slate-800">{group.semester}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Fecha de Emisión</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Total Alumnos</span>
                <span className="font-bold text-slate-800">{group.students.length}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase block">Fórmula de Evaluación</span>
                <span className="font-bold text-slate-800 uppercase">
                  {config.formulaType === 'simple' ? 'Promedio Simple' : `Ponderado (${config.weights.p1}/${config.weights.p2}/${config.weights.p3})`}
                </span>
              </div>
            </div>

            {/* Main Records Table */}
            <table className="w-full text-xs text-left mt-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 w-12">No.</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600">Matrícula</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600">Nombre del Alumno</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 text-center">P1</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 text-center">P2</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 text-center">P3</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 text-center">Prom</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 text-center">% Asis</th>
                  <th className="py-2.5 px-2 font-black uppercase text-slate-600 text-right">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {group.students.map((student, idx) => {
                  const summary = getStudentFinalScore(student.id);
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-slate-700">{student.rollNumber || 'S/M'}</td>
                      <td className="py-2.5 px-2 font-bold text-slate-850 uppercase">{student.name}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-600">{formatGrade(summary.p1)}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-600">{formatGrade(summary.p2)}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-600">{formatGrade(summary.p3)}</td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-900">{formatGrade(summary.finalGrade)}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-600">{summary.attendancePercentage}%</td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={`font-black text-[10px] uppercase px-2 py-0.5 rounded ${
                          summary.status === 'Acreditado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          summary.status === 'Pendiente' ? 'bg-slate-50 text-slate-600 border border-slate-200' :
                          summary.status === 'Sin derecho' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {summary.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Signatures & Certification Grid */}
            <div className="mt-16 pt-12 border-t border-slate-200 grid grid-cols-2 gap-12 text-center">
              <div className="space-y-1">
                <div className="w-48 border-b border-slate-400 mx-auto h-12"></div>
                <div className="text-[10px] font-black text-slate-400 uppercase">Firma del Catedrático</div>
                <div className="text-xs font-bold text-slate-700 uppercase">{config.teacherName || 'Docente de la Materia'}</div>
              </div>

              <div className="space-y-1">
                <div className="w-48 border-b border-slate-400 mx-auto h-12 flex items-center justify-center">
                  <span className="text-[9px] text-slate-300 font-bold uppercase border border-slate-200 border-dashed px-3 py-1 rounded">Sello del Plantel</span>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase">Sello de Control Escolar</div>
                <div className="text-xs font-bold text-slate-700 uppercase">Departamento de Servicios Escolares</div>
              </div>
            </div>

            {/* Official Footer Disclaimer */}
            <div className="mt-12 text-center text-[9px] text-slate-400 border-t border-slate-100 pt-4 font-mono leading-relaxed uppercase">
              Este documento es un registro académico oficial de {config.universityName}. Cualquier alteración invalida su legitimidad.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: CONCENTRADO SEMESTRAL */}
          {activeTab === 'semestral' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-200">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-wide text-sm flex items-center gap-1.5">
                    <BookOpen size={16} className="text-indigo-500" /> Concentrado Semestral Consolidado
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Muestra las evaluaciones consolidadas de los 3 parciales y calcula la nota final aplicando tus reglas de redondeo.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold">
                      <th className="py-3 px-4 w-12 text-center">No.</th>
                      <th className="py-3 px-4 w-32">Matrícula</th>
                      <th className="py-3 px-4">Alumno</th>
                      <th className="py-3 px-4 text-center w-20">Parcial 1</th>
                      <th className="py-3 px-4 text-center w-20">Parcial 2</th>
                      <th className="py-3 px-4 text-center w-20">Parcial 3</th>
                      <th className="py-3 px-4 text-center w-24 bg-indigo-50/20 dark:bg-slate-800/80">Final</th>
                      <th className="py-3 px-4 text-center w-24">Asistencia</th>
                      <th className="py-3 px-4 text-right w-32">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                    {group.students.map((student, idx) => {
                      const score = getStudentFinalScore(student.id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-all">
                          <td className="py-3 px-4 text-slate-400 dark:text-slate-500 font-mono text-center">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{student.rollNumber || 'S/M'}</td>
                          <td className="py-3 px-4 font-black text-slate-850 dark:text-white uppercase">{student.name}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{formatGrade(score.p1)}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{formatGrade(score.p2)}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{formatGrade(score.p3)}</td>
                          <td className="py-3 px-4 text-center font-black bg-indigo-50/30 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-sm">
                            {formatGrade(score.finalGrade)}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{score.attendancePercentage}%</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`inline-block text-[9px] font-black uppercase px-2.5 py-1 rounded-md ${
                              score.status === 'Acreditado'
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950'
                                : score.status === 'Pendiente'
                                  ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  : score.status === 'Sin derecho'
                                    ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-950'
                                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950'
                            }`}>
                              {score.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CONCENTRADO POR PARCIAL */}
          {activeTab === 'parcial' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Parcial selector */}
              <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-max">
                <button 
                  onClick={() => setSelectedParcial('p1')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedParcial === 'p1' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                      : 'text-slate-500'
                  }`}
                >
                  Parcial 1
                </button>
                <button 
                  onClick={() => setSelectedParcial('p2')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedParcial === 'p2' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                      : 'text-slate-500'
                  }`}
                >
                  Parcial 2
                </button>
                <button 
                  onClick={() => setSelectedParcial('p3')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    selectedParcial === 'p3' 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' 
                      : 'text-slate-500'
                  }`}
                >
                  Parcial 3
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold">
                        <th className="py-3 px-4 w-12 text-center">No.</th>
                        <th className="py-3 px-4 w-32">Matrícula</th>
                        <th className="py-3 px-4">Alumno</th>
                        <th className="py-3 px-4 text-center w-36">Calificación del Parcial</th>
                        <th className="py-3 px-4 text-right w-44">Estatus Parcial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                      {group.students.map((student, idx) => {
                        const grade = getParcialGrade(student.id, selectedParcial === 'p1' ? 'parcial1' : selectedParcial === 'p2' ? 'parcial2' : 'parcial3');
                        const isPending = grade === null;
                        const isApproved = grade !== null && grade >= (config.minPass ?? 7.0);
                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-all">
                            <td className="py-3 px-4 text-slate-400 dark:text-slate-500 font-mono text-center">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{student.rollNumber || 'S/M'}</td>
                            <td className="py-3 px-4 font-black text-slate-850 dark:text-white uppercase">{student.name}</td>
                            <td className="py-3 px-4 text-center font-black text-slate-800 dark:text-white text-sm">
                              {formatGrade(grade)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`inline-block text-[9px] font-black uppercase px-2.5 py-1 rounded-md ${
                                isPending
                                  ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  : isApproved
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950'
                                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950'
                              }`}>
                                {isPending ? 'Pendiente' : isApproved ? 'Acreditado' : 'No Acreditado'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTA FINAL DE CAPTURA INSTITUCIONAL */}
          {activeTab === 'acta' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden animate-in fade-in duration-200">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800">
                <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-wide text-sm flex items-center gap-1.5">
                  <FileText size={16} className="text-indigo-500" /> Acta de Calificaciones Final (Formato Institucional)
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Optimizado para una rápida captura en el portal escolar de tu plantel. Incluye la traducción oficial de números a texto.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold">
                      <th className="py-3.5 px-4 w-12 text-center">No.</th>
                      <th className="py-3.5 px-4 w-36">Matrícula</th>
                      <th className="py-3.5 px-4">Nombre del Alumno</th>
                      <th className="py-3.5 px-4 text-center w-28 bg-indigo-50/20 dark:bg-slate-850">Calificación (Número)</th>
                      <th className="py-3.5 px-4 w-52 bg-indigo-50/10 dark:bg-slate-850/50">Calificación (Texto Oficial)</th>
                      <th className="py-3.5 px-4 text-right w-36">Dictamen Oficial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
                    {group.students.map((student, idx) => {
                      const score = getStudentFinalScore(student.id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-all">
                          <td className="py-3.5 px-4 text-slate-400 dark:text-slate-500 font-mono text-center">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{student.rollNumber || 'S/M'}</td>
                          <td className="py-3.5 px-4 font-black text-slate-850 dark:text-white uppercase">{student.name}</td>
                          <td className="py-3.5 px-4 text-center font-black bg-indigo-50/10 dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 text-sm">
                            {formatGrade(score.finalGrade)}
                          </td>
                          <td className="py-3.5 px-4 font-black text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide bg-indigo-50/5 dark:bg-slate-850/30">
                            {numberToSpanishWords(score.finalGrade, score.status)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black uppercase text-[10px]">
                            <span className={
                              score.status === 'Acreditado' ? 'text-emerald-500' :
                              score.status === 'Pendiente' ? 'text-slate-500' :
                              score.status === 'Sin derecho' ? 'text-amber-500' :
                              'text-rose-500'
                            }>
                              {score.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: CONFIGURATION & WEIGHTS RULES */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
              
              {/* Institution and Professor settings */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm space-y-4">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wide text-xs flex items-center gap-1.5 border-b border-slate-50 dark:border-slate-800 pb-3">
                  <BookOpen size={16} className="text-indigo-500" /> Datos del Acta e Institución
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Nombre de la Institución / Universidad</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-600 dark:text-white font-bold text-xs uppercase"
                      value={config.universityName}
                      onChange={(e) => handleSaveConfig({ ...config, universityName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Nombre del Profesor / Docente</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-600 dark:text-white font-bold text-xs uppercase"
                      value={config.teacherName}
                      onChange={(e) => handleSaveConfig({ ...config, teacherName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Weighting formula configuration */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm space-y-4">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wide text-xs flex items-center gap-1.5 border-b border-slate-50 dark:border-slate-800 pb-3">
                  <Calculator size={16} className="text-indigo-500" /> Método de Promedio Semestral
                </h3>

                <div className="space-y-4">
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button 
                      onClick={() => handleSaveConfig({ ...config, formulaType: 'simple' })}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                        config.formulaType === 'simple' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Promedio Simple
                    </button>
                    <button 
                      onClick={() => handleSaveConfig({ ...config, formulaType: 'weighted' })}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                        config.formulaType === 'weighted' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Ponderado
                    </button>
                  </div>

                  {config.formulaType === 'weighted' && (
                    <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl animate-in zoom-in-95 duration-150">
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Parcial 1 (%)</label>
                        <input 
                          type="number"
                          className="w-full bg-white dark:bg-slate-800 text-center font-bold py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                          value={config.weights.p1}
                          onChange={(e) => {
                            const p1 = parseInt(e.target.value) || 0;
                            handleSaveConfig({ ...config, weights: { ...config.weights, p1 } });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Parcial 2 (%)</label>
                        <input 
                          type="number"
                          className="w-full bg-white dark:bg-slate-800 text-center font-bold py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                          value={config.weights.p2}
                          onChange={(e) => {
                            const p2 = parseInt(e.target.value) || 0;
                            handleSaveConfig({ ...config, weights: { ...config.weights, p2 } });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Parcial 3 (%)</label>
                        <input 
                          type="number"
                          className="w-full bg-white dark:bg-slate-800 text-center font-bold py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
                          value={config.weights.p3}
                          onChange={(e) => {
                            const p3 = parseInt(e.target.value) || 0;
                            handleSaveConfig({ ...config, weights: { ...config.weights, p3 } });
                          }}
                        />
                      </div>
                      
                      <div className="col-span-3 text-center pt-1">
                        <span className={`text-[10px] font-black uppercase ${
                          config.weights.p1 + config.weights.p2 + config.weights.p3 === 100 
                            ? 'text-emerald-500' 
                            : 'text-rose-500 animate-pulse'
                        }`}>
                          Suma total: {config.weights.p1 + config.weights.p2 + config.weights.p3}% 
                          {config.weights.p1 + config.weights.p2 + config.weights.p3 !== 100 && ' (Debe sumar 100%)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced constraints / Rule customization */}
              <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm space-y-4 md:col-span-2">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wide text-xs flex items-center gap-1.5 border-b border-slate-50 dark:border-slate-800 pb-3">
                  <Sliders size={16} className="text-indigo-500" /> Reglas de Cierre y Redondeos Académicos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Rounding rules */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Regla de Redondeo Escolar</label>
                    <div className="space-y-2.5">
                      <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl cursor-pointer">
                        <input 
                          type="radio" 
                          name="roundingRule" 
                          checked={config.roundingRule === 'round'}
                          onChange={() => handleSaveConfig({ ...config, roundingRule: 'round' })}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white">Redondeo Tradicional (1 decimal)</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Conserva un decimal redondeando al décimo más cercano (ej. 8.56 -&gt; 8.6, 5.44 -&gt; 5.4).</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl cursor-pointer">
                        <input 
                          type="radio" 
                          name="roundingRule" 
                          checked={config.roundingRule === 'mexican'}
                          onChange={() => handleSaveConfig({ ...config, roundingRule: 'mexican' })}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white">Redondeo Institucional Mexicano</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Si la calificación es aprobatoria (&gt;= 6.0), .5 o más redondea hacia arriba, de lo contrario redondea hacia abajo (ej. 6.5 -&gt; 7, 6.4 -&gt; 6, 5.9 -&gt; 5).</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl cursor-pointer">
                        <input 
                          type="radio" 
                          name="roundingRule" 
                          checked={config.roundingRule === 'floor'}
                          onChange={() => handleSaveConfig({ ...config, roundingRule: 'floor' })}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white">Truncado / Sin Redondeo hacia arriba</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Simplemente corta los decimales sobrantes manteniendo el límite inferior exacto (ej. 7.99 -&gt; 7.9).</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Alertas & Penalizations */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-slate-400 block">Condicionantes y Penalizaciones</label>
                    
                    <div className="space-y-3">
                      <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-white">Inasistencia causa Reprobación (Sin Derecho)</p>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Si el alumno acumula menos del {config.attendanceMinRate}% de asistencia, automáticamente pierde derecho de aprobación, reportándose con estatus "S/D" y calificación de 5.0.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={config.minAttendancePass}
                          onChange={(e) => handleSaveConfig({ ...config, minAttendancePass: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                        />
                      </div>

                      {config.minAttendancePass && (
                        <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-850 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-150">
                          <span className="text-[10px] font-black uppercase text-indigo-900 dark:text-indigo-400">Umbral Mínimo Requerido (%):</span>
                          <div className="flex items-center gap-3">
                            <input 
                              type="number"
                              min="60"
                              max="100"
                              className="w-16 bg-white dark:bg-slate-800 text-center font-bold py-1.5 rounded-lg border border-slate-200 dark:border-slate-750 text-xs text-slate-800 dark:text-white focus:ring-1 focus:ring-indigo-500"
                              value={config.attendanceMinRate}
                              onChange={(e) => {
                                const attendanceMinRate = parseInt(e.target.value) || 80;
                                handleSaveConfig({ ...config, attendanceMinRate });
                              }}
                            />
                            <span className="text-xs text-slate-500 font-bold">%</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-white">Reprobar un parcial invalida el promedio</p>
                          <p className="text-[10px] text-slate-400 leading-normal">
                            Si un alumno tiene una calificación menor a 6.0 en el Parcial 1, Parcial 2 o Parcial 3, reprueba automáticamente la asignatura con promedio final máximo de 5.0.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={config.failIfAnyParcialFailed}
                          onChange={(e) => handleSaveConfig({ ...config, failIfAnyParcialFailed: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          )}
        </>
      )}

    </div>
  );
};
