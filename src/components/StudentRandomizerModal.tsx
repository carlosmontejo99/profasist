import React, { useState } from 'react';
import { Sparkles, Dices, X, RefreshCw, Award, Check } from 'lucide-react';
import { Student } from '../../types';
import { AudioHaptics } from '../../services/audioHaptics';

interface StudentRandomizerModalProps {
  students: Student[];
  onClose: () => void;
}

export const StudentRandomizerModal: React.FC<StudentRandomizerModalProps> = ({ students, onClose }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [displayStudentName, setDisplayStudentName] = useState<string>('¿Quién participará?');
  const [history, setHistory] = useState<Student[]>([]);

  const handleSpin = () => {
    if (students.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setSelectedStudent(null);
    AudioHaptics.playPop();

    let counter = 0;
    const totalTicks = 24;
    let delay = 60;

    const runTick = () => {
      const randomIdx = Math.floor(Math.random() * students.length);
      const tempStudent = students[randomIdx];
      setDisplayStudentName(tempStudent.name);
      AudioHaptics.playTick();

      counter++;
      if (counter < totalTicks) {
        delay += 12; // decelerate spin
        setTimeout(runTick, delay);
      } else {
        const finalIdx = Math.floor(Math.random() * students.length);
        const finalStudent = students[finalIdx];
        setSelectedStudent(finalStudent);
        setDisplayStudentName(finalStudent.name);
        setIsSpinning(false);
        AudioHaptics.playSuccess();

        setHistory(prev => [finalStudent, ...prev.filter(s => s.id !== finalStudent.id)].slice(0, 5));
      }
    };

    setTimeout(runTick, delay);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col text-center relative overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Dices size={24} className={isSpinning ? 'animate-spin' : ''} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Participación Aleatoria</span>
        </div>
        
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Ruleta de Alumnos</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
          Selección al azar para preguntas o presentaciones
        </p>

        {/* Display Banner */}
        <div className={`p-8 rounded-[2rem] border transition-all duration-300 flex flex-col items-center justify-center min-h-[150px] my-2 ${
          selectedStudent 
            ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border-indigo-400 shadow-xl scale-[1.02]' 
            : 'bg-slate-50 dark:bg-slate-850 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200'
        }`}>
          {selectedStudent && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 animate-bounce">
              <Sparkles size={12} /> ¡Alumno Seleccionado!
            </div>
          )}
          
          <h4 className={`font-black transition-all ${
            selectedStudent ? 'text-2xl text-white' : 'text-lg text-slate-700 dark:text-slate-300'
          }`}>
            {displayStudentName}
          </h4>
          
          {selectedStudent && selectedStudent.rollNumber && (
            <span className="text-xs font-mono opacity-80 mt-1">Matrícula: {selectedStudent.rollNumber}</span>
          )}
        </div>

        {/* Action Button */}
        <button
          disabled={isSpinning || students.length === 0}
          onClick={handleSpin}
          className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isSpinning ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> Seleccionando...
            </>
          ) : (
            <>
              <Dices size={18} /> Girar Ruleta Ahora
            </>
          )}
        </button>

        {/* Recent Picks */}
        {history.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-2">Seleccionados Recientemente:</span>
            <div className="flex flex-wrap gap-1.5">
              {history.map((s, idx) => (
                <span key={s.id} className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                  {idx + 1}. {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
