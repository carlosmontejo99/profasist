import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line, 
  ReferenceLine,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  User, 
  BookOpen, 
  Award, 
  Clock, 
  Sparkles, 
  Info, 
  FileText, 
  ArrowRight,
  HelpCircle,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { Group, Student, EvaluationCategory, ParcialEvaluation, GroupEvaluations } from '../../types';
import * as Utils from '../../services/utils';

interface AcademicAnalyticsProps {
  group: Group;
  attendanceThreshold: number;
  onChangeThreshold?: (val: number) => void;
}

export const AcademicAnalytics: React.FC<AcademicAnalyticsProps> = ({ group, attendanceThreshold, onChangeThreshold }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'risk' | 'correlation' | 'evolution'>('summary');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Set default selected student if none selected
  useMemo(() => {
    if (group.students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(group.students[0].id);
    }
  }, [group.students, selectedStudentId]);

  const students = group.students || [];
  const evaluations = group.evaluations;

  // Grade evaluation calculations
  const calculateStudentCategoryAverage = (
    studentId: string, 
    category: EvaluationCategory, 
    grades: Record<string, Record<string, number>>
  ): number => {
    const studentGrades = grades[studentId] || {};
    const activities = category.activities || [];
    
    if (activities.length === 0) return 0;

    let sum = 0;
    let counted = 0;
    activities.forEach(act => {
      const val = studentGrades[act.id];
      if (val !== undefined && val !== null && !isNaN(val)) {
        sum += val;
        counted++;
      }
    });

    return counted > 0 ? sum / counted : 0;
  };

  const calculateStudentParcialGrade = (
    studentId: string, 
    parcial?: ParcialEvaluation
  ): number => {
    if (!parcial || !parcial.categories || parcial.categories.length === 0) return 0;
    const grades = parcial.grades || {};
    let weightedSum = 0;
    let sumWeights = 0;

    parcial.categories.forEach(cat => {
      const catAvg = calculateStudentCategoryAverage(studentId, cat, grades);
      weightedSum += catAvg * (cat.weight / 100);
      sumWeights += cat.weight;
    });

    if (sumWeights > 0 && Math.abs(sumWeights - 100) > 0.01) {
      let rawWeightedSum = 0;
      parcial.categories.forEach(cat => {
        const catAvg = calculateStudentCategoryAverage(studentId, cat, grades);
        rawWeightedSum += catAvg * cat.weight;
      });
      return rawWeightedSum / sumWeights;
    }

    return weightedSum;
  };

  const calculateStudentFinalAverage = (studentId: string, evals?: GroupEvaluations): number => {
    if (!evals) return 0;
    const p1 = calculateStudentParcialGrade(studentId, evals.parcial1);
    const p2 = calculateStudentParcialGrade(studentId, evals.parcial2);
    const p3 = calculateStudentParcialGrade(studentId, evals.parcial3);
    
    return (p1 + p2 + p3) / 3;
  };

  const countPendingActivities = (studentId: string, evals?: GroupEvaluations): number => {
    if (!evals) return 0;
    let count = 0;
    const parciales: ('parcial1' | 'parcial2' | 'parcial3')[] = ['parcial1', 'parcial2', 'parcial3'];
    
    parciales.forEach(pKey => {
      const parcial = evals[pKey];
      if (parcial && parcial.categories) {
        const studentGrades = parcial.grades?.[studentId] || {};
        parcial.categories.forEach(cat => {
          cat.activities.forEach(act => {
            const val = studentGrades[act.id];
            if (val === undefined || val === null || isNaN(val)) {
              count++;
            }
          });
        });
      }
    });
    return count;
  };

  const checkStudentTrend = (studentId: string, evals?: GroupEvaluations) => {
    if (!evals) return { value: 0, label: 'Estable', icon: 'stable' };
    const p1 = calculateStudentParcialGrade(studentId, evals.parcial1);
    const p2 = calculateStudentParcialGrade(studentId, evals.parcial2);
    const p3 = calculateStudentParcialGrade(studentId, evals.parcial3);

    // If P3 is graded, compare P3 vs P2 (or P3 vs P1)
    // If only P2 is graded, compare P2 vs P1
    let diff = 0;
    let isP3Graded = Object.keys(evals.parcial3.grades).length > 0;
    let isP2Graded = Object.keys(evals.parcial2.grades).length > 0;
    let isP1Graded = Object.keys(evals.parcial1.grades).length > 0;

    if (isP3Graded && isP2Graded) {
      diff = p3 - p2;
    } else if (isP2Graded && isP1Graded) {
      diff = p2 - p1;
    } else {
      diff = 0;
    }

    if (diff > 0.5) return { value: diff, label: `Mejora (+${diff.toFixed(1)})`, icon: 'up' };
    if (diff < -0.5) return { value: diff, label: `Descenso (${diff.toFixed(1)})`, icon: 'down' };
    return { value: diff, label: 'Estable', icon: 'stable' };
  };

  // Compile student data
  const studentMetrics = useMemo(() => {
    return students.map(student => {
      const attendanceStats = Utils.calculateStudentStats(group, student.id);
      const attendancePct = attendanceStats.percentage;

      let p1 = 0, p2 = 0, p3 = 0, finalGrade = 0;
      if (evaluations) {
        p1 = calculateStudentParcialGrade(student.id, evaluations.parcial1);
        p2 = calculateStudentParcialGrade(student.id, evaluations.parcial2);
        p3 = calculateStudentParcialGrade(student.id, evaluations.parcial3);
        finalGrade = (p1 + p2 + p3) / 3;
      }

      const pendingTasks = countPendingActivities(student.id, evaluations);
      const trend = checkStudentTrend(student.id, evaluations);

      // Risk Score Calculations
      let attendanceRiskPoints = 0;
      if (attendancePct < 50) attendanceRiskPoints = 40;
      else if (attendancePct < 70) attendanceRiskPoints = 30;
      else if (attendancePct < attendanceThreshold) attendanceRiskPoints = 15;

      let gradeRiskPoints = 0;
      const currentAvg = evaluations ? (
        Object.keys(evaluations.parcial2.grades).length > 0 ? (p1 + p2) / 2 :
        Object.keys(evaluations.parcial3.grades).length > 0 ? (p1 + p2 + p3) / 3 : p1
      ) : 0;

      if (currentAvg < 5.0) gradeRiskPoints = 40;
      else if (currentAvg < 6.0) gradeRiskPoints = 30;
      else if (currentAvg < 7.0) gradeRiskPoints = 15;

      let pendingRiskPoints = 0;
      if (pendingTasks >= 4) pendingRiskPoints = 15;
      else if (pendingTasks >= 2) pendingRiskPoints = 10;
      else if (pendingTasks === 1) pendingRiskPoints = 5;

      const trendRiskPoints = trend.value < -0.8 ? 5 : 0;

      const totalRiskScore = attendanceRiskPoints + gradeRiskPoints + pendingRiskPoints + trendRiskPoints;

      let riskLevel: 'bajo' | 'moderado' | 'alto' = 'bajo';
      const riskDrivers: string[] = [];

      if (attendancePct < 70) {
        riskLevel = 'alto';
        riskDrivers.push(`Faltas críticas (${attendancePct}%)`);
      } else if (attendancePct < attendanceThreshold) {
        riskLevel = 'moderado';
        riskDrivers.push(`Baja asistencia (${attendancePct}%)`);
      }

      if (currentAvg < 5.0) {
        riskLevel = 'alto';
        riskDrivers.push(`Promedio muy bajo (${currentAvg.toFixed(1)})`);
      } else if (currentAvg < 6.0) {
        riskLevel = riskLevel === 'alto' ? 'alto' : 'moderado';
        riskDrivers.push(`Promedio reprobatorio (${currentAvg.toFixed(1)})`);
      } else if (currentAvg < 7.0) {
        riskDrivers.push(`Promedio regular (${currentAvg.toFixed(1)})`);
      }

      if (pendingTasks >= 3) {
        riskLevel = riskLevel === 'alto' ? 'alto' : 'moderado';
        riskDrivers.push(`${pendingTasks} entregas faltantes`);
      } else if (pendingTasks > 0) {
        riskDrivers.push(`${pendingTasks} tarea pendiente`);
      }

      if (trend.value < -0.8) {
        riskDrivers.push(`Rendimiento a la baja (${trend.value.toFixed(1)} pts)`);
      }

      if (totalRiskScore >= 45) {
        riskLevel = 'alto';
      } else if (totalRiskScore >= 20 && riskLevel !== 'alto') {
        riskLevel = 'moderado';
      }

      // Final Prediction
      let predictedFinal = finalGrade;
      let passPossibility = 100;
      let predictionNotes = '';

      if (evaluations) {
        const isP1Graded = Object.keys(evaluations.parcial1.grades).length > 0;
        const isP2Graded = Object.keys(evaluations.parcial2.grades).length > 0;
        const isP3Graded = Object.keys(evaluations.parcial3.grades).length > 0;

        if (isP1Graded && isP2Graded && isP3Graded) {
          predictedFinal = finalGrade;
          passPossibility = finalGrade >= 6.0 ? 100 : 0;
          predictionNotes = finalGrade >= 6.0 ? 'Aprobado definitivo' : 'Reprobado definitivo';
        } else if (isP1Graded && isP2Graded) {
          // Extrapolate P3 based on P1, P2 and attendance/pending
          const recentTrend = p2 - p1;
          const baseline = (p1 + p2) / 2;
          let p3Est = baseline + (recentTrend * 0.3) * (attendancePct / 100) - (pendingTasks * 0.1);
          p3Est = Math.max(0, Math.min(10, p3Est));
          predictedFinal = (p1 + p2 + p3Est) / 3;

          const requiredP3 = 18 - p1 - p2;
          if (requiredP3 <= 0) {
            passPossibility = 100;
            predictionNotes = 'Matemáticamente aprobado (ya suma 18+ pts)';
          } else if (requiredP3 > 10) {
            passPossibility = 0;
            predictionNotes = 'Imposible aprobar (requiere > 10.0 en el Parcial 3)';
          } else {
            // Passing probability calculations
            const diffFromRequired = baseline - requiredP3;
            let prob = 50 + (diffFromRequired * 15);
            prob = prob * (attendancePct / 100); // penalize low attendance
            passPossibility = Math.max(5, Math.min(95, Math.round(prob)));
            predictionNotes = `Requiere un mínimo de ${requiredP3.toFixed(1)} en el Parcial 3 para aprobar`;
          }
        } else if (isP1Graded) {
          // Only P1 is graded, extrapolate P2 & P3
          const estRemaining = p1 * (0.3 + 0.7 * (attendancePct / 100)) - (pendingTasks * 0.15);
          const p2Est = Math.max(0, Math.min(10, estRemaining));
          const p3Est = Math.max(0, Math.min(10, estRemaining * 0.95));
          predictedFinal = (p1 + p2Est + p3Est) / 3;

          const requiredAvg = (18 - p1) / 2;
          if (requiredAvg <= 0) {
            passPossibility = 100;
            predictionNotes = 'Matemáticamente aprobado';
          } else if (requiredAvg > 10) {
            passPossibility = 0;
            predictionNotes = 'Imposible aprobar';
          } else {
            const diffFromRequired = p1 - requiredAvg;
            let prob = 50 + (diffFromRequired * 10);
            prob = prob * (attendancePct / 100);
            passPossibility = Math.max(5, Math.min(90, Math.round(prob)));
            predictionNotes = `Requiere promediar ${requiredAvg.toFixed(1)} entre Parcial 2 y 3 para aprobar`;
          }
        } else {
          // No partials graded yet, estimate strictly from attendance
          predictedFinal = 7.0 * (attendancePct / 100);
          passPossibility = attendancePct >= attendanceThreshold ? 85 : 45;
          predictionNotes = 'Aún no se registran evaluaciones. Estimación basada en asistencia.';
        }
      }

      return {
        studentId: student.id,
        name: student.name,
        rollNumber: student.rollNumber || 'S/M',
        attendancePct,
        p1,
        p2,
        p3,
        finalGrade,
        currentAvg,
        pendingTasks,
        trend,
        riskScore: totalRiskScore,
        riskLevel,
        riskDrivers,
        predictedFinal,
        passPossibility,
        predictionNotes
      };
    });
  }, [students, evaluations, group, attendanceThreshold]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (studentMetrics.length === 0) return null;

    const grades = studentMetrics.map(s => s.finalGrade);
    const total = grades.length;
    
    // Average
    const sum = grades.reduce((acc, curr) => acc + curr, 0);
    const average = sum / total;

    // Max & Min
    const max = Math.max(...grades);
    const min = Math.min(...grades);

    // Median
    const sortedGrades = [...grades].sort((a, b) => a - b);
    const mid = Math.floor(total / 2);
    const median = total % 2 !== 0 ? sortedGrades[mid] : (sortedGrades[mid - 1] + sortedGrades[mid]) / 2;

    // Standard deviation
    const variance = grades.reduce((acc, curr) => acc + Math.pow(curr - average, 2), 0) / total;
    const stdDev = Math.sqrt(variance);

    // Pass and fail rate (standard passing is 6.0)
    const passed = studentMetrics.filter(s => s.finalGrade >= 6.0).length;
    const passRate = (passed / total) * 100;
    const failRate = 100 - passRate;

    // Attendance Group Average
    const attSum = studentMetrics.reduce((acc, curr) => acc + curr.attendancePct, 0);
    const groupAttendanceAvg = attSum / total;

    // Parcial averages for evolution
    let p1Avg = 0, p2Avg = 0, p3Avg = 0;
    if (studentMetrics.length > 0) {
      p1Avg = studentMetrics.reduce((acc, curr) => acc + curr.p1, 0) / total;
      p2Avg = studentMetrics.reduce((acc, curr) => acc + curr.p2, 0) / total;
      p3Avg = studentMetrics.reduce((acc, curr) => acc + curr.p3, 0) / total;
    }

    return {
      average,
      max,
      min,
      median,
      stdDev,
      passRate,
      failRate,
      groupAttendanceAvg,
      p1Avg,
      p2Avg,
      p3Avg
    };
  }, [studentMetrics]);

  // Automated report generation (in Spanish)
  const automaticReport = useMemo(() => {
    if (!stats || studentMetrics.length === 0) return '';

    const avgStr = stats.average.toFixed(1);
    const attStr = stats.groupAttendanceAvg.toFixed(0);
    
    const highRiskCount = studentMetrics.filter(s => s.riskLevel === 'alto').length;
    const modRiskCount = studentMetrics.filter(s => s.riskLevel === 'moderado').length;

    let text = `El grupo presenta un promedio de calificaciones de **${avgStr}** y una asistencia promedio del **${attStr}%**.\n\n`;

    if (highRiskCount > 0 || modRiskCount > 0) {
      text += `Se identificaron **${highRiskCount}** alumnos en **riesgo alto (rojo)** y **${modRiskCount}** en **riesgo moderado (amarillo)**.\n\n`;
      
      // Analyze primary risk driver
      let attendanceIssues = 0;
      let gradeIssues = 0;
      let taskIssues = 0;

      studentMetrics.forEach(s => {
        if (s.riskLevel === 'alto' || s.riskLevel === 'moderado') {
          if (s.attendancePct < attendanceThreshold) attendanceIssues++;
          if (s.currentAvg < 6.0) gradeIssues++;
          if (s.pendingTasks > 1) taskIssues++;
        }
      });

      const maxIssue = Math.max(attendanceIssues, gradeIssues, taskIssues);
      let primaryCause = '';
      if (maxIssue === 0) {
        primaryCause = 'factores combinados estables';
      } else if (maxIssue === attendanceIssues) {
        primaryCause = 'la acumulación de inasistencias y faltas injustificadas, que pone en peligro su derecho a examen';
      } else if (maxIssue === gradeIssues) {
        primaryCause = 'el bajo desempeño académico reflejado en calificaciones reprobatorias en los parciales';
      } else {
        primaryCause = 'la falta de entrega o retraso en trabajos, tareas y proyectos académicos del parcial';
      }

      text += `La principal causa de riesgo identificada en este grupo es **${primaryCause}**.\n\n`;
    } else {
      text += `El grupo se encuentra en un estado óptimo de rendimiento y regularidad escolar. **No se registran alumnos en riesgo académico alto ni moderado**, lo que refleja un excelente compromiso grupal.\n\n`;
    }

    // Recommendation based on statistics
    text += `### Recomendaciones Docentes Sugeridas:\n`;
    if (stats.groupAttendanceAvg < attendanceThreshold) {
      text += `* 📅 **Alerta de Inasistencias**: Considerar establecer un pase de lista más interactivo o comunicarse directamente con los padres/coordinación de los estudiantes con asistencia menor al **${attendanceThreshold}%**.\n`;
    }
    if (stats.average < 6.5) {
      text += `* 📝 **Reforzamiento Académico**: El promedio del grupo es bajo (${avgStr}). Se aconseja programar una sesión de retroalimentación colectiva y considerar actividades de puntos extra o tutorías grupales.\n`;
    } else if (stats.passRate < 80) {
      text += `* 🎯 **Actividades Remediadoras**: El porcentaje de aprobación es regular (${stats.passRate.toFixed(0)}%). Considerar una evaluación extraordinaria remedial o dar prórrogas controladas para entregas pendientes.\n`;
    } else {
      text += `* 🚀 **Estrategias de Excelencia**: Mantener la motivación del grupo mediante proyectos avanzados o retos académicos adicionales para los estudiantes de alto rendimiento.\n`;
    }

    if (studentMetrics.some(s => s.pendingTasks > 2)) {
      text += `* 📥 **Recuperación de Portafolios**: Invitar a los estudiantes que acumulan más de 2 actividades pendientes a entregarlas, aunque sea sobre menor calificación, para estabilizar sus promedios parciales.\n`;
    }

    return text;
  }, [stats, studentMetrics, attendanceThreshold]);

  // Handle empty state if no student metrics or no evaluations
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
        <User size={48} className="text-slate-300 dark:text-slate-700 mb-3" />
        <h3 className="text-lg font-black text-slate-800 dark:text-white">Sin Alumnos en el Grupo</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
          Registra o importa alumnos en esta materia para desbloquear el panel de Analítica Académica Inteligente.
        </p>
      </div>
    );
  }

  // Segmented control navigation
  const renderNavigationTabs = () => {
    return (
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-[1.5rem] mb-6 overflow-x-auto scrollbar-none gap-0.5">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs font-black rounded-xl transition-all duration-200 uppercase shrink-0 flex items-center justify-center gap-1.5 ${
            activeTab === 'summary' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={14} /> Resumen
        </button>
        <button
          onClick={() => setActiveTab('risk')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs font-black rounded-xl transition-all duration-200 uppercase shrink-0 flex items-center justify-center gap-1.5 ${
            activeTab === 'risk' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <AlertTriangle size={14} /> Alerta de Riesgo
        </button>
        <button
          onClick={() => setActiveTab('correlation')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 text-xs font-black rounded-xl transition-all duration-200 uppercase shrink-0 flex items-center justify-center gap-1.5 ${
            activeTab === 'correlation' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp size={14} /> Asistencia vs Notas
        </button>
        <button
          onClick={() => setActiveTab('evolution')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 text-xs font-black rounded-xl transition-all duration-200 uppercase shrink-0 flex items-center justify-center gap-1.5 ${
            activeTab === 'evolution' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock size={14} /> Evolución
        </button>
      </div>
    );
  };

  const selectedStudentMetric = studentMetrics.find(sm => sm.studentId === selectedStudentId);

  // Filters student metrics for risk search
  const filteredRiskMetrics = studentMetrics.filter(sm => 
    sm.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
    sm.rollNumber.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER SECTION WITH KEY GROUP IDENTITY */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-indigo-50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-slate-900 rounded-[2rem] p-6 border border-indigo-100/30 dark:border-indigo-950/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-indigo-600 text-white rounded-full text-[9px] font-black tracking-widest uppercase">Inteligencia Analítica</span>
            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/40 dark:border-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 shrink-0">
              <Sparkles size={11} className="animate-pulse" />
              <span className="text-[9px] uppercase font-black tracking-wider">Cálculos en tiempo real</span>
            </div>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1.5 uppercase tracking-wide">Analítica Académica Inteligente</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Indicadores estadísticos del grupo, detección preventiva de deserción, predicción de resultados y correlación de asistencia con el desempeño docente.
          </p>
        </div>
      </div>

      {renderNavigationTabs()}

      {/* TAB 1: SUMMARY & GROUP REPORT */}
      {activeTab === 'summary' && stats && (
        <div className="space-y-6 animate-fade-in">
          {/* STATS OVERVIEW CARDS (Bento Grid) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm relative overflow-hidden group">
              <div className="text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider mb-1">Promedio General</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white leading-none">
                {stats.average.toFixed(1)}
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <BookOpen size={10} /> Escala de 0 a 10
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-full -mr-4 -mt-4 transition-transform duration-300 group-hover:scale-110" />
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm relative overflow-hidden group">
              <div className="text-[9px] font-black uppercase text-emerald-500 dark:text-emerald-400 tracking-wider mb-1">Tasa de Aprobación</div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {stats.passRate.toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <CheckCircle size={10} className="text-emerald-500" /> Nota {'>='} 6.0 para aprobar
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-4 -mt-4 transition-transform duration-300 group-hover:scale-110" />
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm relative overflow-hidden group">
              <div className="text-[9px] font-black uppercase text-rose-500 dark:text-rose-400 tracking-wider mb-1">Tasa de Reprobación</div>
              <div className="text-3xl font-black text-rose-600 dark:text-rose-400 leading-none">
                {stats.failRate.toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <AlertTriangle size={10} className="text-rose-500" /> Nota menor a 6.0
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full -mr-4 -mt-4 transition-transform duration-300 group-hover:scale-110" />
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm relative overflow-hidden group">
              <div className="text-[9px] font-black uppercase text-amber-500 dark:text-amber-400 tracking-wider mb-1">Asistencia Promedio</div>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400 leading-none">
                {stats.groupAttendanceAvg.toFixed(0)}%
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                <Calendar size={10} /> Umbral requerido: {attendanceThreshold}%
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full -mr-4 -mt-4 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>

          {/* CONFIGURACIÓN DEL UMBRAL DENTRO DEL DASHBOARD */}
          {onChangeThreshold && (
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                  <Calendar size={14} className="text-indigo-500" /> Ajuste de Umbral de Asistencia Requerida
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Establece el mínimo de asistencia requerido para que el alumno conserve derecho a aprobar sin alertas de inasistencia.
                </p>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-72 shrink-0">
                <input 
                  type="range" 
                  min="60" 
                  max="95" 
                  value={attendanceThreshold} 
                  onChange={(e) => onChangeThreshold(Number(e.target.value))}
                  className="flex-1 h-2 bg-indigo-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 shrink-0">{attendanceThreshold}%</span>
              </div>
            </div>
          )}

          {/* EXTENDED DESCRIPTIVE STATS PANEL & AUTO REPORT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Descriptive Statistics Card */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Award size={18} className="text-indigo-600 dark:text-indigo-400" /> Estadísticas Descriptivas
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Calificación Máxima</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl">{stats.max.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Calificación Mínima</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl">{stats.min.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800/60">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mediana Académica</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl">{stats.median.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400" title="Medida del grado de dispersión de las calificaciones con respecto al promedio">Desviación Estándar</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl flex items-center gap-1">
                    ±{stats.stdDev.toFixed(2)}
                    <span className="text-[9px] text-slate-400 font-bold" title="Una desviación baja significa que las notas son homogéneas">
                      ({stats.stdDev < 1.5 ? 'Homogéneo' : 'Disperso'})
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex gap-2.5">
                <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong>Mediana ({stats.median.toFixed(1)}):</strong> El 50% de los estudiantes tiene una calificación igual o superior a este valor.
                  <br />
                  <strong>Desviación (±{stats.stdDev.toFixed(2)}):</strong> Indica qué tan dispersas están las notas en el grupo respecto al promedio.
                </p>
              </div>
            </div>

            {/* Smart Narrated Group Report Card */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600 dark:text-indigo-400" /> Diagnóstico Automatizado del Grupo
                  </h3>
                  <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black tracking-wide uppercase">Generación Directa</span>
                </div>

                <div className="p-5 bg-slate-50/50 dark:bg-slate-850/30 rounded-2xl border border-slate-100 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-2">
                  {automaticReport.split('\n\n').map((paragraph, idx) => {
                    if (paragraph.startsWith('###')) {
                      return <h4 key={idx} className="font-black text-slate-900 dark:text-white text-xs mt-4 mb-2 uppercase tracking-wide">{paragraph.replace('###', '').trim()}</h4>;
                    }
                    // Bold support
                    const parts = paragraph.split('**');
                    return (
                      <p key={idx}>
                        {parts.map((part, i) => i % 2 !== 0 ? <strong key={i} className="font-bold text-indigo-600 dark:text-indigo-400">{part}</strong> : part)}
                      </p>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 flex items-center gap-1.5 justify-end">
                <Sparkles size={11} className="text-indigo-500 animate-pulse" /> Inteligencia Predictiva Académica basada en rendimiento actual.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETECCIÓN AUTOMÁTICA DE RIESGO */}
      {activeTab === 'risk' && (
        <div className="space-y-6 animate-fade-in">
          {/* SEARCH INPUT & SUMMARY */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-5 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar alumno por nombre o matrícula..."
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-600 dark:text-white font-bold text-xs"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Distribución:</span>
              <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                🟢 Bajo {studentMetrics.filter(m => m.riskLevel === 'bajo').length}
              </span>
              <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                🟡 Moderado {studentMetrics.filter(m => m.riskLevel === 'moderado').length}
              </span>
              <span className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                🔴 Alto {studentMetrics.filter(m => m.riskLevel === 'alto').length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Preventative Risk Assessment Table */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-rose-500" /> Monitoreo y Alerta Preventiva Académica
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Identificación proactiva basada en asistencia cumulada, promedios vigentes, retrasos y tendencias decrecientes.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-850/30 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/60">
                      <th className="py-3 px-4">Alumno</th>
                      <th className="py-3 px-4 text-center">Asistencia</th>
                      <th className="py-3 px-4 text-center">Promedio Act.</th>
                      <th className="py-3 px-4 text-center">Pendientes</th>
                      <th className="py-3 px-4">Nivel de Riesgo</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRiskMetrics.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-xs text-slate-400 font-bold">
                          Ningún alumno coincide con los términos de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filteredRiskMetrics.map(student => (
                        <tr 
                          key={student.studentId} 
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition cursor-pointer ${
                            selectedStudentId === student.studentId ? 'bg-indigo-50/25 dark:bg-indigo-950/10' : ''
                          }`}
                          onClick={() => setSelectedStudentId(student.studentId)}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-xs text-slate-900 dark:text-white">{student.name}</div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">{student.rollNumber}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`text-xs font-black ${
                              student.attendancePct < 70 ? 'text-rose-600 dark:text-rose-400' :
                              student.attendancePct < attendanceThreshold ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {student.attendancePct}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-xs">
                            <span className={`${
                              student.currentAvg < 6.0 ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-lg' :
                              student.currentAvg < 7.0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {student.currentAvg.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-xs">
                            {student.pendingTasks > 0 ? (
                              <span className="text-rose-500 bg-rose-50 dark:bg-rose-950/10 px-2 py-0.5 rounded-lg">
                                {student.pendingTasks}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              student.riskLevel === 'alto' 
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' 
                                : student.riskLevel === 'moderado' 
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' 
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                student.riskLevel === 'alto' ? 'bg-rose-600' : student.riskLevel === 'moderado' ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} />
                              Riesgo {student.riskLevel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(student.studentId);
                              }}
                              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                            >
                              Ver Predicción
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Student Predictive Summary (Objective 5) */}
            <div className="lg:col-span-4 space-y-6">
              {selectedStudentMetric ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm space-y-5 animate-fade-in">
                  <div>
                    <div className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Estudiante Seleccionado</div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base mt-0.5 truncate">{selectedStudentMetric.name}</h3>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">Matrícula: {selectedStudentMetric.rollNumber}</p>
                  </div>

                  {/* Factores de riesgo del alumno */}
                  <div className="space-y-2.5 pt-1">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Factores Diagnósticos</h4>
                    {selectedStudentMetric.riskDrivers.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-xl">
                        <CheckCircle size={14} /> Estudiante al corriente y sin incidencias
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedStudentMetric.riskDrivers.map((driver, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-850 p-2 rounded-xl border border-slate-100 dark:border-slate-800/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            {driver}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Prediction Widget */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-850 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Predicción de Calificación Final</h4>
                      <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100/30 text-amber-600 dark:text-amber-400 rounded-full text-[8px] font-black tracking-widest uppercase">Estimación Académica</span>
                    </div>

                    {/* Calculated Probable Grade */}
                    <div className="flex items-center justify-between bg-indigo-50/30 dark:bg-indigo-950/15 border border-indigo-100/30 dark:border-indigo-950/30 rounded-2xl p-4">
                      <div>
                        <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Final Estimado</div>
                        <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1 leading-none">
                          {selectedStudentMetric.predictedFinal.toFixed(1)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Probabilidad de Aprobar</div>
                        <div className={`text-2xl font-black mt-1 leading-none ${
                          selectedStudentMetric.passPossibility >= 80 ? 'text-emerald-500' :
                          selectedStudentMetric.passPossibility >= 50 ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          {selectedStudentMetric.passPossibility}%
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic leading-relaxed text-center bg-slate-50 dark:bg-slate-850 p-2.5 rounded-xl">
                      "{selectedStudentMetric.predictionNotes}"
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm text-center py-10">
                  <User size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">Selecciona un alumno de la lista para ver su pronóstico.</p>
                </div>
              )}

              {/* Guía de Factores de Riesgo */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-5 space-y-3">
                <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Info size={12} className="text-indigo-500" /> Glosario Analítico de Riesgo
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
                  * <strong>Riesgo Alto (🔴)</strong>: El alumno presenta fallas graves acumuladas (Promedio menor a 5.0 o Asistencia inferior a 70%). Exige contacto docente directo inmediato.
                  <br />
                  * <strong>Riesgo Moderado (🟡)</strong>: Alumno al límite o en deterioro reciente (Asistencia bajo el umbral, promedio regular menor a 6.0 o más de 2 trabajos sin entregar).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CORRELACIÓN ASISTENCIA VS DESEMPEÑO (Objective 3) */}
      {activeTab === 'correlation' && (
        <div className="space-y-6 animate-fade-in">
          {/* SCATTER PLOT DISPLAY */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Chart Column */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" /> Gráfico de Correlación: Asistencia vs Rendimiento Académico
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  Ubica a tus estudiantes en cuadrantes preventivos según su asistencia (X) y promedio de calificaciones (Y).
                </p>

                <div className="h-80 w-full select-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      margin={{ top: 20, right: 20, bottom: 20, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800/60" />
                      <XAxis 
                        type="number" 
                        dataKey="attendancePct" 
                        name="Asistencia" 
                        unit="%" 
                        domain={[0, 100]}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="finalGrade" 
                        name="Calificación" 
                        domain={[0, 10]}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      {/* Reference line for attendance threshold */}
                      <ReferenceLine x={attendanceThreshold} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `Límite ${attendanceThreshold}%`, fill: '#f59e0b', fontSize: 9, position: 'top', fontWeight: 'bold' }} />
                      {/* Reference line for passing grade */}
                      <ReferenceLine y={6} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Aprobación (6.0)', fill: '#ef4444', fontSize: 9, position: 'insideRight', fontWeight: 'bold' }} />
                      
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }} 
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-lg text-xs space-y-1">
                                <p className="font-black text-slate-800 dark:text-white">{data.name}</p>
                                <p className="text-slate-500 font-semibold">Asistencia: <span className="font-bold text-slate-800 dark:text-white">{data.attendancePct}%</span></p>
                                <p className="text-slate-500 font-semibold">Promedio: <span className="font-bold text-slate-800 dark:text-white">{data.finalGrade.toFixed(1)}</span></p>
                                <p className="text-[9px] text-slate-400 capitalize italic mt-1 bg-slate-50 dark:bg-slate-850 p-1 px-1.5 rounded">Riesgo: {data.riskLevel}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      <Scatter name="Estudiantes" data={studentMetrics} fill="#6366f1">
                        {studentMetrics.map((entry, index) => {
                          let color = '#10b981'; // emerald for low risk
                          if (entry.riskLevel === 'alto') color = '#ef4444'; // rose for high risk
                          else if (entry.riskLevel === 'moderado') color = '#f59e0b'; // amber for moderate risk
                          return (
                            <Cell key={`cell-${index}`} fill={color} r={6} className="cursor-pointer active:scale-125 transition-transform" />
                          );
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quadrant definitions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-850 text-center">
                <div className="p-2 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 rounded-xl">
                  <div className="text-[8px] font-black uppercase text-emerald-600 tracking-wider">🟢 Excelencia</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Asistencia {'>='} {attendanceThreshold}% y Nota {'>='} 6.0</div>
                </div>
                <div className="p-2 bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/10 rounded-xl">
                  <div className="text-[8px] font-black uppercase text-amber-600 tracking-wider">🟡 Desafío Académico</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Asistencia {'>='} {attendanceThreshold}% y Nota {'<'} 6.0</div>
                </div>
                <div className="p-2 bg-indigo-500/5 dark:bg-indigo-950/10 border border-indigo-500/10 rounded-xl">
                  <div className="text-[8px] font-black uppercase text-indigo-600 tracking-wider">🔵 Talento en Faltas</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Asistencia {'<'} {attendanceThreshold}% y Nota {'>='} 6.0</div>
                </div>
                <div className="p-2 bg-rose-500/5 dark:bg-rose-950/10 border border-rose-500/10 rounded-xl">
                  <div className="text-[8px] font-black uppercase text-rose-600 tracking-wider">🔴 Alerta Máxima</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Asistencia {'<'} {attendanceThreshold}% y Nota {'<'} 6.0</div>
                </div>
              </div>
            </div>

            {/* Quadrant Student Finder */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <HelpCircle size={18} className="text-indigo-600" /> Casos Específicos Detectados
                </h3>
                
                <div className="space-y-4">
                  {/* Case 1: Bad attendance but good grade */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-wider mb-2">
                      🔵 Faltas con Buen Rendimiento ({studentMetrics.filter(m => m.attendancePct < attendanceThreshold && m.finalGrade >= 6.0).length})
                    </h4>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {studentMetrics.filter(m => m.attendancePct < attendanceThreshold && m.finalGrade >= 6.0).length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No se detectan casos en esta categoría.</p>
                      ) : (
                        studentMetrics.filter(m => m.attendancePct < attendanceThreshold && m.finalGrade >= 6.0).map(s => (
                          <div 
                            key={s.studentId} 
                            onClick={() => { setSelectedStudentId(s.studentId); setActiveTab('risk'); }}
                            className="p-2 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/30 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex justify-between items-center hover:border-indigo-400"
                          >
                            <span className="truncate pr-2">{s.name}</span>
                            <span className="text-[9px] bg-indigo-100/50 dark:bg-indigo-950 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                              {s.attendancePct}% Asist / {s.finalGrade.toFixed(1)} Nota
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Case 2: Good attendance but bad grade */}
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-wider mb-2">
                      🟡 Alta Asistencia con Bajo Rendimiento ({studentMetrics.filter(m => m.attendancePct >= attendanceThreshold && m.finalGrade < 6.0).length})
                    </h4>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {studentMetrics.filter(m => m.attendancePct >= attendanceThreshold && m.finalGrade < 6.0).length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No se detectan casos en esta categoría.</p>
                      ) : (
                        studentMetrics.filter(m => m.attendancePct >= attendanceThreshold && m.finalGrade < 6.0).map(s => (
                          <div 
                            key={s.studentId} 
                            onClick={() => { setSelectedStudentId(s.studentId); setActiveTab('risk'); }}
                            className="p-2 bg-amber-50/40 dark:bg-amber-950/10 rounded-xl border border-amber-100/30 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex justify-between items-center hover:border-amber-400"
                          >
                            <span className="truncate pr-2">{s.name}</span>
                            <span className="text-[9px] bg-amber-100/50 dark:bg-amber-950 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 whitespace-nowrap">
                              {s.attendancePct}% Asist / {s.finalGrade.toFixed(1)} Nota
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/60 rounded-xl flex gap-2">
                <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Haz clic sobre cualquier alumno listado en estas subsecciones para acceder a su expediente analítico de riesgo preventivo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EVOLUCIÓN POR PARCIAL (Objective 4) */}
      {activeTab === 'evolution' && stats && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Group Evolution Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" /> Trayectoria Histórica del Grupo
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Evolución lineal del promedio general acumulado del grupo a través de los parciales y la nota final.
              </p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: 'Parcial 1', Promedio: stats.p1Avg },
                      { name: 'Parcial 2', Promedio: stats.p2Avg },
                      { name: 'Parcial 3', Promedio: stats.p3Avg },
                      { name: 'Final', Promedio: stats.average }
                    ]}
                    margin={{ top: 10, right: 20, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800/60" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[0, 10]}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-lg text-xs font-bold">
                              <p className="text-slate-400 font-semibold mb-0.5">{payload[0].payload.name}</p>
                              <p className="text-indigo-600 dark:text-indigo-400">Promedio: {payload[0].value.toFixed(2)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="Promedio" 
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Parcial metric boxes */}
              <div className="grid grid-cols-4 gap-3 mt-4 text-center">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                  <div className="text-[8px] font-black text-slate-400 uppercase">Parcial 1</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{stats.p1Avg.toFixed(1)}</div>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                  <div className="text-[8px] font-black text-slate-400 uppercase">Parcial 2</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{stats.p2Avg.toFixed(1)}</div>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl">
                  <div className="text-[8px] font-black text-slate-400 uppercase">Parcial 3</div>
                  <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{stats.p3Avg.toFixed(1)}</div>
                </div>
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100/20">
                  <div className="text-[8px] font-black text-indigo-500 uppercase">Final</div>
                  <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.average.toFixed(1)}</div>
                </div>
              </div>
            </div>

            {/* Individual Student Evolution Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <User size={18} className="text-indigo-600 dark:text-indigo-400" /> Trayectoria por Alumno
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Compara el avance de un estudiante particular contra el promedio del grupo.
                  </p>
                </div>
                
                {/* Student Selector */}
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-indigo-500"
                >
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name.substring(0, 20)}{student.name.length > 20 ? '...' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudentMetric ? (
                <div className="space-y-4">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[
                          { name: 'Parcial 1', Alumno: selectedStudentMetric.p1, Grupo: stats.p1Avg },
                          { name: 'Parcial 2', Alumno: selectedStudentMetric.p2, Grupo: stats.p2Avg },
                          { name: 'Parcial 3', Alumno: selectedStudentMetric.p3, Grupo: stats.p3Avg },
                          { name: 'Final', Alumno: selectedStudentMetric.finalGrade, Grupo: stats.average }
                        ]}
                        margin={{ top: 10, right: 20, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800/60" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          domain={[0, 10]}
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-2.5 rounded-2xl shadow-lg text-xs space-y-1">
                                  <p className="text-slate-400 font-bold mb-0.5">{payload[0].payload.name}</p>
                                  <p className="text-indigo-600 dark:text-indigo-400 font-bold">Estudiante: {payload[0].value.toFixed(1)}</p>
                                  <p className="text-slate-400 font-semibold">Grupo Prom.: {payload[1].value.toFixed(1)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 'bold', paddingTop: 10 }} />
                        <Line 
                          type="monotone" 
                          dataKey="Alumno" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#10b981', strokeWidth: 1.5, stroke: '#ffffff' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Grupo" 
                          stroke="#94a3b8" 
                          strokeDasharray="4 4"
                          strokeWidth={2} 
                          dot={{ r: 3, fill: '#94a3b8' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Comparisons card */}
                  <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-850/50 rounded-2xl border border-slate-100 dark:border-slate-800/40 justify-around">
                    <div className="text-center">
                      <span className="text-[8px] font-black uppercase text-slate-400">Promedio Alumno</span>
                      <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                        {selectedStudentMetric.finalGrade.toFixed(1)}
                      </div>
                    </div>
                    
                    <div className="w-px bg-slate-200 dark:bg-slate-850" />

                    <div className="text-center">
                      <span className="text-[8px] font-black uppercase text-slate-400">Diferencia de Grupo</span>
                      <div className={`text-lg font-black mt-0.5 ${
                        (selectedStudentMetric.finalGrade - stats.average) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {(selectedStudentMetric.finalGrade - stats.average) >= 0 ? '+' : ''}
                        {(selectedStudentMetric.finalGrade - stats.average).toFixed(1)} pts
                      </div>
                    </div>

                    <div className="w-px bg-slate-200 dark:bg-slate-850" />

                    <div className="text-center">
                      <span className="text-[8px] font-black uppercase text-slate-400">Tendencia Reciente</span>
                      <div className={`text-xs font-black mt-1 px-2.5 py-0.5 rounded-lg flex items-center gap-1 leading-normal ${
                        selectedStudentMetric.trend.icon === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' :
                        selectedStudentMetric.trend.icon === 'down' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedStudentMetric.trend.icon === 'up' && <TrendingUp size={12} />}
                        {selectedStudentMetric.trend.icon === 'down' && <TrendingDown size={12} />}
                        {selectedStudentMetric.trend.label}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Ningún alumno seleccionado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
