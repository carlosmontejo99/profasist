import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit3, Save, FileSpreadsheet, Percent, 
  AlertCircle, CheckCircle2, Calculator, Info, Settings, HelpCircle, X,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Edit2, Cloud, Check, ArrowUp, ArrowDown,
  Printer, Shuffle, Clock
} from 'lucide-react';
import { Group, Student, GroupEvaluations, ParcialEvaluation, EvaluationCategory, Activity } from '../../types';
import * as Storage from '../../services/storage';
import {
  calculateCategoryScore,
  calculateParcialScore,
  calculateFinalScore,
  resolveGradingPolicy,
} from '../../services/grading';
import { exportInstitutionalWorkbook } from '../../services/institutionalExport';

interface EvaluationSectionProps {
  group: Group;
  onSaveGroup: (updatedGroup: Group) => void;
  onNotification: (msg: string) => void;
}

// Default system initializer helper
export const getInitialEvaluations = (students: Student[]): GroupEvaluations => {
  // Prepopulate standard default structure matching user prompt
  return {
    parcial1: {
      categories: [
        { id: 'cat_tareas', name: 'Tareas', weight: 20, activities: [{ id: 'act_t1', name: 'Sobreexpresion de enzimas p12y13' }] },
        { id: 'cat_resumenes', name: 'Resúmenes', weight: 20, activities: [{ id: 'act_r1', name: 'Resumen P10y11' }, { id: 'act_r2', name: 'Resumen P14y15' }, { id: 'act_r3', name: 'Resumen P16 (basado en poster)' }] },
        { id: 'cat_reportes', name: 'Reportes Lab', weight: 20, activities: [{ id: 'act_l1', name: 'Reporte P10y11' }, { id: 'act_l2', name: 'Reporte P14y15' }, { id: 'act_l3', name: 'Reporte P16' }] },
        { id: 'cat_bitacora', name: 'Bitácora', weight: 40, activities: [{ id: 'act_b1', name: 'Bitácora' }] }
      ],
      grades: getPrepopulatedGrades(students)
    },
    parcial2: {
      categories: [
        { id: 'cat_tareas', name: 'Tareas', weight: 20, activities: [] },
        { id: 'cat_resumenes', name: 'Resúmenes', weight: 20, activities: [] },
        { id: 'cat_reportes', name: 'Reportes Lab', weight: 20, activities: [] },
        { id: 'cat_bitacora', name: 'Bitácora', weight: 40, activities: [] }
      ],
      grades: {}
    },
    parcial3: {
      categories: [
        { id: 'cat_tareas', name: 'Tareas', weight: 20, activities: [] },
        { id: 'cat_resumenes', name: 'Resúmenes', weight: 20, activities: [] },
        { id: 'cat_reportes', name: 'Reportes Lab', weight: 20, activities: [] },
        { id: 'cat_bitacora', name: 'Bitácora', weight: 40, activities: [] }
      ],
      grades: {}
    }
  };
};

// Grades are never inferred from a student's name. New and imported students
// start without grades; existing grades come only from persisted group data.
const getPrepopulatedGrades = (students: Student[]): Record<string, Record<string, number>> => {
  void students;
  return {};
};

export const EvaluationSection: React.FC<EvaluationSectionProps> = ({ group, onSaveGroup, onNotification }) => {
  const [activeTab, setActiveTab] = useState<'p1' | 'p2' | 'p3' | 'final'>('p1');
  const [evaluations, setEvaluations] = useState<GroupEvaluations>(() => {
    return group.evaluations || getInitialEvaluations(group.students || []);
  });
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Modals / Editors state
  const [editingCategory, setEditingCategory] = useState<EvaluationCategory | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catWeightInput, setCatWeightInput] = useState(20);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);

  const [newActivityName, setNewActivityName] = useState('');
  const [activeAddingActivityCatId, setActiveAddingActivityCatId] = useState<string | null>(null);

  // Activity Edit state
  const [editingActivity, setEditingActivity] = useState<{ catId: string; act: Activity } | null>(null);
  const [isActModalOpen, setIsActModalOpen] = useState(false);
  const [actNameInput, setActNameInput] = useState('');

  // Custom Confirm Dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Sync evaluations state when group changes
  useEffect(() => {
    if (group.evaluations) {
      setEvaluations(group.evaluations);
    } else {
      const initial = getInitialEvaluations(group.students || []);
      setEvaluations(initial);
      onSaveGroup({
        ...group,
        evaluations: initial
      });
    }
  }, [group.id]);

  // Active Parcial data mapping
  const getActiveParcialKey = (): 'parcial1' | 'parcial2' | 'parcial3' => {
    if (activeTab === 'p2') return 'parcial2';
    if (activeTab === 'p3') return 'parcial3';
    return 'parcial1';
  };

  const activeParcialKey = getActiveParcialKey();
  const currentParcial: ParcialEvaluation = (evaluations && evaluations[activeParcialKey]) || {
    categories: [],
    grades: {}
  };

  // Flat list of all activities in the current parcial for keyboard navigation mapping
  const allActivities = (currentParcial && currentParcial.categories) 
    ? currentParcial.categories.flatMap(c => c.activities || []) 
    : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sIdx: number, aIdx: number) => {
    const totalRows = group.students.length;
    const totalCols = allActivities.length;

    let nextRow = sIdx;
    let nextCol = aIdx;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = Math.min(sIdx + 1, totalRows - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = Math.max(sIdx - 1, 0);
    } else if (e.key === 'ArrowRight') {
      nextCol = Math.min(aIdx + 1, totalCols - 1);
    } else if (e.key === 'ArrowLeft') {
      nextCol = Math.max(aIdx - 1, 0);
    } else if (e.key === 'Tab') {
      // Custom Tab/Shift-Tab grid navigation to emulate professional spreadsheets
      if (e.shiftKey) {
        if (aIdx === 0) {
          if (sIdx > 0) {
            e.preventDefault();
            nextRow = sIdx - 1;
            nextCol = totalCols - 1;
          }
        } else {
          e.preventDefault();
          nextCol = aIdx - 1;
        }
      } else {
        if (aIdx === totalCols - 1) {
          if (sIdx < totalRows - 1) {
            e.preventDefault();
            nextRow = sIdx + 1;
            nextCol = 0;
          }
        } else {
          e.preventDefault();
          nextCol = aIdx + 1;
        }
      }
    } else {
      return;
    }

    if (nextRow !== sIdx || nextCol !== aIdx) {
      const nextInput = document.getElementById(`grade-input-${nextRow}-${nextCol}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
        nextInput.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startStudentIdx: number, startActivityIdx: number) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    // Split into rows and clean any empty trailing lines
    const rows = clipboardData.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (rows.length === 0) return;

    const updated = { ...evaluations };
    const currentGrades = { ...updated[activeParcialKey].grades };
    let pastedAny = false;
    let outOfRangeWarn = false;

    rows.forEach((rowText, rOffset) => {
      const studentIdx = startStudentIdx + rOffset;
      if (studentIdx >= group.students.length) return;
      const studentId = group.students[studentIdx].id;

      // Handle Excel / Sheets tab separation or comma/semicolon fallback
      const cols = rowText.split(/\t/);
      cols.forEach((colText, cOffset) => {
        const actIdx = startActivityIdx + cOffset;
        if (actIdx >= allActivities.length) return;
        const actId = allActivities[actIdx].id;

        const valStr = colText.trim().replace(',', '.'); // standardize decimal separator
        if (valStr === '') {
          if (currentGrades[studentId]) {
            delete currentGrades[studentId][actId];
            pastedAny = true;
          }
          return;
        }

        let val = parseFloat(valStr);
        if (!isNaN(val)) {
          if (val < 0 || val > 10) {
            outOfRangeWarn = true;
            // Clamp value within bounds
            val = Math.max(0, Math.min(10, val));
          }
          val = Math.round(val * 10) / 10;

          if (!currentGrades[studentId]) {
            currentGrades[studentId] = {};
          }
          currentGrades[studentId][actId] = val;
          pastedAny = true;
        }
      });
    });

    if (pastedAny) {
      updated[activeParcialKey].grades = currentGrades;
      persistChanges(updated);
      if (outOfRangeWarn) {
        onNotification("⚠️ Se pegaron notas, pero algunas se limitaron al rango de 0.0 a 10.0.");
      } else {
        onNotification("📋 Rango de calificaciones pegado correctamente.");
      }
    }
  };

  // Weight Calculation check
  const totalWeight = currentParcial.categories.reduce((acc, cat) => acc + cat.weight, 0);

  // Helper: Save current state to main app
  const persistChanges = (newEvaluations: GroupEvaluations) => {
    setEvaluations(newEvaluations);
    onSaveGroup({
      ...group,
      evaluations: newEvaluations
    });
  };

  // Grade calculation logic — delegated to the single engine in services/grading.ts
  const gradingPolicy = resolveGradingPolicy(group);
  const calcGroup = { ...group, evaluations };
  const getStudentFinalScore = (studentId: string) =>
    calculateFinalScore(calcGroup, studentId, gradingPolicy);
  const getParcialScore = (studentId: string, parcial: ParcialEvaluation) =>
    calculateParcialScore(studentId, parcial, gradingPolicy);

  const getParcialClassAverage = (parcial: ParcialEvaluation): number | null => {
    const values = group.students
      .map(student => getParcialScore(student.id, parcial).value)
      .filter((value): value is number => value !== null);
    if (values.length === 0) return null;
    return values.reduce((total, value) => total + value, 0) / values.length;
  };

  const hasStudentGrades = (studentId: string, parcial: ParcialEvaluation): boolean => {
    const studentGrades = parcial.grades[studentId];
    if (!studentGrades) return false;
    return parcial.categories.some(cat =>
      cat.activities.some(act => studentGrades[act.id] !== undefined && !isNaN(studentGrades[act.id]))
    );
  };

  const calculateStudentCategoryAverage = (
    studentId: string,
    category: EvaluationCategory,
    grades: Record<string, Record<string, number>>
  ): number => {
    return calculateCategoryScore(studentId, category, grades).value ?? 0;
  };

  const hasCategoryGrades = (studentId: string, category: EvaluationCategory, grades: Record<string, Record<string, number>>): boolean => {
    const studentGrades = grades[studentId];
    if (!studentGrades) return false;
    return category.activities.some(act => studentGrades[act.id] !== undefined && !isNaN(studentGrades[act.id]));
  };

  const calculateStudentParcialGrade = (
    studentId: string,
    parcial: ParcialEvaluation
  ): number => {
    return getParcialScore(studentId, parcial).value ?? 0;
  };

  // Handlers for Grades
  const handleGradeChange = (studentId: string, activityId: string, valueStr: string) => {
    let val = parseFloat(valueStr);
    if (valueStr === '') {
      // Delete grade
      const updated = { ...evaluations };
      if (updated[activeParcialKey].grades[studentId]) {
        delete updated[activeParcialKey].grades[studentId][activityId];
        persistChanges(updated);
      }
      return;
    }
    
    if (isNaN(val)) return;
    if (val < 0) val = 0;
    if (val > 10) val = 10;

    // Apply decimal precision (e.g. 1 decimal)
    val = Math.round(val * 10) / 10;

    const updated = { ...evaluations };
    if (!updated[activeParcialKey].grades[studentId]) {
      updated[activeParcialKey].grades[studentId] = {};
    }
    updated[activeParcialKey].grades[studentId][activityId] = val;
    persistChanges(updated);
  };

  const handleFillColumn = (activityId: string, score: number | null) => {
    const updated = { ...evaluations };
    const currentGrades = { ...updated[activeParcialKey].grades };
    
    group.students.forEach(st => {
      if (!currentGrades[st.id]) currentGrades[st.id] = {};
      if (score === null) {
        delete currentGrades[st.id][activityId];
      } else {
        currentGrades[st.id][activityId] = score;
      }
    });

    updated[activeParcialKey].grades = currentGrades;
    persistChanges(updated);
    if (score === null) {
      onNotification("Columna de calificaciones borrada.");
    } else {
      onNotification(`Columna rellenada con nota ${score}.0 a todos los alumnos.`);
    }
  };

  // Category CRUD
  const handleOpenEditCategory = (cat: EvaluationCategory) => {
    setEditingCategory(cat);
    setCatNameInput(cat.name);
    setCatWeightInput(cat.weight);
    setIsAddingNewCat(false);
    setIsCatModalOpen(true);
  };

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatNameInput('');
    setCatWeightInput(10);
    setIsAddingNewCat(true);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!catNameInput.trim()) {
      onNotification("El nombre de la categoría es obligatorio.");
      return;
    }
    const weight = parseInt(catWeightInput as any) || 0;
    
    const updated = { ...evaluations };
    if (isAddingNewCat) {
      const newCat: EvaluationCategory = {
        id: `cat_${Date.now()}`,
        name: catNameInput.trim(),
        weight: weight,
        activities: []
      };
      updated[activeParcialKey].categories.push(newCat);
      onNotification(`Categoría "${newCat.name}" agregada.`);
    } else if (editingCategory) {
      const idx = updated[activeParcialKey].categories.findIndex(c => c.id === editingCategory.id);
      if (idx !== -1) {
        updated[activeParcialKey].categories[idx] = {
          ...updated[activeParcialKey].categories[idx],
          name: catNameInput.trim(),
          weight: weight
        };
        onNotification(`Categoría actualizada.`);
      }
    }

    setIsCatModalOpen(false);
    persistChanges(updated);
  };

  const handleDeleteCategory = (catId: string) => {
    triggerConfirm(
      "¿Eliminar Categoría?",
      "¿Estás seguro de que deseas eliminar esta categoría? Se borrarán todos los sub-trabajos y calificaciones asociadas en este parcial de forma irreversible.",
      () => {
        const updated = { ...evaluations };
        const category = updated[activeParcialKey].categories.find(c => c.id === catId);
        if (category) {
          const actIds = category.activities.map(a => a.id);
          // Clean up grades for all activities in this category
          Object.keys(updated[activeParcialKey].grades).forEach(stId => {
            if (updated[activeParcialKey].grades[stId]) {
              actIds.forEach(actId => {
                delete updated[activeParcialKey].grades[stId][actId];
              });
            }
          });
        }
        updated[activeParcialKey].categories = updated[activeParcialKey].categories.filter(c => c.id !== catId);
        setIsCatModalOpen(false);
        persistChanges(updated);
        onNotification("Categoría eliminada.");
      }
    );
  };

  const handleReorderCategory = (catId: string, direction: 'up' | 'down') => {
    const updated = { ...evaluations };
    const categories = [...updated[activeParcialKey].categories];
    const idx = categories.findIndex(c => c.id === catId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      const temp = categories[idx];
      categories[idx] = categories[idx - 1];
      categories[idx - 1] = temp;
    } else if (direction === 'down' && idx < categories.length - 1) {
      const temp = categories[idx];
      categories[idx] = categories[idx + 1];
      categories[idx + 1] = temp;
    } else {
      return;
    }

    updated[activeParcialKey].categories = categories;
    persistChanges(updated);
    onNotification("Categorías reordenadas.");
  };

  // Activity CRUD
  const handleAddActivity = (catId: string) => {
    if (!newActivityName.trim()) {
      onNotification("Especifica un nombre para la actividad.");
      return;
    }

    const updated = { ...evaluations };
    const catIdx = updated[activeParcialKey].categories.findIndex(c => c.id === catId);
    if (catIdx !== -1) {
      const newAct: Activity = {
        id: `act_${Date.now()}`,
        name: newActivityName.trim()
      };
      updated[activeParcialKey].categories[catIdx].activities.push(newAct);
      setNewActivityName('');
      setActiveAddingActivityCatId(null);
      persistChanges(updated);
      onNotification(`Actividad "${newAct.name}" agregada.`);
    }
  };

  const handleOpenEditActivity = (catId: string, act: Activity) => {
    setEditingActivity({ catId, act });
    setActNameInput(act.name);
    setIsActModalOpen(true);
  };

  const handleSaveActivity = () => {
    if (!actNameInput.trim()) {
      onNotification("El nombre de la actividad es obligatorio.");
      return;
    }
    if (!editingActivity) return;

    const updated = { ...evaluations };
    const catIdx = updated[activeParcialKey].categories.findIndex(c => c.id === editingActivity.catId);
    if (catIdx !== -1) {
      const actIdx = updated[activeParcialKey].categories[catIdx].activities.findIndex(a => a.id === editingActivity.act.id);
      if (actIdx !== -1) {
        updated[activeParcialKey].categories[catIdx].activities[actIdx].name = actNameInput.trim();
        onNotification(`Actividad actualizada con éxito.`);
        persistChanges(updated);
      }
    }
    setIsActModalOpen(false);
    setEditingActivity(null);
  };

  const handleDuplicateActivity = (catId: string, act: Activity) => {
    const updated = { ...evaluations };
    const catIdx = updated[activeParcialKey].categories.findIndex(c => c.id === catId);
    if (catIdx !== -1) {
      const newActId = `act_${Date.now()}`;
      const duplicatedAct: Activity = {
        id: newActId,
        name: `${act.name} (Copia)`
      };
      
      const activities = updated[activeParcialKey].categories[catIdx].activities;
      const actIdx = activities.findIndex(a => a.id === act.id);
      if (actIdx !== -1) {
        activities.splice(actIdx + 1, 0, duplicatedAct);
      } else {
        activities.push(duplicatedAct);
      }

      // Copy grades
      Object.keys(updated[activeParcialKey].grades).forEach(stId => {
        const score = updated[activeParcialKey].grades[stId]?.[act.id];
        if (score !== undefined) {
          if (!updated[activeParcialKey].grades[stId]) {
            updated[activeParcialKey].grades[stId] = {};
          }
          updated[activeParcialKey].grades[stId][newActId] = score;
        }
      });

      persistChanges(updated);
      onNotification(`Actividad "${act.name}" duplicada con éxito.`);
    }
  };

  const handleReorderActivity = (catId: string, actId: string, direction: 'prev' | 'next') => {
    const updated = { ...evaluations };
    const catIdx = updated[activeParcialKey].categories.findIndex(c => c.id === catId);
    if (catIdx === -1) return;

    const activities = [...updated[activeParcialKey].categories[catIdx].activities];
    const index = activities.findIndex(a => a.id === actId);
    if (index === -1) return;

    if (direction === 'prev' && index > 0) {
      const temp = activities[index];
      activities[index] = activities[index - 1];
      activities[index - 1] = temp;
    } else if (direction === 'next' && index < activities.length - 1) {
      const temp = activities[index];
      activities[index] = activities[index + 1];
      activities[index + 1] = temp;
    } else {
      return;
    }

    updated[activeParcialKey].categories[catIdx].activities = activities;
    persistChanges(updated);
    onNotification("Actividades reordenadas.");
  };

  const handleDeleteActivity = (catId: string, actId: string) => {
    triggerConfirm(
      "¿Eliminar Actividad?",
      "¿Estás seguro de que deseas eliminar esta actividad? Se perderán las notas registradas en esta columna de forma irreversible.",
      () => {
        const updated = { ...evaluations };
        const catIdx = updated[activeParcialKey].categories.findIndex(c => c.id === catId);
        if (catIdx !== -1) {
          updated[activeParcialKey].categories[catIdx].activities = 
            updated[activeParcialKey].categories[catIdx].activities.filter(a => a.id !== actId);
          
          // Clean up grades
          Object.keys(updated[activeParcialKey].grades).forEach(stId => {
            if (updated[activeParcialKey].grades[stId]) {
              delete updated[activeParcialKey].grades[stId][actId];
            }
          });

          persistChanges(updated);
          onNotification("Actividad eliminada.");
        }
      }
    );
  };

  // Institutional XLSX export: one workbook with four official sheets.
  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const settings = Storage.loadData().settings;
      await exportInstitutionalWorkbook(group, settings);
      onNotification(`Acta oficial de 4 pestañas generada para ${group.name}.`);
    } catch (error) {
      console.error('No se pudo generar el acta institucional', error);
      onNotification('No se pudo generar el acta. Revisa el almacenamiento del dispositivo.');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredStudents = (group.students || []).filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    (student.rollNumber && student.rollNumber.toLowerCase().includes(studentSearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* HEADER BAR WITH BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Calculator size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white leading-tight">Sistema de Evaluación</h3>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mt-0.5">Control de Notas y Actividades</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleExportToExcel}
            disabled={isExporting}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold rounded-2xl text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-900/40 shadow-xs"
            title="Exportar acta institucional de 4 pestañas (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Generando...' : 'Acta Oficial'}</span>
          </button>

          <button 
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/40 text-sky-600 dark:text-sky-400 font-bold rounded-2xl text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-sky-100 dark:border-sky-900/40 shadow-xs"
            title="Imprimir acta o Guardar en PDF"
          >
            <Printer size={15} />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* PARCIAL SUB-NAVBAR */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shrink-0">
        <button 
          onClick={() => setActiveTab('p1')}
          className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'p1' 
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Parcial 1
        </button>
        <button 
          onClick={() => setActiveTab('p2')}
          className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'p2' 
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Parcial 2
        </button>
        <button 
          onClick={() => setActiveTab('p3')}
          className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'p3' 
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Parcial 3
        </button>
        <button 
          onClick={() => setActiveTab('final')}
          className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'final' 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Promedio Final
        </button>
      </div>

      {/* STUDENT LENGTH CHECK */}
      {group.students.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center shadow-sm">
          <p className="text-slate-500 text-sm font-bold">No hay alumnos inscritos en esta materia.</p>
          <p className="text-xs text-slate-400 mt-1">Registra alumnos en la sección de Alumnos antes de evaluar.</p>
        </div>
      ) : activeTab === 'final' ? (
        
        /* PROMEDIO FINAL SUMMARY TAB */
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-850">
            <h4 className="font-black text-sm text-slate-950 dark:text-white uppercase tracking-wider">Acta de Calificaciones Semestral</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Promedio calculado de los 3 parciales con redondeo automático.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-750">
                  <th className="py-4 px-6 font-black uppercase tracking-wider min-w-[200px]">Alumno</th>
                  <th className="py-4 px-4 font-black uppercase tracking-wider text-center">Parcial 1</th>
                  <th className="py-4 px-4 font-black uppercase tracking-wider text-center">Parcial 2</th>
                  <th className="py-4 px-4 font-black uppercase tracking-wider text-center">Parcial 3</th>
                  <th className="py-4 px-6 font-black uppercase tracking-wider text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">Promedio Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {group.students.map(student => {
                  const score = getStudentFinalScore(student.id);
                  const p1 = score.p1;
                  const p2 = score.p2;
                  const p3 = score.p3;
                  const finalAvg = score.final;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">{student.name}</td>
                      <td className="py-4 px-4 text-center">{p1 === null ? '—' : p1.toFixed(1)}</td>
                      <td className="py-4 px-4 text-center">{p2 === null ? '—' : p2.toFixed(1)}</td>
                      <td className="py-4 px-4 text-center">{p3 === null ? '—' : p3.toFixed(1)}</td>
                      <td className={`py-4 px-6 text-right font-black text-sm bg-indigo-50/10 dark:bg-indigo-950/5 ${
                        finalAvg === null ? 'text-slate-400 dark:text-slate-500' :
                        finalAvg >= 8.0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : finalAvg >= 7.0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {finalAvg === null ? 'Pendiente' : finalAvg.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (

        /* INTERACTIVE PARCIAL GRID TAB */
        <div className="space-y-6">
          
          {/* CATEGORIES SETTINGS & WEIGHTS */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-50 dark:border-slate-800/60">
              <div>
                <h4 className="font-black text-sm text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Percent size={16} className="text-indigo-500" /> Esquema de Evaluación
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configura las categorías y el porcentaje que vale cada una en este parcial.</p>
              </div>
              
              <button 
                onClick={handleOpenAddCategory}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-all active:scale-95"
              >
                <Plus size={14} /> Nueva Categoría
              </button>
            </div>

            {/* Weights warnings */}
            <div className="flex flex-wrap items-center gap-3">
              {currentParcial.categories.map((cat, idx) => (
                <div 
                  key={cat.id} 
                  onClick={() => handleOpenEditCategory(cat)}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-500 transition cursor-pointer flex items-center gap-2"
                  title="Haz clic para editar esta categoría"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                  <span className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-indigo-50/50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded">
                    {cat.weight}%
                  </span>
                  
                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-slate-700 pl-1.5 opacity-60 hover:opacity-100 transition">
                    <button
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderCategory(cat.id, 'up');
                      }}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:pointer-events-none transition"
                      title="Mover arriba"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      disabled={idx === currentParcial.categories.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderCategory(cat.id, 'down');
                      }}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:pointer-events-none transition"
                      title="Mover abajo"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Warnings indicator if totalWeight !== 100 */}
            {totalWeight !== 100 ? (
              <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-start gap-2.5">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                  <strong>Atención:</strong> Tus categorías suman <strong>{totalWeight}%</strong>. El promedio se reajustará de manera proporcional al 100% automáticamente. Te sugerimos adaptarlas para que sumen exactamente 100%.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100/40 dark:border-emerald-900/10 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500" size={14} />
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">¡Esquema perfectamente balanceado al 100%!</span>
              </div>
            )}
          </div>

          {/* COLUMNS CONFIGURATION (ACTIVITIES) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="font-black text-sm text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              📚 Trabajos y Actividades por Categoría
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Agrega columnas de actividades para calificar a tus alumnos. Puedes añadir cuantas quieras, el promedio de cada categoría se calculará automáticamente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentParcial.categories.map(cat => (
                <div key={cat.id} className="p-5 bg-slate-50/50 dark:bg-slate-850/60 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">{cat.name} ({cat.weight}%)</span>
                    
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        title="Editar o Eliminar Categoría"
                      >
                        <Settings size={14} />
                      </button>
                      {activeAddingActivityCatId !== cat.id && (
                        <button 
                          onClick={() => setActiveAddingActivityCatId(cat.id)}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                          title="Agregar Actividad"
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline adding form */}
                  {activeAddingActivityCatId === cat.id && (
                    <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-750">
                      <input 
                        type="text"
                        className="flex-1 bg-transparent border-none text-xs focus:ring-0 p-0 dark:text-white font-semibold"
                        placeholder="Nombre de la actividad..."
                        value={newActivityName}
                        onChange={(e) => setNewActivityName(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={() => handleAddActivity(cat.id)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                      >
                        Añadir
                      </button>
                      <button 
                        onClick={() => { setActiveAddingActivityCatId(null); setNewActivityName(''); }}
                        className="text-slate-300 hover:text-slate-500 transition"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* List of sub activities */}
                  {cat.activities.length === 0 ? (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No hay actividades aún. Haz clic en el botón "+" para crear la primera.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {cat.activities.map((act, actIdx) => (
                        <div key={act.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-750 rounded-lg group hover:border-indigo-300 dark:hover:border-indigo-950/40 transition">
                          <span 
                            onClick={() => handleOpenEditActivity(cat.id, act)}
                            className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[90px] cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" 
                            title={`${act.name} (Clic para editar)`}
                          >
                            {act.name}
                          </span>
                          
                          {/* Reordering mini controls */}
                          <div className="flex items-center pl-0.5 border-l border-slate-100 dark:border-slate-800">
                            <button
                              disabled={actIdx === 0}
                              onClick={() => handleReorderActivity(cat.id, act.id, 'prev')}
                              className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-20 transition"
                              title="Mover a la izquierda"
                            >
                              <ChevronLeft size={10} />
                            </button>
                            <button
                              disabled={actIdx === cat.activities.length - 1}
                              onClick={() => handleReorderActivity(cat.id, act.id, 'next')}
                              className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-20 transition"
                              title="Mover a la derecha"
                            >
                              <ChevronRight size={10} />
                            </button>
                          </div>

                          {/* Duplicate activity */}
                          <button
                            onClick={() => handleDuplicateActivity(cat.id, act)}
                            className="p-0.5 text-slate-300 hover:text-emerald-500 transition"
                            title="Duplicar actividad"
                          >
                            <Copy size={9} />
                          </button>

                          {/* Delete activity */}
                          <button 
                            onClick={() => handleDeleteActivity(cat.id, act.id)}
                            className="p-0.5 text-slate-300 hover:text-rose-500 transition"
                            title="Eliminar actividad"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* INTERACTIVE SPREADSHEET TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-black text-sm text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  Matriz Interactiva de Notas
                  {(() => {
                    const classAverage = getParcialClassAverage(currentParcial);
                    if (classAverage === null) return null;
                    return (
                      <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 rounded-full text-[10px] font-black uppercase">
                        Promedio Grupal: {classAverage.toFixed(1)}
                      </span>
                    );
                  })()}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Escribe las notas directamente en cada casilla (0 al 10). Se promediará en tiempo real.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Buscar alumno..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-white font-medium shadow-xs"
                />
                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/40 dark:border-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Cloud size={12} className="animate-pulse" />
                  <span className="text-[9px] uppercase font-bold tracking-widest">Guardado Al Instante</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  {/* Row 1: Categories */}
                  <tr className="bg-slate-50 dark:bg-slate-850/50 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-3 font-black uppercase tracking-wider border-r-2 border-slate-200 dark:border-slate-700 w-[180px] sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">Categoría</th>
                    {currentParcial.categories.map(cat => {
                      const colsCount = cat.activities.length + 1;
                      return (
                        <th 
                          key={cat.id} 
                          colSpan={colsCount} 
                          className="py-3 px-2 text-center font-black uppercase tracking-wider border-r border-slate-100 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-950/5 text-indigo-600 dark:text-indigo-400 border-b border-slate-150"
                        >
                          {cat.name} ({cat.weight}%)
                        </th>
                      );
                    })}
                    <th className="py-3 px-3 text-center font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800/40 text-slate-800 dark:text-white w-[110px]">Cálculo</th>
                  </tr>
                  {/* Row 2: Activities */}
                  <tr className="bg-slate-100/50 dark:bg-slate-800/30 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-750 font-bold">
                    <th className="py-3 px-3 font-black uppercase tracking-wider border-r-2 border-slate-200 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-900 z-10 w-[180px] shadow-[2px_0_4px_rgba(0,0,0,0.02)]">Alumno</th>
                    {currentParcial.categories.map(cat => (
                      <React.Fragment key={cat.id}>
                        {cat.activities.map(act => (
                          <th key={act.id} className="py-2.5 px-2 text-center font-bold border-r border-slate-100 dark:border-slate-800/40 min-w-[130px] leading-tight" title={act.name}>
                            <div className="flex flex-col items-center gap-1">
                              <span className="line-clamp-1 truncate text-[11px] font-bold">{act.name}</span>
                              <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition">
                                <button 
                                  onClick={() => handleFillColumn(act.id, 10)}
                                  className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 rounded text-[9px] font-black uppercase transition-all active:scale-95"
                                  title="Asignar 10 a todos los alumnos en esta columna"
                                >
                                  +10
                                </button>
                                <button 
                                  onClick={() => handleFillColumn(act.id, null)}
                                  className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[9px] font-black uppercase transition-all active:scale-95"
                                  title="Vaciar notas de esta columna"
                                >
                                  Borrar
                                </button>
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className="py-2.5 px-2 text-center font-black bg-indigo-50/5 dark:bg-indigo-950/10 text-slate-500 uppercase tracking-tighter border-r border-slate-150 dark:border-slate-750/60 w-[95px]">
                          Promedio
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="py-3 px-4 text-center font-black bg-indigo-600 text-white uppercase tracking-wider w-[130px]">
                      Parcial
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 font-medium text-slate-700 dark:text-slate-300">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={100} className="py-8 text-center text-slate-400 dark:text-slate-500 font-bold text-xs italic">
                        No se encontraron alumnos que coincidan con "{studentSearchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, studentIdx) => {
                      const studentGrades = currentParcial.grades[student.id] || {};
                      const parcialScore = getParcialScore(student.id, currentParcial);
                      const finalParcial = parcialScore.value;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/30 transition-colors">
                          <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white border-r-2 border-slate-200 dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-900 z-10 w-[180px] shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                            {student.name}
                          </td>
                        
                        {currentParcial.categories.map(cat => {
                          const catAvg = calculateStudentCategoryAverage(student.id, cat, currentParcial.grades);
                          const hasCatGrades = hasCategoryGrades(student.id, cat, currentParcial.grades);
                          
                          return (
                            <React.Fragment key={cat.id}>
                              {cat.activities.map(act => {
                                const scoreVal = studentGrades[act.id];
                                const scoreStr = scoreVal !== undefined ? scoreVal.toString() : '';
                                const actIdx = allActivities.findIndex(a => a.id === act.id);

                                return (
                                  <td key={act.id} className="p-1 border-r border-slate-100 dark:border-slate-800/40 text-center min-w-[120px]">
                                    <input 
                                      id={`grade-input-${studentIdx}-${actIdx}`}
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="10"
                                      inputMode="decimal"
                                      className="w-full text-center py-1.5 px-1 bg-transparent border-none rounded-lg focus:bg-indigo-50/50 dark:focus:bg-indigo-950/30 focus:ring-1 focus:ring-indigo-500 dark:text-white font-bold placeholder:text-slate-300 dark:placeholder:text-slate-650 text-[16px] md:text-xs"
                                      placeholder="-"
                                      value={scoreStr}
                                      onChange={(e) => handleGradeChange(student.id, act.id, e.target.value)}
                                      onPaste={(e) => handlePaste(e, studentIdx, actIdx)}
                                      onFocus={(e) => e.target.select()}
                                      onKeyDown={(e) => handleKeyDown(e, studentIdx, actIdx)}
                                    />
                                  </td>
                                );
                              })}
                              <td className="py-3.5 px-2 text-center bg-indigo-50/10 dark:bg-indigo-950/5 text-slate-600 dark:text-slate-400 font-bold border-r border-slate-150 dark:border-slate-750/60 min-w-[90px]">
                                {hasCatGrades ? catAvg.toFixed(1) : '—'}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        <td className={`py-3.5 px-3 text-center font-black border-l border-slate-200 dark:border-slate-750 min-w-[110px] ${
                          finalParcial === null ? 'text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-850/30' :
                          finalParcial >= 8.0
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                            : finalParcial >= 7.0
                              ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                        }`}>
                          {finalParcial === null ? 'Pendiente' : finalParcial.toFixed(1)}
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY ADD/EDIT MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-lg">
                {isAddingNewCat ? 'Crear Categoría' : 'Editar Categoría'}
              </h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-300 hover:text-slate-500 transition">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Nombre de la Categoría</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-600 dark:text-white font-bold text-sm"
                  placeholder="Ej: Proyectos, Tareas, Examen"
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Peso / Porcentaje (%)</label>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-2xl">
                  <input 
                    type="number"
                    min="1"
                    max="100"
                    className="flex-1 bg-transparent border-none focus:ring-0 p-0 font-bold dark:text-white text-sm"
                    value={catWeightInput}
                    onChange={(e) => setCatWeightInput(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-slate-400 font-black text-sm">%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={handleSaveCategory}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
              >
                Guardar
              </button>
              
              {!isAddingNewCat && editingCategory && (
                <button 
                  onClick={() => handleDeleteCategory(editingCategory.id)}
                  className="px-3.5 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase transition-all active:scale-95 flex items-center justify-center animate-pulse"
                  title="Eliminar Categoría"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY EDIT MODAL */}
      {isActModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-slate-50 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-lg animate-scale-up">
                Editar Actividad
              </h3>
              <button 
                onClick={() => {
                  setIsActModalOpen(false);
                  setEditingActivity(null);
                }} 
                className="text-slate-300 hover:text-slate-500 transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Nombre del Trabajo / Actividad</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-indigo-600 dark:text-white font-bold text-sm"
                  placeholder="Ej: Tarea 1, Examen Parcial"
                  value={actNameInput}
                  onChange={(e) => setActNameInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={handleSaveActivity}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
              >
                Guardar Cambios
              </button>
              
              <button 
                onClick={() => {
                  if (editingActivity) {
                    setIsActModalOpen(false);
                    handleDeleteActivity(editingActivity.catId, editingActivity.act.id);
                  }
                }}
                className="px-3.5 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase transition-all active:scale-95 flex items-center justify-center"
                title="Eliminar Actividad"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DIALOG MODAL (100% Android/Iframe Compatible) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl space-y-5 border border-slate-150 dark:border-slate-800 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertCircle size={28} className="shrink-0" />
              <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">
                {confirmModal.title}
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              {confirmModal.message}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-rose-600/10"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
