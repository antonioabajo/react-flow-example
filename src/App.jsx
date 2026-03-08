import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

// --- ICONOS SVG INTEGRADOS (Minimalistas y consistentes) ---
const Icon = ({ d, size = 20, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d={d} />
  </svg>
);

const CalendarIcon = (p) => (
  <Icon
    {...p}
    d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
  />
);
const UsersIcon = (p) => (
  <Icon
    {...p}
    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
  />
);
const AlertIcon = (p) => (
  <Icon
    {...p}
    d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"
  />
);
const TrashIcon = (p) => (
  <Icon
    {...p}
    d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  />
);
const CheckIcon = (p) => (
  <Icon {...p} d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" />
);
const PlusIcon = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const MapPinIcon = (p) => (
  <Icon
    {...p}
    d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  />
);
const LeftIcon = (p) => <Icon {...p} d="m15 18-6-6 6-6" />;
const RightIcon = (p) => <Icon {...p} d="m9 18 6-6-6-6" />;
const ListIcon = (p) => (
  <Icon {...p} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
);
const GridIcon = (p) => (
  <Icon {...p} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
);
const CloudIcon = (p) => (
  <Icon
    {...p}
    d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.4-1.9-4.3-4.3-4.5C16.9 6.8 13.7 4 10 4 6.7 4 4 6.7 4 10c-2.2.3-4 2.2-4 4.5C0 17 2 19 4.5 19"
  />
);
const CloudOffIcon = (p) => (
  <Icon
    {...p}
    d="m2 2 20 20M5.78 5.78l-.28.22C2.2 6.3 0 9.2 0 12.5 0 16.1 2.9 19 6.5 19h10.72M22.56 16.56A4.5 4.5 0 0 0 18 9c-.28 0-.56.03-.82.09C16.3 5.4 13.1 3 9.5 3c-.5 0-.98.05-1.44.15"
  />
);
const LoaderIcon = (p) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`animate-spin ${p.className}`}
  >
    <path d="M21 12a9 9 0 1 1-6.21-8.56" />
  </svg>
);
const CalendarDaysIcon = (p) => (
  <Icon
    {...p}
    d="M21 10H3M16 2v4M8 2v4M3 6h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
  />
);
const LockIcon = (p) => (
  <Icon
    {...p}
    d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z M7 11V7a5 5 0 0 1 10 0v4"
  />
);
const LogOutIcon = (p) => (
  <Icon
    {...p}
    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9"
  />
);
const SettingsIcon = (p) => (
  <Icon
    {...p}
    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
  />
);
const UserPlusIcon = (p) => (
  <Icon
    {...p}
    d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6"
  />
);
const XIcon = (p) => <Icon {...p} d="M18 6 6 18 M6 6l12 12" />;

// --- CONFIGURACIÓN BASE ---
const FALLBACK_USERS = [
  {
    id: 'carlos',
    name: 'Carlos',
    totalDays: 24,
    region: 'Asturias',
    color: 'bg-indigo-600',
    colorLight: 'bg-indigo-100',
    text: 'text-indigo-700',
  },
  {
    id: 'antonio',
    name: 'Antonio',
    totalDays: 24,
    region: 'Madrid',
    color: 'bg-emerald-600',
    colorLight: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  {
    id: 'ricardo',
    name: 'Ricardo',
    totalDays: 24,
    region: 'Granada',
    color: 'bg-violet-600',
    colorLight: 'bg-violet-100',
    text: 'text-violet-700',
  },
];

const TEAM_COLORS = [
  { bg: 'bg-indigo-600', light: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-violet-600', light: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-600', light: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-blue-600', light: 'bg-blue-100', text: 'text-blue-700' },
];

const HOLIDAYS_2026 = {
  Nacional: [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-06', name: 'Epifanía' },
    { date: '2026-04-03', name: 'Viernes Santo' },
    { date: '2026-05-01', name: 'Trabajo' },
    { date: '2026-08-15', name: 'Asunción' },
    { date: '2026-10-12', name: 'Fiesta Nacional' },
    { date: '2026-11-02', name: 'Todos los Santos' },
    { date: '2026-12-07', name: 'Constitución' },
    { date: '2026-12-08', name: 'Inmaculada' },
    { date: '2026-12-25', name: 'Navidad' },
  ],
  Madrid: [
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-05-02', name: 'Comunidad' },
    { date: '2026-05-15', name: 'San Isidro' },
    { date: '2026-11-09', name: 'La Almudena' },
  ],
  Asturias: [
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-09-08', name: 'Día de Asturias' },
  ],
  Granada: [
    { date: '2026-02-28', name: 'Día de Andalucía' },
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-05-26', name: 'Mariana Pineda' },
    { date: '2026-06-04', name: 'Corpus Christi' },
  ],
};

// --- COMPONENTES UI ---
// Función helper para extraer iniciales de un nombre
const getInitials = (name) => {
  return name.slice(0, 2).toUpperCase();
};

const CustomDatePicker = ({ label, value, onChange, userId, users }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(2026, 2, 1));

  useEffect(() => {
    if (value) setViewDate(new Date(value));
  }, [value]);

  const user = users.find((u) => u.id === userId);
  const region = user?.region;
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const renderDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    let offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = [];
    for (let i = 0; i < offset; i++) days.push(<div key={`e-${i}`} />);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        d
      ).padStart(2, '0')}`;
      const isNat = HOLIDAYS_2026.Nacional.find((h) => h.date === dateStr);
      const isReg = region
        ? HOLIDAYS_2026[region]?.find((h) => h.date === dateStr)
        : null;
      const isWeekend = [0, 6].includes(new Date(year, month, d).getDay());
      const isSelected = value === dateStr;

      let style = 'hover:bg-slate-100 text-slate-700';
      if (isSelected) style = 'bg-slate-900 text-white font-bold shadow-sm';
      else if (isNat)
        style = 'bg-rose-50 text-rose-600 font-semibold border border-rose-100';
      else if (isReg)
        style =
          'bg-amber-50 text-amber-700 font-semibold border border-amber-100';
      else if (isWeekend) style = 'bg-slate-50 text-slate-400';

      days.push(
        <button
          key={d}
          type="button"
          onClick={() => {
            onChange(dateStr);
            setIsOpen(false);
          }}
          className={`h-8 w-full rounded-md flex items-center justify-center text-xs transition-all ${style}`}
          title={isNat?.name || isReg?.name || ''}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 cursor-pointer flex justify-between items-center hover:bg-slate-50 hover:border-slate-300 transition-colors focus-within:ring-2 focus-within:ring-slate-200"
      >
        <span
          className={
            value
              ? 'text-slate-900 text-sm font-medium'
              : 'text-slate-400 text-sm'
          }
        >
          {value
            ? new Date(value).toLocaleDateString('es-ES')
            : 'Seleccionar fecha'}
        </span>
        <CalendarIcon size={16} className="text-slate-400" />
      </div>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute z-50 mt-2 bg-white border border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] rounded-2xl p-4 w-72 left-0 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={() =>
                  setViewDate(
                    new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
                  )
                }
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              >
                <LeftIcon size={16} />
              </button>
              <span className="font-semibold text-sm text-slate-800">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() =>
                  setViewDate(
                    new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
                  )
                }
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
              >
                <RightIcon size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-slate-400 text-center mb-2 uppercase tracking-wider">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
          </div>
        </>
      )}
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem('vacas_auth_pro') === 'true'
  );
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [isReady, setIsReady] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);

  const [users, setUsers] = useState([]);
  const [vacations, setVacations] = useState([]);

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newMemName, setNewMemName] = useState('');
  const [newMemDays, setNewMemDays] = useState(24);
  const [newMemRegion, setNewMemRegion] = useState('Nacional');

  const [newUser, setNewUser] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [viewMode, setViewMode] = useState('calendar');
  const [calUserFilter, setCalUserFilter] = useState('all');
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [db, setDb] = useState(null);
  const [cloudActive, setCloudActive] = useState(false);

  const STABLE_APP_ID = 'vacaciones-equipo-2026';

  useEffect(() => {
    if (users.length > 0 && !users.find((u) => u.id === newUser)) {
      setNewUser(users[0].id);
    }
  }, [users, newUser]);

  useEffect(() => {
    if (calUserFilter !== 'all' && !users.find((u) => u.id === calUserFilter)) {
      setCalUserFilter('all');
    }
  }, [users, calUserFilter]);

  useEffect(() => {
    const initProject = () => {
      if (!document.getElementById('tailwind-cdn')) {
        const script = document.createElement('script');
        script.id = 'tailwind-cdn';
        script.src = 'https://cdn.tailwindcss.com';
        document.head.appendChild(script);
      }

      const checkTailwind = setInterval(() => {
        if (window.tailwind) {
          setIsReady(true);
          clearInterval(checkTailwind);
        }
      }, 50);
    };
    initProject();

    let envConfig = {};
    try {
      envConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
      };
    } catch (e) {
      // Ignorar
    }

    const firebaseConfig = {
      apiKey: envConfig.apiKey,
      authDomain: envConfig.authDomain,
      projectId: envConfig.projectId,
      storageBucket: envConfig.storageBucket,
      messagingSenderId: envConfig.messagingSenderId,
      appId: envConfig.appId,
      measurementId: envConfig.measurementId,
    };

    try {
      if (!firebaseConfig.apiKey) {
        setCloudActive(false);
        setSessionUser({ uid: 'local-admin' });

        const savedVacations = localStorage.getItem('vacas_v_final_data_pro');
        if (savedVacations) setVacations(JSON.parse(savedVacations));

        const savedUsers = localStorage.getItem('vacas_team_pro');
        if (savedUsers) setUsers(JSON.parse(savedUsers));
        else setUsers(FALLBACK_USERS);
      } else {
        const fbApp =
          getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const fbAuth = getAuth(fbApp);
        const fbDb = getFirestore(fbApp);
        setDb(fbDb);
        setCloudActive(true);

        signInAnonymously(fbAuth)
          .then(() => onAuthStateChanged(fbAuth, setSessionUser))
          .catch((e) => {
            console.error('Error Auth Firebase:', e);
          });
      }
    } catch (e) {
      setCloudActive(false);
      setSessionUser({ uid: 'local-admin' });
    }
  }, []);

  useEffect(() => {
    if (!sessionUser || !cloudActive || !db) return;

    const pathVacs = collection(
      db,
      'artifacts',
      STABLE_APP_ID,
      'public',
      'data',
      'vacaciones'
    );
    const unsubscribeVacs = onSnapshot(
      pathVacs,
      (snapshot) => {
        setVacations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (e) => console.error(e)
    );

    const pathTeam = collection(
      db,
      'artifacts',
      STABLE_APP_ID,
      'public',
      'data',
      'team'
    );
    const unsubscribeTeam = onSnapshot(
      pathTeam,
      (snapshot) => {
        if (!snapshot.empty) {
          setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        } else {
          FALLBACK_USERS.forEach((u) => {
            setDoc(
              doc(
                db,
                'artifacts',
                STABLE_APP_ID,
                'public',
                'data',
                'team',
                u.id
              ),
              u
            );
          });
        }
      },
      (e) => console.error(e)
    );

    return () => {
      unsubscribeVacs();
      unsubscribeTeam();
    };
  }, [sessionUser, cloudActive, db]);

  useEffect(() => {
    if (!cloudActive) {
      localStorage.setItem('vacas_v_final_data_pro', JSON.stringify(vacations));
      localStorage.setItem('vacas_team_pro', JSON.stringify(users));
    }
  }, [vacations, users, cloudActive]);

  const userBalances = useMemo(() => {
    return users.map((u) => {
      const used = vacations
        .filter((v) => v.userId === u.id)
        .reduce((sum, v) => sum + v.days, 0);
      return { ...u, used, remaining: u.totalDays - used };
    });
  }, [vacations, users]);

  const calculateDays = (start, end, uid) => {
    let count = 0;
    let curr = new Date(start);
    const stop = new Date(end);
    const reg = users.find((u) => u.id === uid)?.region || 'Nacional';
    const holidays = [
      ...HOLIDAYS_2026.Nacional,
      ...(HOLIDAYS_2026[reg] || []),
    ].map((h) => h.date);
    while (curr <= stop) {
      const dStr = curr.toISOString().split('T')[0];
      if (![0, 6].includes(curr.getDay()) && !holidays.includes(dStr)) count++;
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStart || !newEnd)
      return setMsg({
        text: 'Por favor, selecciona las fechas.',
        type: 'error',
      });
    const days = calculateDays(newStart, newEnd, newUser);
    if (days <= 0)
      return setMsg({
        text: 'El rango no contiene días laborables válidos.',
        type: 'error',
      });
    const bal = userBalances.find((u) => u.id === newUser);
    if (bal.remaining < days)
      return setMsg({
        text: 'Días insuficientes en el balance.',
        type: 'error',
      });

    const entry = {
      userId: newUser,
      userName: bal.name,
      startDate: newStart,
      endDate: newEnd,
      days,
      status: 'Aprobado',
    };

    if (cloudActive && db) {
      try {
        const docRef = doc(
          collection(
            db,
            'artifacts',
            STABLE_APP_ID,
            'public',
            'data',
            'vacaciones'
          )
        );
        await setDoc(docRef, entry);
        setMsg({ text: 'Registro guardado exitosamente.', type: 'success' });
      } catch (err) {
        setMsg({
          text: 'Error de permisos en la base de datos.',
          type: 'error',
        });
      }
    } else {
      setVacations((prev) => [
        ...prev,
        { ...entry, id: Date.now().toString() },
      ]);
      setMsg({ text: 'Guardado en modo local.', type: 'success' });
    }
    setNewStart('');
    setNewEnd('');
    setCalUserFilter(newUser);
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const removeVaca = async (id) => {
    if (cloudActive && db)
      await deleteDoc(
        doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'vacaciones', id)
      );
    else setVacations((prev) => prev.filter((v) => v.id !== id));
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemName) return;

    const newId =
      newMemName.toLowerCase().replace(/[^a-z0-9]/g, '-') +
      '-' +
      Date.now().toString().slice(-4);
    const colorConf = TEAM_COLORS[users.length % TEAM_COLORS.length];

    const newMember = {
      id: newId,
      name: newMemName,
      totalDays: parseInt(newMemDays),
      region: newMemRegion,
      color: colorConf.bg,
      colorLight: colorConf.light,
      text: colorConf.text,
    };

    if (cloudActive && db) {
      await setDoc(
        doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'team', newId),
        newMember
      );
    } else {
      setUsers((prev) => [...prev, newMember]);
    }

    setNewMemName('');
    setNewMemDays(24);
    setNewMemRegion('Nacional');
  };

  const handleRemoveMember = async (id) => {
    if (users.length <= 1) return;
    if (cloudActive && db) {
      await deleteDoc(
        doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'team', id)
      );
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'equipo2026') {
      setIsLoggedIn(true);
      localStorage.setItem('vacas_auth_pro', 'true');
      setLoginError('');
    } else {
      setLoginError('Contraseña incorrecta. Inténtalo de nuevo.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setPassword('');
    localStorage.removeItem('vacas_auth_pro');
  };

  const handleUserCardClick = (userId) => {
    setCalUserFilter(userId);
    setViewMode('calendar');
  };

  const renderCalendarView = () => {
    const months = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Visor de Calendario
          </span>
          <select
            value={calUserFilter}
            onChange={(e) => setCalUserFilter(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none font-medium text-slate-800 cursor-pointer focus:ring-2 focus:ring-slate-200 transition-all"
          >
            <option value="all">Todo el equipo</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {months.map((mName, mIdx) => {
            const daysInMonth = new Date(2026, mIdx + 1, 0).getDate();
            const first = new Date(2026, mIdx, 1).getDay();
            let offset = first === 0 ? 6 : first - 1;
            const grid = [];
            for (let i = 0; i < offset; i++)
              grid.push(<div key={`off-${i}`} />);
            for (let d = 1; d <= daysInMonth; d++) {
              const dStr = `2026-${String(mIdx + 1).padStart(2, '0')}-${String(
                d
              ).padStart(2, '0')}`;
              const isToday = dStr === '2026-03-08';
              const isSun = new Date(2026, mIdx, d).getDay() === 0;
              const isNat = HOLIDAYS_2026.Nacional.some((h) => h.date === dStr);
              const activeVacs = vacations.filter(
                (v) => dStr >= v.startDate && dStr <= v.endDate
              );
              const userOnVaca = activeVacs.find(
                (v) => v.userId === calUserFilter
              );

              let cellStyle = 'text-slate-600';
              if (isSun || isNat)
                cellStyle =
                  'text-rose-500 font-semibold bg-rose-50/50 rounded-md';
              let bg = '';
              if (calUserFilter !== 'all' && userOnVaca)
                bg = `${
                  users.find((u) => u.id === calUserFilter)?.color
                } rounded-md shadow-sm`;
              else if (isToday)
                bg = 'ring-2 ring-slate-900 ring-inset rounded-md';

              grid.push(
                <div
                  key={d}
                  className={`h-9 flex flex-col items-center justify-center relative transition-all ${bg} ${
                    bg && calUserFilter !== 'all' ? 'text-white' : ''
                  }`}
                >
                  <span
                    className={`text-xs ${cellStyle} ${
                      bg && calUserFilter !== 'all' ? 'text-white' : ''
                    }`}
                  >
                    {d}
                  </span>
                  {calUserFilter === 'all' && activeVacs.length > 0 && (
                    <div className="flex gap-0.5 absolute bottom-1">
                      {activeVacs.map((v) => {
                        const uColor =
                          users.find((u) => u.id === v.userId)?.color ||
                          'bg-slate-400';
                        return (
                          <div
                            key={`${v.id}-${v.userId}`}
                            className={`w-1.5 h-1.5 rounded-full ${uColor}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={mName}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="bg-slate-50 py-3 text-center text-xs font-semibold border-b border-slate-100 uppercase tracking-widest text-slate-500">
                  {mName}
                </div>
                <div className="p-4 flex-1">
                  <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-slate-400 text-center mb-2 uppercase">
                    {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((h) => (
                      <div key={h}>{h}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">{grid}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isReady)
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-[9999]">
        <LoaderIcon className="text-slate-900 mb-4" size={32} />
        <p className="text-slate-500 font-medium text-sm tracking-wide animate-pulse">
          Cargando entorno...
        </p>
      </div>
    );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 w-full max-w-sm animate-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-slate-900 p-4 rounded-2xl mb-6 shadow-lg">
              <LockIcon className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Portal del Equipo
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Inicia sesión con la clave compartida para gestionar las
              vacaciones.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña de acceso"
                className="w-full border border-slate-200 rounded-xl p-3.5 text-center text-sm font-medium text-slate-800 outline-none focus:bg-slate-50 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-400"
              />
              {loginError && (
                <p className="text-rose-500 text-xs font-medium text-center mt-3 animate-in slide-in-from-top-1">
                  {loginError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all shadow-md active:scale-[0.98]"
            >
              Acceder al panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 selection:bg-slate-200">
      {/* MODAL DE EQUIPO */}
      {showTeamModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <UsersIcon size={18} className="text-slate-700" />
                </div>
                Gestión de Miembros
              </h2>
              <button
                onClick={() => setShowTeamModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8 bg-slate-50/50">
              <form
                onSubmit={handleAddMember}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-slate-800 mb-4">
                  Añadir nuevo integrante
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. Marta"
                      value={newMemName}
                      onChange={(e) => setNewMemName(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Días anuales
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={newMemDays}
                      onChange={(e) => setNewMemDays(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Región (Festivos)
                    </label>
                    <select
                      value={newMemRegion}
                      onChange={(e) => setNewMemRegion(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all bg-white"
                    >
                      {Object.keys(HOLIDAYS_2026).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-5 w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <UserPlusIcon size={16} /> Confirmar alta
                </button>
              </form>

              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">
                  Directorio actual ({users.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${u.color} shadow-sm`}
                        >
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-slate-900 leading-tight">
                            {u.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {u.region} · {u.totalDays} d.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(u.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors"
                        title="Dar de baja"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN SUPERIOR */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg">
              <CalendarIcon className="text-white" size={20} />
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight hidden sm:block">
              Planificador
            </h1>

            <div className="hidden sm:flex items-center ml-4 pl-4 border-l border-slate-200">
              {cloudActive ? (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                  <CloudIcon size={12} /> Sincronizado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">
                  <CloudOffIcon size={12} /> Modo Local
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTeamModal(true)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
            >
              <SettingsIcon size={16} />{' '}
              <span className="hidden sm:inline">Equipo</span>
            </button>
            <div className="w-px h-5 bg-slate-200"></div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOutIcon size={16} />{' '}
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* TARJETAS DE RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {userBalances.map((u) => (
            <div
              key={u.id}
              onClick={() => handleUserCardClick(u.id)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] cursor-pointer hover:border-slate-300 hover:shadow-md transition-all group flex flex-col justify-between h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner ${u.color}`}
                  >
                    {getInitials(u.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                      {u.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{u.region}</p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-end justify-between mb-2">
                  <div className="text-3xl font-bold text-slate-900 tracking-tight leading-none">
                    {u.remaining}
                  </div>
                  <div className="text-xs font-medium text-slate-500 mb-1">
                    días libres
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`${u.color} h-full rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${(u.used / u.totalDays) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-20">
          {/* PANEL IZQUIERDO: FORMULARIO */}
          <section className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] lg:sticky lg:top-24">
            <h2 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
              <PlusIcon size={18} className="text-slate-400" /> Nuevo Registro
            </h2>

            {msg.text && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 mb-5 animate-in slide-in-from-top-2 border ${
                  msg.type === 'error'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {msg.type === 'error' ? (
                  <AlertIcon size={16} />
                ) : (
                  <CheckIcon size={16} />
                )}{' '}
                {msg.text}
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Miembro del equipo
                </label>
                <select
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50/50 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all cursor-pointer"
                >
                  {users.length === 0 && (
                    <option value="">No hay miembros...</option>
                  )}
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <CustomDatePicker
                label="Inicio de vacaciones"
                value={newStart}
                onChange={setNewStart}
                userId={newUser}
                users={users}
              />
              <CustomDatePicker
                label="Fin de vacaciones"
                value={newEnd}
                onChange={setNewEnd}
                userId={newUser}
                users={users}
              />

              <button
                type="submit"
                disabled={users.length === 0}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all shadow-md active:scale-[0.98] mt-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                Guardar fechas
              </button>
            </form>
          </section>

          {/* PANEL DERECHO: VISTAS DE DATOS */}
          <section className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden min-h-[500px] flex flex-col">
            {/* Controles Segmentados (Estilo macOS) */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800">
                Visualización
              </h2>
              <div className="flex bg-slate-200/60 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <ListIcon size={14} /> Lista
                </button>
                <button
                  onClick={() => setViewMode('gantt')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'gantt'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <CalendarDaysIcon size={14} /> Gantt
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <GridIcon size={14} /> Calendario
                </button>
              </div>
            </div>

            <div className="p-6 flex-1">
              {viewMode === 'list' && (
                <div className="overflow-x-auto animate-in fade-in duration-300">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100">
                        <th className="pb-3 px-2">Empleado</th>
                        <th className="pb-3">Periodo</th>
                        <th className="pb-3 text-center">Días Consumidos</th>
                        <th className="pb-3 text-right pr-2">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vacations.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            className="py-20 text-center text-slate-400 text-sm font-medium"
                          >
                            No hay vacaciones registradas
                          </td>
                        </tr>
                      ) : (
                        vacations
                          .sort(
                            (a, b) =>
                              new Date(a.startDate) - new Date(b.startDate)
                          )
                          .map((v) => {
                            const uColor =
                              users.find((u) => u.id === v.userId)?.color ||
                              'bg-slate-300';
                            return (
                              <tr
                                key={v.id}
                                className="hover:bg-slate-50/50 transition-colors group"
                              >
                                <td className="py-4 px-2">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-2.5 h-2.5 rounded-full ${uColor}`}
                                    />
                                    <span className="font-medium text-slate-800 text-sm">
                                      {v.userName}
                                    </span>
                                  </div>
                                </td>
                                <td className="text-sm text-slate-600">
                                  {new Date(v.startDate).toLocaleDateString(
                                    'es-ES',
                                    { day: '2-digit', month: 'short' }
                                  )}{' '}
                                  <span className="text-slate-300 mx-1">→</span>{' '}
                                  {new Date(v.endDate).toLocaleDateString(
                                    'es-ES',
                                    { day: '2-digit', month: 'short' }
                                  )}
                                </td>
                                <td className="text-center">
                                  <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200">
                                    {v.days}
                                  </span>
                                </td>
                                <td className="text-right pr-2">
                                  <button
                                    onClick={() => removeVaca(v.id)}
                                    className="text-slate-300 hover:text-rose-600 p-2 rounded-md hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                                  >
                                    <TrashIcon size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {viewMode === 'gantt' && (
                <div className="overflow-x-auto pb-4 scrollbar-hide animate-in fade-in duration-300 border border-slate-200 rounded-xl">
                  <div className="min-w-[900px] bg-white">
                    <div className="flex border-b border-slate-200 bg-slate-50">
                      <div className="w-48 shrink-0 sticky left-0 z-20 bg-slate-50 border-r border-slate-200 p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                        Miembros
                      </div>
                      <div className="flex-1 grid grid-cols-12 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider divide-x divide-slate-200">
                        {[
                          'Ene',
                          'Feb',
                          'Mar',
                          'Abr',
                          'May',
                          'Jun',
                          'Jul',
                          'Ago',
                          'Sep',
                          'Oct',
                          'Nov',
                          'Dic',
                        ].map((m) => (
                          <div key={m} className="py-3">
                            {m}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 relative">
                      {/* Grid de fondo */}
                      <div className="absolute inset-0 flex pl-48 pointer-events-none">
                        <div className="flex-1 grid grid-cols-12 divide-x divide-slate-100/50">
                          {[...Array(12)].map((_, i) => (
                            <div key={i} className="h-full" />
                          ))}
                        </div>
                      </div>

                      {users.map((u) => (
                        <div
                          key={u.id}
                          className="flex h-14 items-center group hover:bg-slate-50/50 transition-colors relative z-10"
                        >
                          <div className="w-48 shrink-0 sticky left-0 z-20 bg-white group-hover:bg-slate-50/50 border-r border-slate-200 p-3 flex items-center gap-3 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${u.color}`}
                            >
                              {getInitials(u.name)}
                            </span>
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {u.name}
                            </span>
                          </div>
                          <div className="flex-1 h-full relative mx-3">
                            {vacations
                              .filter((v) => v.userId === u.id)
                              .map((v) => {
                                const start = new Date(v.startDate);
                                const end = new Date(v.endDate);
                                const totalMs =
                                  new Date(2026, 11, 31) - new Date(2026, 0, 1);
                                const left =
                                  ((start - new Date(2026, 0, 1)) / totalMs) *
                                  100;
                                const width =
                                  ((end - start) / totalMs) * 100 + 0.5;
                                return (
                                  <div
                                    key={v.id}
                                    className={`absolute top-1/2 -translate-y-1/2 h-6 ${u.color} rounded-md shadow-sm cursor-help hover:brightness-110 transition-all z-10 border border-black/10`}
                                    style={{
                                      left: `${left}%`,
                                      width: `${width}%`,
                                    }}
                                    title={`${v.userName}: ${new Date(
                                      v.startDate
                                    ).toLocaleDateString()} al ${new Date(
                                      v.endDate
                                    ).toLocaleDateString()}`}
                                  />
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'calendar' && renderCalendarView()}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
