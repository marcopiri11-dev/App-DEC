
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, X, Navigation, Briefcase, GraduationCap, 
  QrCode, Smartphone, LogOut, UserPlus, AlertCircle, Share2, 
  CheckCircle2, Circle, Square, Triangle, ShieldAlert, Wifi, Info, Laptop, MapPin, Copy, Check, Download, Globe, Cloud
} from 'lucide-react';
import { EVALUATION_CATEGORIES, Grade, Student, EvaluationResult, PathPoint, ErrorEvent } from './types';
import { TrafficLightInput } from './components/TrafficLightInput';
import { StudentCard } from './components/StudentCard';
import { generateDrivingFeedback } from './services/geminiService';

const safeStorage = {
  getItem: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
};

const PathVisualizer: React.FC<{ path: PathPoint[], errors: ErrorEvent[] }> = ({ path, errors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || path.length < 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    path.forEach(p => {
      if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng;
    });
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const padding = 20;
    const getX = (lng: number) => padding + ((lng - minLng) / lngRange) * (rect.width - padding * 2);
    const getY = (lat: number) => rect.height - (padding + ((lat - minLat) / latRange) * (rect.height - padding * 2));
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    path.forEach((p, i) => {
      const x = getX(p.lng); const y = getY(p.lat);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    errors.forEach(err => {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(getX(err.location.lng), getY(err.location.lat), 5, 0, Math.PI * 2); ctx.fill();
    });
  }, [path, errors]);

  if (path.length < 2) return <div className="w-full h-32 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 text-[10px] uppercase font-black tracking-widest border border-dashed italic">Percorso non tracciato</div>;
  return <canvas ref={canvasRef} className="w-full h-32 bg-gray-50 rounded-2xl border shadow-inner" />;
};

const DEFAULT_STUDENTS: Student[] = [
  { id: '1', name: 'Mario Rossi', licenseType: 'B', totalHours: 12, avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=MR&backgroundColor=3b82f6' },
];

type Role = 'ISTRUTTORE' | 'ALLIEVO' | null;

export default function App() {
  const [view, setView] = useState<'HOME' | 'LIST' | 'DASHBOARD' | 'EVALUATION' | 'SUMMARY' | 'HISTORY_DETAIL'>('HOME');
  const [role, setRole] = useState<Role>(() => safeStorage.getItem('dec_user_role') as Role || null);
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = safeStorage.getItem('driving_students');
    return saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
  });
  const [history, setHistory] = useState<EvaluationResult[]>(() => {
    const saved = safeStorage.getItem('driving_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedResult, setSelectedResult] = useState<EvaluationResult | null>(null);
  const [scores, setScores] = useState<Record<string, Grade>>({});
  const [currentPath, setCurrentPath] = useState<PathPoint[]>([]);
  const [currentErrors, setCurrentErrors] = useState<ErrorEvent[]>([]);
  const [gpsStatus, setGpsStatus] = useState<'OFF' | 'SEARCHING' | 'ACTIVE'>('OFF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [showDeployGuide, setShowDeployGuide] = useState(false);
  const [manualUrl, setManualUrl] = useState(window.location.href.includes('blob') ? '' : window.location.href);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<PathPoint | null>(null);

  useEffect(() => {
    safeStorage.setItem('driving_history', JSON.stringify(history));
    safeStorage.setItem('driving_students', JSON.stringify(students));
    if (role) safeStorage.setItem('dec_user_role', role);
  }, [history, students, role]);

  const copyToClipboard = () => {
    if (!manualUrl) return;
    navigator.clipboard.writeText(manualUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const startTracking = async () => {
    if (!("geolocation" in navigator)) return;
    setGpsStatus('SEARCHING');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('ACTIVE');
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        lastPosRef.current = point;
        setCurrentPath(prev => [...prev, point]);
      },
      () => setGpsStatus('OFF'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopTracking = () => {
    setGpsStatus('OFF');
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  };

  const handleFinish = async () => {
    stopTracking(); 
    setIsGenerating(true); 
    setView('SUMMARY');
    const feedback = await generateDrivingFeedback(selectedStudent?.name || "Allievo", scores, currentPath, currentErrors);
    setAiFeedback(feedback);
    const newResult: EvaluationResult = {
      studentId: selectedStudent!.id,
      date: new Date().toISOString(),
      scores: { ...scores },
      feedback,
      path: currentPath,
      errors: currentErrors
    };
    setHistory(prev => [newResult, ...prev]);
    setIsGenerating(false);
  };

  const logout = () => {
    setRole(null); setSelectedStudent(null);
    safeStorage.setItem('dec_user_role', '');
    setView('HOME');
  };

  if (view === 'HOME') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans text-white safe-top">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-600 blur-[80px] opacity-20 animate-pulse"></div>
            <h1 className="text-5xl font-black uppercase tracking-tighter relative z-10 leading-none">Metodo DEC</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mt-2">Professional Driving Evaluation</p>
          </div>
          
          <div className="w-full max-w-sm space-y-4">
            <button onClick={() => { setRole('ISTRUTTORE'); setView('LIST'); }} className="w-full bg-white text-black p-6 rounded-[2.5rem] flex items-center gap-5 active:scale-95 transition-all shadow-xl">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Briefcase size={28}/></div>
              <div className="text-left"><h3 className="text-xl font-black uppercase leading-none">Istruttore</h3><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Avvia Sessione</p></div>
            </button>
            <button onClick={() => { setRole('ALLIEVO'); setView('LIST'); }} className="w-full bg-gray-900 border border-gray-800 text-white p-6 rounded-[2.5rem] flex items-center gap-5 active:scale-95 transition-all shadow-xl">
              <div className="w-14 h-14 bg-white/5 text-blue-400 rounded-2xl flex items-center justify-center border border-white/10"><GraduationCap size={28}/></div>
              <div className="text-left"><h3 className="text-xl font-black uppercase leading-none">Allievo</h3><p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-1">Archivio Report</p></div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button onClick={() => setShowQr(true)} className="py-5 bg-gray-900/50 text-white rounded-3xl border border-gray-800 flex flex-col items-center justify-center gap-2 active:bg-blue-600 transition-all">
              <QrCode size={20}/><span className="text-[8px] font-black uppercase tracking-widest">Sincronizza</span>
            </button>
            <button onClick={() => setShowDeployGuide(true)} className="py-5 bg-blue-600/10 text-blue-400 rounded-3xl border border-blue-500/30 flex flex-col items-center justify-center gap-2 active:bg-blue-600 active:text-white transition-all">
              <Cloud size={20}/><span className="text-[8px] font-black uppercase tracking-widest">Installa App</span>
            </button>
          </div>
        </div>

        {/* Modal QR Code */}
        {showQr && (
          <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6" onClick={() => setShowQr(false)}>
            <div className="bg-white rounded-[3.5rem] p-10 text-center space-y-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black text-black uppercase tracking-tight">Sincronizzazione</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 p-5 rounded-[2rem] border-2 border-blue-100 text-left">
                  <p className="text-[10px] font-black text-blue-800 uppercase mb-2">1. Link dell'app (non Blob):</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={manualUrl} 
                      onChange={(e) => setManualUrl(e.target.value)}
                      className="flex-1 bg-white border border-blue-200 p-3 rounded-xl text-[10px] font-mono font-bold text-blue-600 outline-none"
                      placeholder="https://..."
                    />
                    <button onClick={copyToClipboard} className="p-3 bg-blue-600 text-white rounded-xl active:scale-90 shadow-lg">
                      {copySuccess ? <Check size={18}/> : <Copy size={18}/>}
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-white rounded-[3rem] border-8 border-gray-100 shadow-2xl inline-block">
                  {manualUrl ? (
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(manualUrl)}`} alt="QR" className="w-44 h-44" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-gray-300 italic text-[10px]">Inserisci un URL valido</div>
                  )}
                </div>
              </div>

              <button onClick={() => setShowQr(false)} className="w-full py-5 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em]">CHIUDI</button>
            </div>
          </div>
        )}

        {/* Modal Guida Deployment su Piattaforme Esterne */}
        {showDeployGuide && (
          <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6" onClick={() => setShowDeployGuide(false)}>
            <div className="bg-white rounded-[3rem] p-8 text-black max-w-md w-full space-y-6 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><Globe size={24}/></div>
                <h3 className="text-xl font-black uppercase tracking-tight">Come avere l'App su Cellulare</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase text-blue-600">Opzione 1: Vercel o Netlify (Gratis)</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Queste piattaforme ti permettono di pubblicare l'app online in 2 minuti.
                    1. Scarica il codice come ZIP.<br/>
                    2. Vai su <span className="font-bold">vercel.com</span> o <span className="font-bold">netlify.com</span>.<br/>
                    3. Trascina la cartella e otterrai un link pubblico tipo <span className="italic">metodo-dec.vercel.app</span>.<br/>
                    4. Aprilo sul telefono e clicca "Aggiungi a Home".
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black uppercase text-blue-600">Opzione 2: GitHub Pages</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Carica il progetto su un repository GitHub e attiva "Pages" nelle impostazioni. È il metodo più usato dai programmatori.
                  </p>
                </div>

                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                  <p className="text-[10px] font-black uppercase text-amber-700 mb-1 flex items-center gap-2"><ShieldAlert size={14}/> Attenzione</p>
                  <p className="text-[10px] text-amber-600 leading-tight">I link che iniziano con <span className="font-bold">blob:</span> o <span className="font-bold">localhost</span> non funzionano sul cellulare perché sono indirizzi temporanei del tuo PC.</p>
                </div>
              </div>

              <button onClick={() => setShowDeployGuide(false)} className="w-full py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">HO CAPITO</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Il resto dell'app (LIST, DASHBOARD, EVALUATION, etc.) rimane invariato...
  if (view === 'LIST') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col safe-top">
        <header className="bg-white p-6 border-b flex items-center justify-between shadow-sm">
          <button onClick={logout} className="p-2 bg-gray-100 rounded-xl active:scale-90"><ChevronLeft/></button>
          <h2 className="text-xl font-black uppercase tracking-tighter">Scegli Allievo</h2>
          {role === 'ISTRUTTORE' ? (
             <button onClick={() => setShowAddStudent(true)} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><UserPlus size={20}/></button>
          ) : <div className="w-10"></div>}
        </header>
        <main className="p-6 space-y-4 max-w-2xl mx-auto w-full overflow-y-auto">
          {students.map(s => <StudentCard key={s.id} student={s} isSelected={false} onClick={() => {setSelectedStudent(s); setView('DASHBOARD');}} />)}
        </main>

        {showAddStudent && (
          <div className="fixed inset-0 bg-black/60 z-[200] flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 w-full max-w-sm">
              <h3 className="text-xl font-black mb-6 uppercase">Nuovo Allievo</h3>
              <input 
                type="text" 
                placeholder="Nome e Cognome" 
                value={newStudentName}
                onChange={e => setNewStudentName(e.target.value)}
                className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl mb-6 font-bold outline-none focus:border-blue-500 transition-colors"
              />
              <div className="flex gap-4">
                <button onClick={() => setShowAddStudent(false)} className="flex-1 py-4 font-black text-gray-400">ANNULLA</button>
                <button onClick={() => {
                  if (!newStudentName.trim()) return;
                  const n: Student = {
                    id: Date.now().toString(),
                    name: newStudentName,
                    licenseType: 'B',
                    totalHours: 0,
                    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${newStudentName}&backgroundColor=3b82f6`
                  };
                  setStudents([...students, n]);
                  setNewStudentName('');
                  setShowAddStudent(false);
                }} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg">SALVA</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'DASHBOARD' && selectedStudent) {
    const studentHistory = history.filter(h => h.studentId === selectedStudent.id);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col safe-top">
        <header className="bg-white p-6 border-b flex items-center justify-between shadow-sm sticky top-0 z-50">
          <button onClick={() => setView('LIST')} className="p-2 bg-gray-100 rounded-xl"><ChevronLeft/></button>
          <div className="text-center">
            <h2 className="text-xl font-black tracking-tighter leading-none">{selectedStudent.name}</h2>
            <p className="text-[9px] font-black uppercase text-blue-600 mt-1">{role} METODO DEC</p>
          </div>
          <button onClick={logout} className="p-2 bg-red-50 text-red-500 rounded-xl"><LogOut size={20}/></button>
        </header>
        <main className="p-6 space-y-6 max-w-2xl mx-auto w-full pb-32">
          {role === 'ISTRUTTORE' && (
            <button onClick={() => {setView('EVALUATION'); startTracking();}} className="w-full py-12 bg-blue-600 text-white rounded-[3rem] shadow-[0_20px_60px_rgba(59,130,246,0.4)] flex flex-col items-center gap-4 active:scale-95 transition-all">
              <Navigation size={48} className="animate-bounce"/><h3 className="text-2xl font-black uppercase tracking-tight">AVVIA VALUTAZIONE</h3>
            </button>
          )}
          <div className="bg-white p-8 rounded-[3rem] border shadow-sm grid grid-cols-2 gap-4">
            <div className="text-center border-r-2 border-gray-50"><p className="text-3xl font-black text-blue-600">{studentHistory.length}</p><p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mt-1">GUIDE</p></div>
            <div className="text-center"><p className="text-3xl font-black text-gray-900">{selectedStudent.totalHours}</p><p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mt-1">ORE</p></div>
          </div>
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-gray-400 px-4">STORICO RECENTE</h4>
            {studentHistory.map((res, i) => (
              <button key={i} onClick={() => {setSelectedResult(res); setView('HISTORY_DETAIL');}} className="w-full bg-white p-6 rounded-[2rem] border border-gray-100 flex items-center justify-between active:bg-gray-50 shadow-sm transition-all">
                <div className="text-left">
                  <p className="text-sm font-black text-blue-600">{new Date(res.date).toLocaleDateString()}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[180px] mt-1">{res.feedback || "Report generato"}</p>
                </div>
                <div className="flex items-center gap-3">
                   {res.errors && res.errors.length > 0 && <div className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-lg">! {res.errors.length}</div>}
                   <ChevronLeft className="rotate-180 text-gray-300"/>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (view === 'EVALUATION' && selectedStudent) {
    return (
      <div className={`min-h-screen flex flex-col safe-top transition-colors duration-300 ${isFlashing ? 'bg-red-50' : 'bg-white'}`}>
        <header className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-50 shadow-sm">
          <button onClick={() => {stopTracking(); setView('DASHBOARD');}} className="p-2 text-gray-300"><X size={28}/></button>
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center mb-1">
              <div className={`w-2 h-2 rounded-full ${gpsStatus === 'ACTIVE' ? 'bg-green-500' : 'bg-red-600'} animate-pulse`}></div>
              <p className={`text-[8px] font-black uppercase ${gpsStatus === 'ACTIVE' ? 'text-green-600' : 'text-gray-400'}`}>GPS {gpsStatus}</p>
            </div>
            <h4 className="font-black text-lg tracking-tight">{selectedStudent.name}</h4>
          </div>
          <button onClick={handleFinish} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg active:scale-95">CONCLUDI</button>
        </header>

        <main className="p-4 pb-96 space-y-6 max-w-3xl mx-auto w-full overflow-y-auto">
          {EVALUATION_CATEGORIES.map(cat => (
            <div key={cat.id} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden border-gray-100">
              <div className="bg-gray-50 px-8 py-4 border-b text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">{cat.title}</div>
              <div className="p-3">
                {cat.items.map(it => <TrafficLightInput key={it.id} label={it.label} value={scores[it.id] || Grade.UNSET} onChange={g => setScores(prev => ({...prev, [it.id]: g}))} />)}
              </div>
            </div>
          ))}
        </main>

        <div className="fixed bottom-10 left-0 w-full flex justify-center z-[100] px-8">
          <button 
            onClick={() => {
              const timestamp = Date.now();
              setIsFlashing(true);
              setTimeout(() => setIsFlashing(false), 300);
              const location = lastPosRef.current || { lat: 0, lng: 0, timestamp };
              const newError: ErrorEvent = {
                id: Math.random().toString(36).substr(2, 9),
                location,
                note: "Intervento critico dell'istruttore",
                timestamp
              };
              setCurrentErrors(prev => [...prev, newError]);
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            }}
            className="w-full py-12 bg-red-600 text-white rounded-[3.5rem] shadow-[0_25px_60px_rgba(220,38,38,0.5)] border-[10px] border-white active:scale-90 transition-all flex items-center justify-center gap-5"
          >
            <AlertCircle size={48} className="animate-pulse" />
            <div className="text-left">
              <span className="block text-2xl font-black uppercase tracking-tighter leading-none">ERRORE GRAVE</span>
              <span className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Tocca in caso di pericolo</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'HISTORY_DETAIL' && selectedResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col safe-top">
        <header className="bg-white p-6 border-b flex items-center justify-between sticky top-0 z-[100] shadow-sm">
          <button onClick={() => setView('DASHBOARD')} className="p-2 bg-gray-100 rounded-xl"><ChevronLeft/></button>
          <h2 className="text-lg font-black uppercase tracking-tight">{new Date(selectedResult.date).toLocaleDateString()}</h2>
          <div className="flex gap-2">
            <button onClick={() => {
              const student = students.find(s => s.id === selectedResult.studentId);
              const content = `REPORT METODO DEC\nAllievo: ${student?.name}\nData: ${new Date(selectedResult.date).toLocaleString()}\nFeedback: ${selectedResult.feedback}`;
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Report_${student?.name}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }} className="p-3 bg-gray-100 text-gray-600 rounded-xl"><Download size={20}/></button>
            <button onClick={() => {
              const text = `Report Metodo DEC - ${new Date(selectedResult.date).toLocaleDateString()}\nAllievo: ${selectedStudent?.name}\n\n${selectedResult.feedback}`;
              if (navigator.share) navigator.share({ title: 'Report Metodo DEC', text });
            }} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><Share2 size={20}/></button>
          </div>
        </header>
        <main className="p-6 space-y-6 max-w-2xl mx-auto w-full pb-24 overflow-y-auto">
          <div className="bg-white p-8 rounded-[3rem] border shadow-sm border-l-[12px] border-l-blue-600">
             <h4 className="text-[10px] font-black uppercase text-blue-600 mb-3 tracking-widest">ANALISI METODO DEC</h4>
             <p className="text-base text-gray-700 leading-relaxed italic font-medium">"{selectedResult.feedback}"</p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-[11px] font-black uppercase text-gray-400 px-4 tracking-[0.2em]">TRAIETTORIA GUIDA</h4>
            <PathVisualizer path={selectedResult.path || []} errors={selectedResult.errors || []} />
          </div>

          <div className="space-y-4">
            {EVALUATION_CATEGORIES.map(cat => {
              const items = cat.items.filter(it => selectedResult.scores[it.id] && selectedResult.scores[it.id] !== Grade.UNSET);
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="bg-white rounded-[2.5rem] border overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-8 py-3 border-b text-[9px] font-black uppercase text-gray-400 tracking-widest">{cat.title}</div>
                  <div className="p-5 space-y-4">
                    {items.map(it => (
                      <div key={it.id} className="flex items-center justify-between">
                        <span className="font-bold text-gray-700 text-sm">{it.label}</span>
                        <div className={selectedResult.scores[it.id] === Grade.GOOD ? 'text-green-500' : selectedResult.scores[it.id] === Grade.WARNING ? 'text-amber-500' : 'text-red-500'}>
                          {selectedResult.scores[it.id] === Grade.GOOD ? <Circle size={24} fill="currentColor"/> : selectedResult.scores[it.id] === Grade.WARNING ? <Square size={24} fill="currentColor"/> : <Triangle size={24} fill="currentColor"/>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  if (view === 'SUMMARY' && selectedStudent) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 safe-top safe-bottom">
        <div className="bg-white w-full max-w-sm rounded-[4.5rem] shadow-[0_0_80px_rgba(59,130,246,0.2)] overflow-hidden text-center p-12 space-y-8 animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto shadow-[0_20px_40px_rgba(59,130,246,0.3)]"><CheckCircle2 size={48}/></div>
          <h2 className="text-3xl font-black uppercase tracking-tighter">REPORT PRONTO</h2>
          <div className="bg-gray-50 p-8 rounded-[2.5rem] border text-sm italic text-gray-600 leading-relaxed font-medium shadow-inner">
            {isGenerating ? 'L\'IA sta processando la guida...' : aiFeedback}
          </div>
          <button onClick={() => setView('DASHBOARD')} className="w-full py-6 bg-black text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] active:scale-95 transition-transform shadow-xl">SALVA NEL PROFILO</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-blue-600">
      <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full loader-spin mb-6"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Metodo DEC - Caricamento...</p>
    </div>
  );
}
