import React, { useState, useEffect, useRef } from 'react';
import { Clock, Play, Pause, RotateCcw, X, Bell, Check } from 'lucide-react';
import { AudioHaptics } from '../../services/audioHaptics';

interface ClassroomTimerModalProps {
  onClose: () => void;
}

export const ClassroomTimerModal: React.FC<ClassroomTimerModalProps> = ({ onClose }) => {
  const [totalSeconds, setTotalSeconds] = useState(300); // Default 5 minutes
  const [timeLeft, setTimeLeft] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            AudioHaptics.playAlarm();
            return 0;
          }
          if (prev % 60 === 0 || prev <= 5) {
            AudioHaptics.playTick();
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStartPause = () => {
    AudioHaptics.playPop();
    if (timeLeft === 0) {
      setTimeLeft(totalSeconds);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    AudioHaptics.playPop();
    setIsRunning(false);
    setTimeLeft(totalSeconds);
  };

  const setPreset = (mins: number) => {
    AudioHaptics.playPop();
    setIsRunning(false);
    const secs = mins * 60;
    setTotalSeconds(secs);
    setTimeLeft(secs);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const progressPct = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;
  const strokeDashoffset = 283 - (283 * progressPct) / 100;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col text-center relative overflow-hidden max-h-[90vh] overflow-y-auto">
        
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
            <Clock size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Control de Tiempo</span>
        </div>
        
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Temporizador de Clase</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
          Cronómetro para actividades individuales y en equipo
        </p>

        {/* CIRCULAR TIMER SVG DISPLAY */}
        <div className="relative w-48 h-48 mx-auto my-2 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle 
              cx="50" cy="50" r="45" 
              className="stroke-slate-100 dark:stroke-slate-800 fill-none" 
              strokeWidth="6" 
            />
            {/* Animated Progress ring */}
            <circle 
              cx="50" cy="50" r="45" 
              className={`fill-none transition-all duration-1000 ${
                timeLeft === 0 
                  ? 'stroke-rose-500' 
                  : timeLeft < 60 
                    ? 'stroke-amber-500' 
                    : 'stroke-indigo-600'
              }`}
              strokeWidth="6"
              strokeDasharray="283"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          <div className="absolute flex flex-col items-center">
            <span className={`text-4xl font-black font-mono tracking-tight ${
              timeLeft === 0 ? 'text-rose-500 animate-pulse' : 'text-slate-900 dark:text-white'
            }`}>
              {formatTime(timeLeft)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              {timeLeft === 0 ? '¡TIEMPO FINALIZADO!' : isRunning ? 'EN PROGRESO' : 'PAUSADO'}
            </span>
          </div>
        </div>

        {/* PRESET BUTTONS */}
        <div className="grid grid-cols-4 gap-2 my-4">
          {[1, 5, 10, 15].map(mins => (
            <button
              key={mins}
              onClick={() => setPreset(mins)}
              className={`py-2 px-1 rounded-xl text-xs font-black transition-all ${
                totalSeconds === mins * 60
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {mins} min
            </button>
          ))}
        </div>

        {/* CONTROL BUTTONS */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleStartPause}
            className={`flex-1 py-4 font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 text-white active:scale-95 ${
              isRunning 
                ? 'bg-amber-500 hover:bg-amber-600' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
            {isRunning ? 'Pausar' : 'Iniciar'}
          </button>
          
          <button
            onClick={handleReset}
            className="px-5 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-black rounded-2xl text-xs uppercase tracking-widest transition-all active:scale-95"
            title="Reiniciar"
          >
            <RotateCcw size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};
