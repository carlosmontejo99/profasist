import express from 'express';
import path from 'path';
import fs from 'fs';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// --- WEB PUSH SETUP ---
const VAPID_KEYS_FILE = path.join(process.cwd(), 'vapid_keys.json');
const SUBS_FILE = path.join(process.cwd(), 'subscriptions.json');
const SCHEDULES_FILE = path.join(process.cwd(), 'schedules.json');

let vapidKeys: { publicKey: string; privateKey: string };

if (fs.existsSync(VAPID_KEYS_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf8'));
  } catch (e) {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2));
  }
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2));
}

webpush.setVapidDetails(
  'mailto:MundoOculto99@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

function getSubscriptions(): any[] {
  if (fs.existsSync(SUBS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveSubscription(sub: any) {
  const subs = getSubscriptions();
  if (!subs.some((s: any) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
  }
}

function removeSubscription(endpoint: string) {
  const subs = getSubscriptions();
  const filtered = subs.filter((s: any) => s.endpoint !== endpoint);
  fs.writeFileSync(SUBS_FILE, JSON.stringify(filtered, null, 2));
}

// Background scheduler for closed-app persistent reminders
const lastNotificationTimes: Record<string, number> = {};
const daysMap: Record<number, string[]> = {
  0: ['dom', 'sun', 'domingo'],
  1: ['lun', 'mon', 'lunes'],
  2: ['mar', 'tue', 'martes'],
  3: ['mie', 'wed', 'miércoles', 'miercoles'],
  4: ['jue', 'thu', 'jueves'],
  5: ['vie', 'fri', 'viernes'],
  6: ['sab', 'sat', 'sábado', 'sabado']
};

function checkAndSendReminders() {
  if (!fs.existsSync(SCHEDULES_FILE)) return;

  let data: { timezoneOffset: number; schedules: Array<{ id: string; name: string; scheduleSummary: string }> };
  try {
    data = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
  } catch (e) {
    return;
  }

  const { timezoneOffset, schedules } = data;
  if (!schedules || schedules.length === 0) return;

  const nowUtc = Date.now();
  const localDate = new Date(nowUtc - (timezoneOffset * 60000));
  
  const localHour = localDate.getUTCHours();
  const localMin = localDate.getUTCMinutes();
  const localDayIndex = localDate.getUTCDay();

  const currentDayNames = daysMap[localDayIndex] || [];

  schedules.forEach(group => {
    if (!group.scheduleSummary) return;

    const summary = group.scheduleSummary.toLowerCase();
    const matchesDay = currentDayNames.some(dayName => summary.includes(dayName));
    if (!matchesDay) return;

    const timeRegex = /(\d{1,2}):(\d{2})/;
    const match = summary.match(timeRegex);
    if (!match) return;

    const targetHour = parseInt(match[1], 10);
    const targetMin = parseInt(match[2], 10);

    if (localHour === targetHour && localMin === targetMin) {
      const dateString = localDate.toISOString().split('T')[0];
      const notifyKey = `${group.id}-${dateString}-${targetHour}-${targetMin}`;

      if (!lastNotificationTimes[notifyKey]) {
        lastNotificationTimes[notifyKey] = Date.now();

        const subscriptions = getSubscriptions();
        const payload = JSON.stringify({
          title: 'ProfAsist: Pase de Lista',
          body: `Es hora de pasar asistencia en la materia: ${group.name} (${group.scheduleSummary}).`,
          tag: group.id,
          url: '/'
        });

        subscriptions.forEach(sub => {
          webpush.sendNotification(sub, payload)
            .catch(err => {
              console.error('Error sending push notification:', err);
              if (err.statusCode === 410 || err.statusCode === 404) {
                removeSubscription(sub.endpoint);
              }
            });
        });
      }
    }
  });
}

// Start periodic checks every 30 seconds
setInterval(checkAndSendReminders, 30000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Middleware para verificar que la clave de la API de Gemini esté configurada de manera segura
  app.use('/api/ai', (req, res, next) => {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
      return res.status(401).json({ 
        error: 'El API Key de Gemini no está configurado en el servidor. Por favor, agrega la variable de entorno GEMINI_API_KEY en los ajustes para activar el asistente de IA, planificador y análisis predictivos.' 
      });
    }
    next();
  });

  // AI Chat Route (Assistant)
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, systemInstruction } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Falta el historial de mensajes o no es válido.' });
      }

      // Map messages to the structure expected by generateContent
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction: systemInstruction || 'Eres un asistente de IA experto en educación y gestión escolar llamado ProfAsist. Ayudas a profesores a planificar clases, redactar comunicaciones, analizar la asistencia de sus alumnos y resolver problemas académicos.'
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error in AI Chat:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor en AI Chat.' });
    }
  });

  // AI Course Planner Route
  app.post('/api/ai/planner', async (req, res) => {
    try {
      const { subjectName, scheduleSummary, sessionCount, semester, additionalContext } = req.body;

      if (!subjectName) {
        return res.status(400).json({ error: 'Falta el nombre de la materia.' });
      }

      const count = sessionCount || 10;

      const prompt = `Actúa como un diseñador curricular profesional. Diseña un temario cronológico completo para la materia "${subjectName}" con un total de ${count} clases programadas para el ciclo ${semester || 'actual'}.
Horario de clase: ${scheduleSummary || 'No especificado'}.
Contexto adicional del docente: ${additionalContext || 'Ninguno'}.

Genera exactamente ${count} temas ordenados secuencialmente. Asegúrate de que los temas sean educativos, prácticos y alineados con el nivel académico correspondiente (si se indica, o general universitario/preparatoria por defecto).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Eres un experto en diseño curricular educativo. Diseñas programas de estudio detallados, progresivos y de alta calidad académica.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sessions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sessionIndex: { 
                      type: Type.INTEGER, 
                      description: 'El índice secuencial de la sesión empezando en 0 hasta N-1' 
                    },
                    topic: { 
                      type: Type.STRING, 
                      description: 'Un título corto y directo para el tema de esta clase (ej. "Introducción al Álgebra")' 
                    },
                    description: { 
                      type: Type.STRING, 
                      description: 'Una descripción breve pero detallada (1-2 oraciones) de lo que se cubrirá y los objetivos de aprendizaje de la sesión.' 
                    }
                  },
                  required: ['sessionIndex', 'topic', 'description']
                }
              }
            },
            required: ['sessions']
          }
        }
      });

      const parsedData = JSON.parse(response.text || '{}');
      res.json(parsedData);
    } catch (error: any) {
      console.error('Error in AI Planner:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor en AI Planner.' });
    }
  });

  // AI Student Attendance Insights Route
  app.post('/api/ai/insights', async (req, res) => {
    try {
      const { subjectName, studentsData } = req.body;

      if (!studentsData || !Array.isArray(studentsData)) {
        return res.status(400).json({ error: 'Falta la información de los estudiantes.' });
      }

      const prompt = `Analiza detalladamente la asistencia de los alumnos de la materia "${subjectName || 'la clase'}".
Aquí tienes el listado de alumnos con sus estadísticas actuales de asistencia (% de asistencia, total de sesiones, asistencias, faltas, retardos, justificantes):
${JSON.stringify(studentsData, null, 2)}

Identifica patrones de inasistencia (por ejemplo, quiénes tienen porcentajes de asistencia por debajo del 80% o quiénes acumulan muchas faltas y retardos).
Para cada alumno considerado en riesgo (asistencia < 85% o patrones preocupantes de inasistencias consecutivas), elabora:
1. Nivel de riesgo (Bajo, Medio, Alto).
2. Justificación pedagógica breve del riesgo.
3. Un mensaje persuasivo, empático, profesional y amigable en español adaptado para WhatsApp o correo que el docente pueda enviarle al alumno directamente para reengancharlo y consultarle el motivo de su inactividad de manera asertiva.

Genera también un resumen general con tendencias (ej. ausentismo acumulado, recomendaciones de motivación escolar).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Eres un analista de tutorías escolares y consejero pedagógico experto en retención de estudiantes y tutoría escolar activa.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              generalSummary: { 
                type: Type.STRING, 
                description: 'Resumen ejecutivo general del comportamiento de asistencia de la clase y sugerencias pedagógicas de retención' 
              },
              attendanceTrends: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Lista de tendencias o hallazgos relevantes en el grupo'
              },
              atRiskStudents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    studentId: { type: Type.STRING },
                    studentName: { type: Type.STRING },
                    percentage: { type: Type.NUMBER },
                    riskLevel: { type: Type.STRING, description: 'Bajo, Medio, Alto' },
                    reasoning: { type: Type.STRING, description: 'Explicación del patrón de inasistencia y por qué se categoriza así' },
                    messageTemplate: { type: Type.STRING, description: 'Mensaje amigable en español para enviarle al alumno por WhatsApp o Correo.' }
                  },
                  required: ['studentId', 'studentName', 'percentage', 'riskLevel', 'reasoning', 'messageTemplate']
                },
                description: 'Estudiantes detectados con asistencia comprometida o en riesgo de reprobación'
              }
            },
            required: ['generalSummary', 'attendanceTrends', 'atRiskStudents']
          }
        }
      });

      const parsedData = JSON.parse(response.text || '{}');
      res.json(parsedData);
    } catch (error: any) {
      console.error('Error in AI Insights:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor en AI Insights.' });
    }
  });

  // AI Attendance Predictive Analytics Route
  app.post('/api/ai/predictive', async (req, res) => {
    try {
      const { city, weather, traffic, classTime, subjectName, studentsData } = req.body;

      if (!studentsData || !Array.isArray(studentsData)) {
        return res.status(400).json({ error: 'Falta la información de los estudiantes.' });
      }

      const prompt = `Realiza un análisis predictivo de la asistencia para la materia "${subjectName || 'la clase'}".
Ciudad: ${city || 'Guadalajara'}
Condición de Clima Actual: ${weather || 'Despejado / Templado'}
Condición de Tráfico Actual: ${traffic || 'Tráfico Fluido'}
Horario de Clase: ${classTime || 'Temprano (7:00 AM - 9:00 AM)'}

Aquí tienes el listado de alumnos con sus estadísticas actuales de asistencia:
${JSON.stringify(studentsData, null, 2)}

Tu objetivo es correlacionar los factores externos (ciudad, clima, tráfico, hora de clase) con la probabilidad de asistencia de cada alumno (especialmente de aquellos con asistencia baja, menor al 80%).
Genera:
1. weatherImpact: Análisis del impacto de este clima específico en esta ciudad en la asistencia y el ánimo de los alumnos.
2. trafficImpact: Análisis de cómo el nivel de tráfico interfiere con la llegada a tiempo a esta hora de clase en esta ciudad, ofreciendo soluciones para mitigar las tardanzas.
3. timeImpact: El impacto del horario de clase en la puntualidad y retención del alumno.
4. overallConclusion: Una sugerencia práctica del docente (ej. "Dar 10 minutos de tolerancia hoy").
5. studentNotices: Para cada alumno que ya está por debajo del 80% (o en un nivel de riesgo bajo/medio/alto general), genera un aviso personalizado dirigido a TI, el DOCENTE (no un mensaje para el alumno), de tipo "aviso para mi de estar pendiente con este alumno". Por ejemplo: "Se sugiere monitorear la entrada de [Nombre] hoy, ya que con lluvia y tráfico del norte de la ciudad suele rezagarse." u observaciones clave.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Eres un sistema de analítica predictiva de asistencia escolar. Analizas factores externos como el clima, la hora y el tráfico urbano para predecir el comportamiento y absentismo de los estudiantes, y generas observaciones de seguimiento estratégico para el docente.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              weatherImpact: { 
                type: Type.STRING, 
                description: 'Análisis predictivo de cómo el clima indicado afecta la asistencia en la ciudad del usuario, con porcentaje estimado de impacto.' 
              },
              trafficImpact: { 
                type: Type.STRING, 
                description: 'Análisis predictivo de cómo el tráfico y la movilidad urbana afectan la llegada a clase, con sugerencias para el docente.' 
              },
              timeImpact: { 
                type: Type.STRING, 
                description: 'Análisis predictivo del horario de clase y su correlación con el cansancio o tardanzas de los alumnos.' 
              },
              overallConclusion: { 
                type: Type.STRING, 
                description: 'Conclusión general con una recomendación práctica de tolerancia o flexibilidad pedagógica.' 
              },
              studentNotices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    studentId: { type: Type.STRING },
                    studentName: { type: Type.STRING },
                    notice: { type: Type.STRING, description: 'Un aviso específico para el docente sobre a qué estar pendiente con este alumno en particular (ej. retrasos por tráfico, riesgo de inasistencia por lluvia, etc.)' },
                    urgency: { type: Type.STRING, description: 'Urgencia del aviso: alta, media, baja' }
                  },
                  required: ['studentId', 'studentName', 'notice', 'urgency']
                },
                description: 'Listado de avisos específicos para que el docente esté al pendiente de alumnos que ya tienen un historial de inasistencia comprometido, correlacionando con las condiciones actuales.'
              }
            },
            required: ['weatherImpact', 'trafficImpact', 'timeImpact', 'overallConclusion', 'studentNotices']
          }
        }
      });

      const parsedData = JSON.parse(response.text || '{}');
      res.json(parsedData);
    } catch (error: any) {
      console.error('Error in AI Predictive:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor en AI Predictive.' });
    }
  });

  // --- ENDPOINTS DE NOTIFICACIONES PUSH ---
  app.get('/api/notifications/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post('/api/notifications/subscribe', (req, res) => {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Suscripción inválida' });
    }
    saveSubscription(subscription);
    res.json({ success: true, message: 'Suscripción de notificaciones push registrada correctamente.' });
  });

  app.post('/api/notifications/sync-schedules', (req, res) => {
    const { timezoneOffset, schedules } = req.body;
    if (typeof timezoneOffset !== 'number' || !Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Datos de horarios inválidos.' });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ timezoneOffset, schedules }, null, 2));
    res.json({ success: true, message: 'Horarios sincronizados para notificaciones persistentes.' });
  });

  app.post('/api/notifications/test', async (req, res) => {
    const subscriptions = getSubscriptions();
    if (subscriptions.length === 0) {
      return res.status(400).json({ error: 'No hay dispositivos suscritos en este servidor. Habilita las notificaciones en el navegador primero.' });
    }

    const payload = JSON.stringify({
      title: 'ProfAsist: Prueba de Alerta Persistente',
      body: '¡Perfecto! Los recordatorios en segundo plano están configurados y funcionando de manera 100% fiable.',
      tag: 'test-notification',
      url: '/'
    });

    let successCount = 0;
    let failCount = 0;

    const promises = subscriptions.map(sub => {
      return webpush.sendNotification(sub, payload)
        .then(() => {
          successCount++;
        })
        .catch(err => {
          console.error('Error in test notification push:', err);
          failCount++;
          if (err.statusCode === 410 || err.statusCode === 404) {
            removeSubscription(sub.endpoint);
          }
        });
    });

    await Promise.all(promises);

    res.json({ 
      success: true, 
      message: `Notificaciones de prueba enviadas. Éxito: ${successCount}, Errores: ${failCount}.` 
    });
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
