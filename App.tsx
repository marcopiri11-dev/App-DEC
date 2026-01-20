
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, X, Navigation, Briefcase, GraduationCap, 
  QrCode, Smartphone, LogOut, UserPlus, AlertCircle, Share2, 
  CheckCircle2, Circle, Square, Triangle, ShieldAlert, Wifi, Info, Laptop, MapPin, Copy, Check, Download, MessageSquare, Phone, Search, Users, TrendingUp, Calendar
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

export default function App() {
  const [view, setView] = useState<'HOME' | 'LIST' | 'DASHBOARD' | 'EVALUATION' | 'SUMMARY' | 'HISTORY_DETAIL'>('HOME');
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
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<PathPoint | null>(null);

  useEffect(() => {
    safeStorage.setItem('driving_history', JSON.stringify(history));
    safeStorage.setItem('driving_students', JSON.stringify(students));
  }, [history, students]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const found = students.find(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (found) {
      setSelectedStudent(found);
      setView('DASHBOARD');
      setSearchTerm('');
    } else {
      alert("Nessun allievo trovato con questo nome.");
    }
  };

  const sendWhatsApp = (result: EvaluationResult) => {
    if (!selectedStudent?.phoneNumber) {
      alert("Nessun numero di telefono inserito per questo allievo.");
      return;
    }
    const dateStr = new Date(result.date).toLocaleDateString();
    const message = `Ciao ${selectedStudent.name}, ecco il report Metodo DEC della tua guida del ${dateStr}:\n\n${result.feedback || "Ottima guida!"}`;
    const encoded = encodeURIComponent(message);
    const cleanPhone = selectedStudent.phoneNumber.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('39') ? cleanPhone : `39${cleanPhone}`;
    window.open(`https://wa.me/${finalPhone}?text=${encoded}`, '_blank');
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

  if (view === 'HOME') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col font-sans text-white safe-top p-6 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center space-y-10">
          {/* Logo Section */}
          <div className="relative text-center animate-in fade-in zoom-in duration-700">
            <div className="absolute inset-0 bg-blue-600 blur-[120px] opacity-20"></div>
            <h1 className="text-7xl font-black uppercase tracking-tighter relative z-10 leading-none">METODO DEC</h1>
            <p className="text-[14px] font-black uppercase tracking-[0.5em] text-blue-500 mt-4">Professional Coaching</p>
          </div>

          {/* Quick Stats Grid */}
          <div className="w-full max-w-sm grid grid-cols-2 gap-4 animate-in slide-in-from-bottom duration-500 delay-100">
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 text-center backdrop-blur-sm">
              <div className="flex justify-center mb-2 text-blue-400"><Users size={20}/></div>
              <p className="text-2xl font-black leading-none">{students.length}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mt-1">Allievi Totali</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 text-center backdrop-blur-sm">
              <div className="flex justify-center mb-2 text-green-400"><TrendingUp size={20}/></div>
              <p className="text-2xl font-black leading-none">{history.length}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mt-1">Guide Gestite</p>
            </div>
          </div>

          {/* Search Bar - iPhone Style */}
          <form onSubmit={handleSearch} className="w-full max-w-sm relative group animate-in slide-in-from-bottom duration-500 delay-200">
            <div className="absolute inset-0 bg-blue-600/30 blur-2xl group-focus-within:bg-blue-600/50 transition-all rounded-[2.5rem]"></div>
            <div className="relative flex items-center bg-white rounded-[2.5rem] p-1.5 shadow-2xl">
              <div className="pl-5 text-gray-400"><Search size={20} /></div>
              <input 
                type="text" 
                placeholder="Nome allievo..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none px-4 py-4 font-bold text-black placeholder:text-gray-300 text-lg"
              />
              <button type="submit" className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <TrendingUp size={24} className="rotate-90"/>
              </button>
            </div>
          </form>

          {/* Action Buttons */}
          <div className="w-full max-w-sm grid grid-cols-1 gap-4 animate-in slide-in-from-bottom duration-500 delay-300">
            <button 
              onClick={() => setView('LIST')} 
              className="w-full bg-white text-black p-6 rounded-[2.5rem] flex items-center gap-5 active:scale-95 transition-all shadow-xl group"
            >
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Briefcase size={28}/>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-black uppercase leading-none">Area Gestione</h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Accedi al database</p>
              </div>
            </button>
          </div>
        </div>

        <div className="text-center py-6 opacity-30 mt-auto">
          <p className="text-[10px] font-black uppercase tracking-widest">v2.1 Gold Edition</p>
        </div>

        {/* Modal Aggiunta */}
        {showAddStudent && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-end sm:items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-t-[4rem] sm:rounded-[4rem] p-12 w-full max-w-md animate-in slide-in-from-bottom duration-500">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-8 sm:hidden"></div>
              <h3 className="text-3xl font-black mb-8 uppercase tracking-tighter text-black">Nuovo Profilo</h3>
              <div className="space-y-6 mb-10">
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-gray-400 ml-2">Identità Allievo</label>
                  <input 
                    type="text" 
                    placeholder="Nome e Cognome" 
                    value={newStudentName}
                    onChange={e => setNewStudentName(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-[2rem] font-bold outline-none focus:border-blue-500 text-black transition-all text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase text-gray-400 ml-2">Contatto Rapido (WhatsApp)</label>
                  <input 
                    type="tel" 
                    placeholder="Numero Cellulare" 
                    value={newStudentPhone}
                    onChange={e => setNewStudentPhone(e.target.value)}
                    className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-[2rem] font-bold outline-none focus:border-green-500 text-black transition-all text-lg"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowAddStudent(false)} className="flex-1 py-5 font-black text-gray-400 uppercase tracking-widest text-xs">Indietro</button>
                <button onClick={() => {
                  if (!newStudentName.trim()) return;
                  const n: Student = {
                    id: Date.now().toString(),
                    name: newStudentName,
                    phoneNumber: newStudentPhone,
                    licenseType: 'B',
                    totalHours: 0,
                    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${newStudentName}&backgroundColor=3b82f6`
                  };
                  setStudents([...students, n]);
                  setNewStudentName('');
                  setNewStudentPhone('');
                  setShowAddStudent(false);
                  setSelectedStudent(n);
                  setView('DASHBOARD');
                }} className="flex-2 px-10 py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-600/30 uppercase tracking-widest text-xs">Crea Allievo</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'LIST') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col safe-top">
        <header className="bg-white p-6 border-b flex items-center justify-between shadow-sm sticky top-0 z-50">
          <button onClick={() => setView('HOME')} className="p-3 bg-gray-100 rounded-2xl active:scale-90 transition-all"><ChevronLeft/></button>
          <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-tighter leading-none text-blue-600">Database</h1>
            <p className="text-[9px] font-black uppercase text-gray-400 mt-1">Seleziona un allievo</p>
          </div>
          <button onClick={() => setShowAddStudent(true)} className="w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-center active:scale-90 transition-all"><UserPlus size={24}/></button>
        </header>
        <main className="p-6 space-y-4 max-w-2xl mx-auto w-full overflow-y-auto">
          {students.length === 0 ? (
             <div className="py-20 text-center text-gray-400 space-y-4">
               <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto opacity-50"><Users size={40}/></div>
               <p className="font-bold uppercase text-[10px] tracking-widest">Nessun allievo in archivio</p>
             </div>
          ) : students.map(s => <StudentCard key={s.id} student={s} isSelected={false} onClick={() => {setSelectedStudent(s); setView('DASHBOARD');}} />)}
        </main>
      </div>
    );
  }

  if (view === 'DASHBOARD' && selectedStudent) {
    const studentHistory = history.filter(h => h.studentId === selectedStudent.id);
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col safe-top">
        <header className="bg-white p-6 border-b flex items-center justify-between shadow-sm sticky top-0 z-50">
          <button onClick={() => setView('LIST')} className="p-3 bg-gray-100 rounded-2xl active:scale-90 transition-all"><ChevronLeft/></button>
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tighter leading-none">{selectedStudent.name}</h2>
            <p className="text-[9px] font-black uppercase text-blue-600 mt-1">Scheda Personale</p>
          </div>
          <div className="w-12"></div>
        </header>
        <main className="p-6 space-y-6 max-w-2xl mx-auto w-full pb-32">
          <button onClick={() => {setView('EVALUATION'); startTracking();}} className="w-full py-12 bg-blue-600 text-white rounded-[3.5rem] shadow-[0_25px_60px_rgba(59,130,246,0.3)] flex flex-col items-center gap-4 active:scale-95 transition-all">
            <Navigation size={56} className="animate-bounce"/><h3 className="text-2xl font-black uppercase tracking-tight">NUOVA GUIDA</h3>
          </button>
          
          <div className="bg-white p-10 rounded-[3.5rem] border shadow-sm grid grid-cols-2 gap-4">
            <div className="text-center border-r-2 border-gray-50">
              <p className="text-4xl font-black text-blue-600 leading-none">{studentHistory.length}</p>
              <p className="text-[10px] font-black uppercase text-gray-400 mt-2 tracking-widest">REPORT</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-gray-900 leading-none">{selectedStudent.totalHours}</p>
              <p className="text-[10px] font-black uppercase text-gray-400 mt-2 tracking-widest">ORE</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <h4 className="text-[11px] font-black uppercase text-gray-400 tracking-[0.2em]">LOG ATTIVITÀ</h4>
              <Calendar size={14} className="text-gray-300"/>
            </div>
            {studentHistory.length === 0 ? (
               <div className="bg-white p-10 rounded-[2.5rem] border border-dashed border-gray-200 text-center">
                 <p className="text-[10px] font-black text-gray-300 uppercase italic">Nessuna guida registrata ancora</p>
               </div>
            ) : studentHistory.map((res, i) => (
              <button key={i} onClick={() => {setSelectedResult(res); setView('HISTORY_DETAIL');}} className="w-full bg-white p-6 rounded-[2.5rem] border border-gray-100 flex items-center justify-between active:bg-gray-50 shadow-sm transition-all hover:shadow-md">
                <div className="text-left">
                  <p className="text-base font-black text-blue-600">{new Date(res.date).toLocaleDateString()}</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase truncate max-w-[200px] mt-1">{res.feedback || "Analisi completata"}</p>
                </div>
                <div className="flex items-center gap-3">
                   {res.errors && res.errors.length > 0 && <div className="bg-red-50 text-red-600 text-[10px] font-black px-2.5 py-1.5 rounded-xl border border-red-100">! {res.errors.length}</div>}
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
      <div className={`min-h-screen flex flex-col safe-top transition-colors duration-500 ${isFlashing ? 'bg-red-100' : 'bg-gray-50'}`}>
        <header className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-50 shadow-sm backdrop-blur-md bg-white/90">
          <button onClick={() => {stopTracking(); setView('DASHBOARD');}} className="p-3 text-gray-300 active:scale-90 transition-all"><X size={32}/></button>
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${gpsStatus === 'ACTIVE' ? 'bg-green-500' : 'bg-red-600'} animate-pulse`}></div>
              <p className={`text-[9px] font-black uppercase ${gpsStatus === 'ACTIVE' ? 'text-green-600' : 'text-gray-400'}`}>TRACCIAMENTO {gpsStatus}</p>
            </div>
            <h4 className="font-black text-xl tracking-tighter">{selectedStudent.name}</h4>
          </div>
          <button onClick={handleFinish} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase shadow-xl active:scale-95 transition-all">STOP</button>
        </header>

        <main className="p-4 pb-96 space-y-6 max-w-3xl mx-auto w-full overflow-y-auto">
          {EVALUATION_CATEGORIES.map(cat => (
            <div key={cat.id} className="bg-white rounded-[3rem] border shadow-sm overflow-hidden border-gray-100">
              <div className="bg-gray-50 px-10 py-5 border-b text-[11px] font-black uppercase text-gray-400 tracking-[0.3em]">{cat.title}</div>
              <div className="p-4">
                {cat.items.map(it => <TrafficLightInput key={it.id} label={it.label} value={scores[it.id] || Grade.UNSET} onChange={g => setScores(prev => ({...prev, [it.id]: g}))} />)}
              </div>
            </div>
          ))}
        </main>

        {/* Emergency Panic Button */}
        <div className="fixed bottom-12 left-0 w-full flex justify-center z-[100] px-8">
          <button 
            onClick={() => {
              const timestamp = Date.now();
              setIsFlashing(true);
              setTimeout(() => setIsFlashing(false), 500);
              const location = lastPosRef.current || { lat: 0, lng: 0, timestamp };
              const newError: ErrorEvent = {
                id: Math.random().toString(36).substr(2, 9),
                location,
                note: "Intervento critico istruttore",
                timestamp
              };
              setCurrentErrors(prev => [...prev, newError]);
              if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
            }}
            className="w-full py-14 bg-red-600 text-white rounded-[4rem] shadow-[0_30px_70px_rgba(220,38,38,0.5)] border-[12px] border-white active:scale-90 transition-all flex items-center justify-center gap-6"
          >
            <ShieldAlert size={56} className="animate-pulse" />
            <div className="text-left">
              <span className="block text-3xl font-black uppercase tracking-tighter leading-none">ERRORE GRAVE</span>
              <span className="text-[12px] font-bold uppercase opacity-60 tracking-widest mt-1">Intervento Istruttore</span>
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
          <button onClick={() => setView('DASHBOARD')} className="p-3 bg-gray-100 rounded-2xl active:scale-90 transition-all"><ChevronLeft/></button>
          <h2 className="text-xl font-black uppercase tracking-tight">{new Date(selectedResult.date).toLocaleDateString()}</h2>
          <div className="flex gap-3">
            <button onClick={() => sendWhatsApp(selectedResult)} className="p-4 bg-green-500 text-white rounded-2xl shadow-xl shadow-green-500/20 active:scale-90 transition-all"><MessageSquare size={24}/></button>
            <button onClick={() => {
              const text = `Report Metodo DEC - ${new Date(selectedResult.date).toLocaleDateString()}\nAllievo: ${selectedStudent?.name}\n\n${selectedResult.feedback}`;
              if (navigator.share) navigator.share({ title: 'Metodo DEC Report', text });
            }} className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all"><Share2 size={24}/></button>
          </div>
        </header>
        <main className="p-6 space-y-8 max-w-2xl mx-auto w-full pb-32 overflow-y-auto animate-in slide-in-from-bottom duration-500">
          <div className="bg-white p-10 rounded-[3.5rem] border shadow-sm border-l-[16px] border-l-blue-600">
             <div className="flex items-center gap-2 mb-4">
               <TrendingUp size={18} className="text-blue-600" />
               <h4 className="text-[11px] font-black uppercase text-blue-600 tracking-widest">FEEDBACK EVOLUTIVO</h4>
             </div>
             <p className="text-lg text-gray-700 leading-relaxed italic font-medium">"{selectedResult.feedback}"</p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-[12px] font-black uppercase text-gray-400 px-6 tracking-[0.3em]">ANALISI GEOGRAFICA</h4>
            <PathVisualizer path={selectedResult.path || []} errors={selectedResult.errors || []} />
          </div>

          <div className="space-y-4">
            {EVALUATION_CATEGORIES.map(cat => {
              const items = cat.items.filter(it => selectedResult.scores[it.id] && selectedResult.scores[it.id] !== Grade.UNSET);
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="bg-white rounded-[3.5rem] border overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-10 py-5 border-b text-[10px] font-black uppercase text-gray-400 tracking-widest">{cat.title}</div>
                  <div className="p-8 space-y-5">
                    {items.map(it => (
                      <div key={it.id} className="flex items-center justify-between">
                        <span className="font-bold text-gray-700 text-lg">{it.label}</span>
                        <div className={selectedResult.scores[it.id] === Grade.GOOD ? 'text-green-500' : selectedResult.scores[it.id] === Grade.WARNING ? 'text-amber-500' : 'text-red-500'}>
                          {selectedResult.scores[it.id] === Grade.GOOD ? <Circle size={32} fill="currentColor"/> : selectedResult.scores[it.id] === Grade.WARNING ? <Square size={32} fill="currentColor"/> : <Triangle size={32} fill="currentColor"/>}
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
        <div className="bg-white w-full max-w-md rounded-[5rem] shadow-2xl overflow-hidden text-center p-14 space-y-10 animate-in zoom-in duration-500">
          <div className="w-28 h-28 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-blue-600/40 scale-110"><CheckCircle2 size={56}/></div>
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-black">ANALISI IA</h2>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Metodo DEC v2.1</p>
          </div>
          <div className="bg-gray-50 p-10 rounded-[3.5rem] border text-lg italic text-gray-600 leading-relaxed font-medium shadow-inner">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full loader-spin"></div>
                <p className="font-black text-[11px] uppercase tracking-widest text-blue-600">Generazione Report...</p>
              </div>
            ) : aiFeedback}
          </div>
          <button onClick={() => setView('DASHBOARD')} className="w-full py-8 bg-black text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] active:scale-95 transition-all shadow-2xl">Archivia Report</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-blue-600">
      <div className="w-14 h-14 border-4 border-current border-t-transparent rounded-full loader-spin mb-8 shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
      <p className="text-[11px] font-black uppercase tracking-[0.4em] animate-pulse">Inizializzazione Metodo DEC...</p>
    </div>
  );
}
