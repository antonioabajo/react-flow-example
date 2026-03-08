import React, { useState, useRef, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { 
  PhoneCall, 
  Play, 
  Split, 
  LogOut, 
  Plus, 
  Settings2, 
  Save, 
  MousePointer2,
  Trash2,
  Zap,
  Loader2,
  ChevronRight,
  Lock,
  Cloud,
  CloudOff,
  ArrowLeft,
  LayoutGrid,
  FileCode,
  Calendar,
  ChevronRight as ChevronIcon,
  WifiOff,
  UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- CONFIGURACIÓN Y UTILIDADES ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const NODE_TYPES = {
  START: 'start',
  AUDIO: 'audio',
  CHOICE: 'choice',
  END: 'end'
};

const RAW_APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'callflow-architect-2026';
const STABLE_APP_ID = RAW_APP_ID.replace(/\//g, '_');

const getIconForType = (type) => {
  switch (type) {
    case NODE_TYPES.START: return Play;
    case NODE_TYPES.AUDIO: return PhoneCall;
    case NODE_TYPES.CHOICE: return Split;
    case NODE_TYPES.END: return LogOut;
    default: return Zap;
  }
};

const getNodeTheme = (type) => {
  switch (type) {
    case NODE_TYPES.START: return { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', stroke: '#10b981' };
    case NODE_TYPES.AUDIO: return { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', stroke: '#3b82f6' };
    case NODE_TYPES.CHOICE: return { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', stroke: '#a855f7' };
    case NODE_TYPES.END: return { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', stroke: '#f43f5e' };
    default: return { bg: 'bg-slate-500', light: 'bg-slate-50', text: 'text-slate-600', stroke: '#64748b' };
  }
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('callflow_auth') === 'true');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  
  const [flows, setFlows] = useState([]);
  const [currentFlowId, setCurrentFlowId] = useState(null);
  const [newFlowName, setNewFlowName] = useState('');

  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  
  const [activeNodeId, setActiveNodeId] = useState(null); 
  const [connectingNode, setConnectingNode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // Estado para mostrar feedback visual al guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const canvasRef = useRef(null);
  const dragState = useRef({
    isDragging: false,
    nodeId: null,
    startX: 0,
    startY: 0,
    initialNodeX: 0,
    initialNodeY: 0,
    hasMoved: false 
  });
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [db, setDb] = useState(null);
  const [forcedOffline, setForcedOffline] = useState(() => localStorage.getItem('cf_forced_offline') === 'true');
  const [cloudActive, setCloudActive] = useState(false);

  // 1. Inicialización
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

    const initFirebase = async () => {
      if (forcedOffline) {
          setCloudActive(false);
          setUser({ uid: 'local-admin' });
          loadLocalFlows();
          return;
      }

      let envConfig = {};
      try {
        envConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID
        };
      } catch (e) {}

      const firebaseConfig = envConfig.apiKey ? envConfig : (typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null);
      
      if (firebaseConfig && firebaseConfig.apiKey) {
        try {
          const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
          const auth = getAuth(app);
          const firestore = getFirestore(app);
          setDb(firestore);

          try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
              await signInWithCustomToken(auth, __initial_auth_token);
            } else {
              await signInAnonymously(auth);
            }
            setCloudActive(true);
            onAuthStateChanged(auth, async (u) => {
                if(u) {
                    setUser(u);
                    // Cargar datos desde la nube una vez al conectar
                    await fetchCloudFlows(firestore);
                } else {
                    setUser({ uid: 'local-admin' });
                    loadLocalFlows();
                }
            });
          } catch (authErr) {
            setCloudActive(false);
            setUser({ uid: 'local-admin' });
            loadLocalFlows();
          }
        } catch (e) {
          setCloudActive(false);
          setUser({ uid: 'local-admin' });
          loadLocalFlows();
        }
      } else {
        setCloudActive(false);
        setUser({ uid: 'local-admin' });
        loadLocalFlows();
      }
    };
    
    initFirebase();
  }, [forcedOffline]);

  // Funciones de carga inicial
  const loadLocalFlows = () => {
    const savedFlows = localStorage.getItem('cf_flows_list_v5');
    if (savedFlows) setFlows(JSON.parse(savedFlows));
  };

  const fetchCloudFlows = async (firestoreDb) => {
      try {
          const flowsSnap = await getDocs(collection(firestoreDb, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows'));
          const cloudFlows = flowsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setFlows(cloudFlows);
          // Guardamos también en local como respaldo
          localStorage.setItem('cf_flows_list_v5', JSON.stringify(cloudFlows));
      } catch(e) {
          console.warn("No se pudieron cargar flujos de la nube. Usando local.", e);
          loadLocalFlows();
          setCloudActive(false);
      }
  };

  const toggleOfflineMode = () => {
      const newOfflineState = !forcedOffline;
      setForcedOffline(newOfflineState);
      localStorage.setItem('cf_forced_offline', newOfflineState.toString());
      if (!newOfflineState) {
          window.location.reload();
      } else {
          setCloudActive(false);
      }
  };

  // 3. Persistencia Local Constante (El estado principal es local)
  useEffect(() => {
    if (isReady && !dragState.current.isDragging) {
      localStorage.setItem('cf_flows_list_v5', JSON.stringify(flows));
      if (currentFlowId) {
        localStorage.setItem(`cf_nodes_v5_${currentFlowId}`, JSON.stringify(nodes));
        localStorage.setItem(`cf_conns_v5_${currentFlowId}`, JSON.stringify(connections));
      }
    }
  }, [flows, nodes, connections, isReady, currentFlowId]);

  // --- SINCRONIZACIÓN MANUAL CON LA NUBE ---
  const syncToCloud = async () => {
      if (!cloudActive || !db || forcedOffline) return;
      
      setIsSyncing(true);
      try {
          // 1. Guardar la lista de flujos (solo metadatos, no nodos internos)
          // Optimizamos para no reescribir todos si no es necesario, pero como es manual, aseguramos
          for (const flow of flows) {
              await setDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flow.id), {
                  name: flow.name,
                  createdAt: flow.createdAt
              });
          }

          // 2. Si estamos dentro de un flujo, guardamos sus nodos y conexiones
          if (currentFlowId) {
              // Limpiar nodos viejos en la nube (opcional, pero buena práctica si se eliminaron localmente)
              // Por simplicidad, sobrescribimos los actuales
              for (const node of nodes) {
                   await setDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', currentFlowId, 'nodes', node.id), node);
              }
              for (const conn of connections) {
                   await setDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', currentFlowId, 'connections', conn.id), conn);
              }
          }
          
          setHasUnsavedChanges(false);
      } catch (e) {
          console.error("Error al sincronizar con la nube:", e);
          setCloudActive(false);
      } finally {
          setIsSyncing(false);
      }
  };

  // Marcamos cambios no guardados cuando el usuario modifica algo
  useEffect(() => {
      if(isReady && nodes.length > 0) {
          setHasUnsavedChanges(true);
      }
  }, [nodes, connections, flows]);


  // --- MOTOR DE ARRASTRE DE ALTO RENDIMIENTO (Solo Local) ---
  const handlePointerDown = useCallback((e, nodeId) => {
    if (e.button !== 0 && e.type !== 'touchstart') return; 
    e.stopPropagation();
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setActiveNodeId(nodeId);

    dragState.current = {
      isDragging: true,
      nodeId: nodeId,
      startX: clientX,
      startY: clientY,
      initialNodeX: node.x,
      initialNodeY: node.y,
      hasMoved: false
    };
    
    document.body.style.cursor = 'grabbing';
  }, [nodes]);

  const handlePointerMove = useCallback((e) => {
    if (connectingNode && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        setMousePos({ 
            x: clientX - rect.left, 
            y: clientY - rect.top 
        });
        return;
    }

    if (!dragState.current.isDragging) return;
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const deltaX = clientX - dragState.current.startX;
    const deltaY = clientY - dragState.current.startY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragState.current.hasMoved = true;
    }

    setNodes(prev => prev.map(n => {
        if (n.id === dragState.current.nodeId) {
            return {
                ...n,
                x: Math.max(0, dragState.current.initialNodeX + deltaX),
                y: Math.max(0, dragState.current.initialNodeY + deltaY)
            };
        }
        return n;
    }));
  }, [connectingNode]);

  const handlePointerUp = useCallback(() => {
    document.body.style.cursor = 'default';
    
    if (connectingNode) {
        setConnectingNode(null);
    }

    if (dragState.current.isDragging) {
      const hasMoved = dragState.current.hasMoved;
      dragState.current.isDragging = false;
      dragState.current.nodeId = null;

      if (hasMoved) {
        setHasUnsavedChanges(true);
        // Todo se guarda en localStorage mediante el useEffect general
      }
    }
  }, [connectingNode]);

  useEffect(() => {
    const handleGlobalUp = () => handlePointerUp();
    const handleGlobalMove = (e) => handlePointerMove(e);

    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });

    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
    };
  }, [handlePointerUp, handlePointerMove]);

  // --- Handlers de Gestión de Flujos y Nodos (Operan en Local) ---
  const createFlow = async (e) => {
    e.preventDefault();
    if (!newFlowName.trim()) return;
    const flowId = crypto.randomUUID(); 
    const flowData = { name: newFlowName, createdAt: new Date().toISOString() };
    const startNodeId = crypto.randomUUID(); 

    setFlows(prev => [...prev, { id: flowId, ...flowData }]);
    setNodes([{ id: startNodeId, type: NODE_TYPES.START, x: 100, y: 150, data: { label: 'Inicio' } }]);
    setConnections([]);
    
    setNewFlowName('');
    setCurrentFlowId(flowId);
    setHasUnsavedChanges(true);
  };

  const deleteFlow = async (e, flowId) => {
    e.stopPropagation();
    
    setFlows(prev => prev.filter(f => f.id !== flowId));
    localStorage.removeItem(`cf_nodes_v5_${flowId}`);
    localStorage.removeItem(`cf_conns_v5_${flowId}`);
    if (currentFlowId === flowId) setCurrentFlowId(null);
    
    if (cloudActive && db && !forcedOffline) {
        try { await deleteDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flowId)); } catch(e){}
    }
  };

  const selectFlow = async (flowId) => {
    // 1. Intentar cargar de local
    const snodes = localStorage.getItem(`cf_nodes_v5_${flowId}`);
    const sconns = localStorage.getItem(`cf_conns_v5_${flowId}`);
    
    let loadedNodes = [];
    let loadedConns = [];

    if (snodes) {
        loadedNodes = JSON.parse(snodes);
        loadedConns = sconns ? JSON.parse(sconns) : [];
    } 
    // 2. Si no hay en local, intentar de la nube (si está conectada)
    else if (cloudActive && db && !forcedOffline) {
        try {
            const nSnap = await getDocs(collection(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flowId, 'nodes'));
            loadedNodes = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const cSnap = await getDocs(collection(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flowId, 'connections'));
            loadedConns = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) {}
    }

    // 3. Fallback final
    if (loadedNodes.length === 0) {
        loadedNodes = [{ id: crypto.randomUUID(), type: NODE_TYPES.START, x: 100, y: 150, data: { label: 'Inicio' } }];
    }

    setNodes(loadedNodes);
    setConnections(loadedConns);
    setCurrentFlowId(flowId);
    setActiveNodeId(null);
    setHasUnsavedChanges(false); // Recién cargado
  };

  const addNode = (type) => {
    const id = crypto.randomUUID(); 
    const startX = 350 + (Math.random() * 50);
    const startY = 200 + (Math.random() * 50);
    
    const newNode = { id, type, x: startX, y: startY, data: { label: `Bloque ${type}` } };
    
    setNodes(prev => [...prev, newNode]);
    setActiveNodeId(id);
    setHasUnsavedChanges(true);
  };

  const startConnection = (e, nodeId) => {
    e.stopPropagation();
    setConnectingNode(nodeId);
    
    if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        setMousePos({ x: clientX - rect.left, y: clientY - rect.top });
    }
  };

  const finalizeConnection = (e, targetId) => {
    e.stopPropagation();
    if (connectingNode && connectingNode !== targetId) {
      const exists = connections.find(c => c.from === connectingNode && c.to === targetId);
      if (!exists) {
          const connId = `${connectingNode}-${targetId}`;
          const newConn = { id: connId, from: connectingNode, to: targetId };
          setConnections(prev => [...prev, newConn]);
          setHasUnsavedChanges(true);
      }
    }
    setConnectingNode(null);
  };

  const deleteSelection = async () => {
    if (!activeNodeId) return;
    
    setNodes(prev => prev.filter(n => n.id !== activeNodeId));
    setConnections(prev => prev.filter(c => c.from !== activeNodeId && c.to !== activeNodeId));
    setActiveNodeId(null);
    setHasUnsavedChanges(true);

    if (cloudActive && db && !forcedOffline && currentFlowId) {
      try {
        await deleteDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', currentFlowId, 'nodes', activeNodeId));
      } catch (e) {}
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'callflow2026') {
      setIsLoggedIn(true);
      localStorage.setItem('callflow_auth', 'true');
    } else setLoginError('Clave incorrecta');
  };

  if (!isReady) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
      <Loader2 className="text-indigo-600 animate-spin mb-4" size={40} />
      <p className="text-slate-400 font-bold animate-pulse uppercase text-xs tracking-widest text-center">
        Motor de Alto Rendimiento...<br/><span className="text-[10px] opacity-50 font-medium">Iniciando Architect Pro</span>
      </p>
    </div>
  );

  if (!isLoggedIn) return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-sm text-center">
        <div className="bg-slate-900 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl">
          <Lock size={36} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter uppercase italic">Architect</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Clave compartida" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center outline-none focus:border-indigo-500 transition-all font-bold" />
          {loginError && <p className="text-rose-500 text-xs font-bold">{loginError}</p>}
          <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-xl">Desbloquear</button>
        </form>
      </motion.div>
    </div>
  );

  // --- DASHBOARD ---
  if (!currentFlowId) return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic uppercase">
              <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg rotate-3"><LayoutGrid size={28} /></div>
              Callflows
            </h1>
            <p className="text-slate-500 font-medium mt-2 flex items-center gap-2">
              {forcedOffline ? (
                <span className="flex items-center gap-2 text-rose-500"><WifiOff size={14} /> Modo Offline Forzado</span>
              ) : cloudActive ? (
                <span className="flex items-center gap-2 text-emerald-500"><Cloud size={14} /> Listo para Sincronizar</span>
              ) : (
                <span className="flex items-center gap-2 text-amber-500"><CloudOff size={14} /> Modo Local Únicamente</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={toggleOfflineMode}
                className={cn(
                    "p-3 rounded-2xl transition-all shadow-sm border",
                    forcedOffline 
                        ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" 
                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
                )}
                title={forcedOffline ? "Reconectar a la nube" : "Forzar modo offline"}
            >
                {forcedOffline ? <WifiOff size={20} /> : <CloudOff size={20} />}
            </button>
            <form onSubmit={createFlow} className="flex items-center gap-3 bg-white p-2 rounded-3xl shadow-xl border border-slate-100 w-full md:w-auto">
              <input 
                type="text" 
                value={newFlowName} 
                onChange={e => setNewFlowName(e.target.value)}
                placeholder="Nombre del nuevo árbol..." 
                className="flex-1 md:w-64 bg-transparent px-4 py-2 outline-none font-bold text-slate-700"
              />
              <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-2xl hover:bg-indigo-700 transition-colors shadow-md">
                <Plus size={20} />
              </button>
            </form>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {flows.map((flow) => (
              <motion.div 
                key={flow.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -8 }}
                onClick={() => selectFlow(flow.id)}
                className="group relative bg-white p-8 rounded-[3rem] shadow-xl border-2 border-transparent hover:border-indigo-500 cursor-pointer transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="bg-indigo-50 p-4 rounded-3xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <FileCode size={28} />
                  </div>
                  <button 
                    onClick={(e) => deleteFlow(e, flow.id)}
                    className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2 truncate">{flow.name}</h3>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <Calendar size={12} />
                  {new Date(flow.createdAt).toLocaleDateString()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  // --- EDITOR ---
  return (
    <div className="h-screen w-full flex bg-[#f8fafc] overflow-hidden font-sans selection:bg-indigo-100 select-none">
      <motion.aside animate={{ width: sidebarOpen ? 320 : 0 }} className="bg-white border-r border-slate-200 flex flex-col shadow-2xl z-30 relative overflow-hidden shrink-0">
        <div className="p-8 min-w-[320px] h-full flex flex-col">
          <div className="flex items-center gap-4 mb-12">
            <button onClick={() => setCurrentFlowId(null)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-colors shadow-sm">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase truncate flex-1">
              {flows.find(f => f.id === currentFlowId)?.name}
            </h1>
          </div>

          <div className="flex-1 space-y-12 overflow-y-auto pr-2 scrollbar-hide">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">Componentes</p>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { type: NODE_TYPES.AUDIO, label: 'Mensaje Audio', icon: PhoneCall },
                  { type: NODE_TYPES.CHOICE, label: 'Opciones IVR', icon: Split },
                  { type: NODE_TYPES.END, label: 'Fin Llamada', icon: LogOut },
                ].map((item) => {
                  const theme = getNodeTheme(item.type);
                  return (
                    <button key={item.type} onClick={() => addNode(item.type)} className="flex items-center gap-4 p-5 rounded-[2rem] border-2 border-slate-50 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all group text-left shadow-sm">
                      <div className={cn("p-2.5 rounded-xl transition-all group-hover:bg-indigo-600 group-hover:text-white shadow-sm", theme.light, theme.text)}>
                        <item.icon size={20} />
                      </div>
                      <span className="text-sm font-bold text-slate-700">{item.label}</span>
                      <Plus size={14} className="ml-auto text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {activeNodeId && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="pt-10 border-t border-slate-100">
                  <div className="bg-slate-50 rounded-[2.5rem] p-7 space-y-6 border border-slate-100 shadow-inner">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 tracking-widest">Etiqueta del Nodo</label>
                      <input 
                        type="text" 
                        value={nodes.find(n => n.id === activeNodeId)?.data.label || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, data: { ...n.data, label: val } } : n));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                    <button onClick={deleteSelection} className="w-full p-4 text-rose-500 bg-white border-2 border-rose-100 hover:bg-rose-50 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                      Eliminar Bloque
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-8 border-t border-slate-100 mt-auto flex flex-col gap-5">
            <div className="flex items-center justify-between px-3">
               {forcedOffline ? (
                 <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-4 py-2 rounded-full uppercase border border-rose-200"><WifiOff size={12} /> Offline Forzado</span>
               ) : cloudActive ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full uppercase border border-emerald-100"><Cloud size={12} /> Conectado</span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-full uppercase border border-amber-100"><CloudOff size={12} /> Local</span>
              )}
              <span className="text-[10px] font-black text-slate-300 uppercase">{nodes.length} Nodos</span>
            </div>
            <button 
              onClick={syncToCloud} 
              disabled={isSyncing || (!cloudActive && !forcedOffline)}
              className={cn(
                  "w-full text-white p-6 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 transition-all",
                  isSyncing ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800 active:scale-95",
                  hasUnsavedChanges && !isSyncing ? "ring-4 ring-indigo-200" : ""
              )}
            >
              {isSyncing ? <Loader2 size={18} className="animate-spin" /> : cloudActive ? <UploadCloud size={18} /> : <Save size={18} />} 
              {isSyncing ? 'Sincronizando...' : cloudActive ? 'Guardar en Nube' : 'Guardar Local'}
            </button>
          </div>
        </div>
      </motion.aside>

      <main 
        ref={canvasRef} 
        className="flex-1 relative overflow-hidden bg-[#f1f5f9] cursor-default"
        onPointerDown={(e) => {
            if (e.target === canvasRef.current || e.target.tagName === 'svg' || e.target.tagName === 'path') {
                setActiveNodeId(null);
            }
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-[0.6]" 
          style={{ backgroundImage: 'radial-gradient(#cbd5e1 2px, transparent 2px)', backgroundSize: '40px 40px' }} 
        />

        <div className="absolute top-12 left-12 z-20 pointer-events-none flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-white p-5 rounded-[1.5rem] shadow-2xl border border-slate-200 hover:bg-slate-50 transition-all pointer-events-auto shadow-indigo-100">
            <MousePointer2 size={26} className={cn(sidebarOpen ? 'text-indigo-600' : 'text-slate-400')} />
          </button>
          
          <button 
            onClick={toggleOfflineMode}
            className={cn(
                "p-5 rounded-[1.5rem] shadow-2xl border transition-all pointer-events-auto",
                forcedOffline 
                    ? "bg-rose-50 text-rose-600 border-rose-200 shadow-rose-100 hover:bg-rose-100" 
                    : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
            )}
            title={forcedOffline ? "Reconectar a la nube" : "Forzar modo offline"}
          >
            {forcedOffline ? <WifiOff size={26} /> : <CloudOff size={26} />}
          </button>

          {hasUnsavedChanges && (
              <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border border-amber-200 animate-pulse">
                  Cambios sin guardar
              </div>
          )}
        </div>

        {/* CONTENEDOR GRÁFICO (Cables) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
            </marker>
            {/* Markers coloreados por tipo de nodo origen */}
            <marker id="arrow-start" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#10b981" /></marker>
            <marker id="arrow-audio" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" /></marker>
            <marker id="arrow-choice" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#a855f7" /></marker>
          </defs>
          
          {/* Cable en creación */}
          {connectingNode && (
             <path 
                d={`M ${nodes.find(n => n.id === connectingNode)?.x + 125} ${nodes.find(n => n.id === connectingNode)?.y + 110} 
                    C ${nodes.find(n => n.id === connectingNode)?.x + 125} ${nodes.find(n => n.id === connectingNode)?.y + 200}, 
                      ${mousePos.x} ${mousePos.y - 100}, 
                      ${mousePos.x} ${mousePos.y}`}
                fill="none" 
                stroke="#6366f1" 
                strokeWidth="4" 
                strokeDasharray="8,8"
                className="animate-pulse"
              />
          )}

          {/* Cables Establecidos */}
          {connections.map((conn) => {
            const from = nodes.find(n => n.id === conn.from);
            const to = nodes.find(n => n.id === conn.to);
            if (!from || !to) return null;
            
            // Puntos de anclaje refinados (centro inferior origen -> centro superior destino)
            const x1 = from.x + 125; 
            const y1 = from.y + 110; 
            const x2 = to.x + 125; 
            const y2 = to.y - 10;
            
            const theme = getNodeTheme(from.type);

            return (
              <path 
                key={conn.id} 
                d={`M ${x1} ${y1} C ${x1} ${y1 + 80}, ${x2} ${y2 - 80}, ${x2} ${y2}`} 
                fill="none" 
                stroke={theme.stroke} 
                strokeWidth="4" 
                strokeLinecap="round" 
                markerEnd={`url(#arrow-${from.type})`} 
                className="opacity-70 drop-shadow-md transition-all duration-300"
              />
            );
          })}
        </svg>

        {/* CONTENEDOR DE NODOS */}
        <div className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            <AnimatePresence>
            {nodes.map((node) => {
                const theme = getNodeTheme(node.type);
                const Icon = getIconForType(node.type);
                const isActive = activeNodeId === node.id;
                
                return (
                <motion.div
                    key={node.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    style={{ 
                        position: 'absolute',
                        left: node.x, 
                        top: node.y,
                        touchAction: 'none' 
                    }}
                    onPointerDown={(e) => handlePointerDown(e, node.id)}
                    className={cn(
                    "w-[250px] bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border-[3px] pointer-events-auto transition-shadow will-change-transform group",
                    isActive ? "border-indigo-500 shadow-indigo-200/50 ring-8 ring-indigo-50 z-20" : "border-white z-10 hover:border-slate-100 hover:shadow-2xl"
                    )}
                >
                    <div className="p-7">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn("p-3 rounded-2xl text-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-110", theme.bg)}>
                        <Icon size={22} strokeWidth={2.5} />
                        </div>
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.25em]">{node.type}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 truncate leading-tight tracking-tight px-1">{node.data.label}</h3>
                    </div>

                    {/* PUERTO DE ENTRADA (Superior) */}
                    {node.type !== NODE_TYPES.START && (
                    <div 
                        onPointerUp={(e) => finalizeConnection(e, node.id)}
                        className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-slate-50 border-[6px] border-white rounded-full shadow-inner flex items-center justify-center hover:scale-125 transition-transform"
                    >
                        <div className="w-3 h-3 bg-slate-300 rounded-full" />
                    </div>
                    )}
                    
                    {/* PUERTO DE SALIDA (Inferior) */}
                    {node.type !== NODE_TYPES.END && (
                    <div 
                        onPointerDown={(e) => startConnection(e, node.id)}
                        className={cn(
                        "absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 border-[6px] border-white rounded-full cursor-crosshair hover:scale-125 transition-all shadow-xl flex items-center justify-center z-30",
                        connectingNode === node.id ? "bg-amber-400 animate-pulse scale-125 ring-4 ring-amber-100" : theme.bg
                        )}
                    >
                        <ChevronRight size={20} className="text-white" strokeWidth={3} />
                    </div>
                    )}
                </motion.div>
                );
            })}
            </AnimatePresence>
        </div>
      </main>
    </div>
  );
}