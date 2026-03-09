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
  getDocs
} from 'firebase/firestore';
import { 
  PhoneCall, 
  Play, 
  Split, 
  LogOut, 
  Plus, 
  Settings2, 
  Save, 
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
  UploadCloud,
  ZoomIn,
  ZoomOut,
  Maximize
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

// Paleta de colores refinada y profesional
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [db, setDb] = useState(null);
  const [forcedOffline, setForcedOffline] = useState(() => localStorage.getItem('cf_forced_offline') === 'true');
  const [cloudActive, setCloudActive] = useState(false);

  // --- ESTADOS OPTIMIZADOS DEL LIENZO (CANVAS) ---
  const mainContainerRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 }); // Ref para acceso síncrono en EventListeners
  
  const setTransformState = (newTransform) => {
    transformRef.current = newTransform;
    setTransform(newTransform);
  };

  const isPanningRef = useRef(false);
  const connectingNodeRef = useRef(null);
  const [connectingNodeState, setConnectingNodeState] = useState(null); // Solo para forzar render visual del cable activo
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const dragState = useRef({
    isDragging: false,
    nodeId: null,
    startX: 0,
    startY: 0,
    initialNodeX: 0,
    initialNodeY: 0,
    hasMoved: false 
  });

  const panState = useRef({ startX: 0, startY: 0, initialPanX: 0, initialPanY: 0 });

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

  const loadLocalFlows = () => {
    const savedFlows = localStorage.getItem('cf_flows_list_v5');
    if (savedFlows) setFlows(JSON.parse(savedFlows));
  };

  const fetchCloudFlows = async (firestoreDb) => {
      try {
          const flowsSnap = await getDocs(collection(firestoreDb, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows'));
          const cloudFlows = flowsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setFlows(cloudFlows);
          localStorage.setItem('cf_flows_list_v5', JSON.stringify(cloudFlows));
      } catch(e) {
          loadLocalFlows();
          setCloudActive(false);
      }
  };

  const toggleOfflineMode = () => {
      const newOfflineState = !forcedOffline;
      setForcedOffline(newOfflineState);
      localStorage.setItem('cf_forced_offline', newOfflineState.toString());
      if (!newOfflineState) window.location.reload();
      else setCloudActive(false);
  };

  useEffect(() => {
    if (isReady && !dragState.current.isDragging) {
      localStorage.setItem('cf_flows_list_v5', JSON.stringify(flows));
      if (currentFlowId) {
        localStorage.setItem(`cf_nodes_v5_${currentFlowId}`, JSON.stringify(nodes));
        localStorage.setItem(`cf_conns_v5_${currentFlowId}`, JSON.stringify(connections));
      }
    }
  }, [flows, nodes, connections, isReady, currentFlowId]);

  const syncToCloud = async () => {
      if (!cloudActive || !db || forcedOffline) return;
      setIsSyncing(true);
      try {
          for (const flow of flows) {
              await setDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flow.id), {
                  name: flow.name, createdAt: flow.createdAt
              });
          }
          if (currentFlowId) {
              for (const node of nodes) {
                   await setDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', currentFlowId, 'nodes', node.id), node);
              }
              for (const conn of connections) {
                   await setDoc(doc(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', currentFlowId, 'connections', conn.id), conn);
              }
          }
          setHasUnsavedChanges(false);
      } catch (e) {
          setCloudActive(false);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
      if(isReady && nodes.length > 0) setHasUnsavedChanges(true);
  }, [nodes, connections, flows]);

  // --- MOTOR GRÁFICO: CONVERSIÓN DE COORDENADAS ---
  const getCanvasCoords = (clientX, clientY) => {
    if (!mainContainerRef.current) return { x: 0, y: 0 };
    const rect = mainContainerRef.current.getBoundingClientRect();
    const xRel = clientX - rect.left;
    const yRel = clientY - rect.top;
    return {
        x: (xRel - transformRef.current.x) / transformRef.current.scale,
        y: (yRel - transformRef.current.y) / transformRef.current.scale
    };
  };

  // --- EVENTOS DE RUEDA (ZOOM) ---
  const handleWheel = useCallback((e) => {
    if (!mainContainerRef.current) return;
    
    // Solo permitir zoom con rueda para evitar colisiones extrañas
    const zoomSensitivity = 0.0015;
    const delta = -e.deltaY * zoomSensitivity;
    
    let newScale = transformRef.current.scale * Math.exp(delta);
    newScale = Math.min(Math.max(0.15, newScale), 2.5); // Límites del Zoom

    const rect = mainContainerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const scaleRatio = newScale / transformRef.current.scale;
    const newX = cursorX - (cursorX - transformRef.current.x) * scaleRatio;
    const newY = cursorY - (cursorY - transformRef.current.y) * scaleRatio;

    setTransformState({ x: newX, y: newY, scale: newScale });
  }, []);

  // --- MOTOR DE INTERACCIÓN GLOBAL (PAN, DRAG, CONNECT) ---
  const handleCanvasPointerDown = (e) => {
      if (e.target.closest('.node-element')) return; // No hacer pan si hacemos clic en un nodo
      
      if (e.button === 0 || e.button === 1 || e.type === 'touchstart') {
          isPanningRef.current = true;
          panState.current = {
              startX: e.clientX || (e.touches && e.touches[0].clientX),
              startY: e.clientY || (e.touches && e.touches[0].clientY),
              initialPanX: transformRef.current.x,
              initialPanY: transformRef.current.y
          };
          document.body.style.cursor = 'grabbing';
          setActiveNodeId(null);
      }
  };

  const handleNodePointerDown = useCallback((e, nodeId) => {
    if (e.button !== 0 && e.type !== 'touchstart') return; 
    e.stopPropagation();
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setActiveNodeId(nodeId);

    const coords = getCanvasCoords(clientX, clientY);

    dragState.current = {
      isDragging: true,
      nodeId: nodeId,
      startX: coords.x,
      startY: coords.y,
      initialNodeX: node.x,
      initialNodeY: node.y,
      hasMoved: false
    };
    
    document.body.style.cursor = 'grabbing';
  }, [nodes]);

  const handleGlobalMove = useCallback((e) => {
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    // 1. Manejo de Panning (Mover lienzo)
    if (isPanningRef.current) {
        const dx = clientX - panState.current.startX;
        const dy = clientY - panState.current.startY;
        setTransformState({
            ...transformRef.current,
            x: panState.current.initialPanX + dx,
            y: panState.current.initialPanY + dy
        });
        return;
    }

    // 2. Manejo de Conexiones
    if (connectingNodeRef.current && mainContainerRef.current) {
        setMousePos(getCanvasCoords(clientX, clientY));
        return;
    }

    // 3. Manejo de Arrastre de Nodos
    if (dragState.current.isDragging) {
        const coords = getCanvasCoords(clientX, clientY);
        const deltaX = coords.x - dragState.current.startX;
        const deltaY = coords.y - dragState.current.startY;

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
            dragState.current.hasMoved = true;
        }

        // Actualización sincrónica e instantánea para eliminar lag
        setNodes(prev => prev.map(n => {
            if (n.id === dragState.current.nodeId) {
                return {
                    ...n,
                    // Rejilla imaginaria de 10px para alineación visual sutil
                    x: Math.round((dragState.current.initialNodeX + deltaX) / 10) * 10,
                    y: Math.round((dragState.current.initialNodeY + deltaY) / 10) * 10
                };
            }
            return n;
        }));
    }
  }, []);

  const handleGlobalUp = useCallback(() => {
    document.body.style.cursor = 'default';
    isPanningRef.current = false;

    if (connectingNodeRef.current) {
        connectingNodeRef.current = null;
        setConnectingNodeState(null);
    }

    if (dragState.current.isDragging) {
      if (dragState.current.hasMoved) setHasUnsavedChanges(true);
      dragState.current.isDragging = false;
      dragState.current.nodeId = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('touchend', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });

    // Prevenir el scroll por defecto si la rueda se usa en el contenedor
    const container = mainContainerRef.current;
    const preventScroll = (e) => e.preventDefault();
    if (container) container.addEventListener('wheel', preventScroll, { passive: false });

    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalMove);
      if (container) container.removeEventListener('wheel', preventScroll);
    };
  }, [handleGlobalUp, handleGlobalMove]);

  // --- Handlers Restantes ---
  const createFlow = async (e) => {
    e.preventDefault();
    if (!newFlowName.trim()) return;
    const flowId = crypto.randomUUID(); 
    const flowData = { name: newFlowName, createdAt: new Date().toISOString() };
    const startNodeId = crypto.randomUUID(); 

    setFlows(prev => [...prev, { id: flowId, ...flowData }]);
    setNodes([{ id: startNodeId, type: NODE_TYPES.START, x: 200, y: 200, data: { label: 'Inicio' } }]);
    setConnections([]);
    
    setNewFlowName('');
    setCurrentFlowId(flowId);
    setTransformState({ x: 0, y: 0, scale: 1 }); // Reset viewport
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
    const snodes = localStorage.getItem(`cf_nodes_v5_${flowId}`);
    const sconns = localStorage.getItem(`cf_conns_v5_${flowId}`);
    
    let loadedNodes = [];
    let loadedConns = [];

    if (snodes) {
        loadedNodes = JSON.parse(snodes);
        loadedConns = sconns ? JSON.parse(sconns) : [];
    } else if (cloudActive && db && !forcedOffline) {
        try {
            const nSnap = await getDocs(collection(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flowId, 'nodes'));
            loadedNodes = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const cSnap = await getDocs(collection(db, 'artifacts', STABLE_APP_ID, 'public', 'data', 'flows', flowId, 'connections'));
            loadedConns = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch(e) {}
    }

    if (loadedNodes.length === 0) loadedNodes = [{ id: crypto.randomUUID(), type: NODE_TYPES.START, x: 200, y: 200, data: { label: 'Inicio' } }];

    setNodes(loadedNodes);
    setConnections(loadedConns);
    setCurrentFlowId(flowId);
    setActiveNodeId(null);
    setTransformState({ x: 0, y: 0, scale: 1 });
    setTimeout(() => setHasUnsavedChanges(false), 50);
  };

  const addNode = (type) => {
    const id = crypto.randomUUID(); 
    // Insertar en el centro de la vista actual
    const cx = (-transformRef.current.x + 300) / transformRef.current.scale;
    const cy = (-transformRef.current.y + 200) / transformRef.current.scale;
    
    const newNode = { id, type, x: cx, y: cy, data: { label: `Nuevo ${type}` } };
    
    setNodes(prev => [...prev, newNode]);
    setActiveNodeId(id);
    setHasUnsavedChanges(true);
  };

  const startConnection = (e, nodeId) => {
    e.stopPropagation();
    connectingNodeRef.current = nodeId;
    setConnectingNodeState(nodeId);
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    setMousePos(getCanvasCoords(clientX, clientY));
  };

  const finalizeConnection = (e, targetId) => {
    e.stopPropagation();
    const sourceId = connectingNodeRef.current;
    if (sourceId && sourceId !== targetId) {
      const exists = connections.find(c => c.from === sourceId && c.to === targetId);
      if (!exists) {
          const newConn = { id: crypto.randomUUID(), from: sourceId, to: targetId };
          setConnections(prev => [...prev, newConn]);
          setHasUnsavedChanges(true);
      }
    }
    connectingNodeRef.current = null;
    setConnectingNodeState(null);
  };

  const deleteSelection = async () => {
    if (!activeNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== activeNodeId));
    setConnections(prev => prev.filter(c => c.from !== activeNodeId && c.to !== activeNodeId));
    setActiveNodeId(null);
    setHasUnsavedChanges(true);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'callflow2026') {
      setIsLoggedIn(true);
      localStorage.setItem('callflow_auth', 'true');
    } else setLoginError('Clave incorrecta');
  };

  const zoomToFit = () => setTransformState({ x: 0, y: 0, scale: 1 });
  const zoomIn = () => setTransformState(t => ({ ...t, scale: Math.min(2.5, t.scale * 1.2) }));
  const zoomOut = () => setTransformState(t => ({ ...t, scale: Math.max(0.15, t.scale / 1.2) }));

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
        <div className="bg-slate-900 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
          <Lock size={30} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tighter uppercase italic">Architect</h1>
        <form onSubmit={handleLogin} className="space-y-4 mt-6">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Clave compartida" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-center outline-none focus:border-indigo-500 transition-all font-bold text-sm" />
          {loginError && <p className="text-rose-500 text-xs font-bold">{loginError}</p>}
          <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-md">Desbloquear</button>
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
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic uppercase">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg rotate-3"><LayoutGrid size={24} /></div>
              Callflows
            </h1>
            <p className="text-slate-500 font-medium mt-2 flex items-center gap-2 text-sm">
              {forcedOffline ? (
                <span className="flex items-center gap-1.5 text-rose-500"><WifiOff size={14} /> Modo Offline Forzado</span>
              ) : cloudActive ? (
                <span className="flex items-center gap-1.5 text-emerald-500"><Cloud size={14} /> Listo para Sincronizar</span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-500"><CloudOff size={14} /> Modo Local Únicamente</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={toggleOfflineMode}
                className={cn(
                    "p-3 rounded-xl transition-all shadow-sm border",
                    forcedOffline 
                        ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100" 
                        : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600"
                )}
                title={forcedOffline ? "Reconectar a la nube" : "Forzar modo offline"}
            >
                {forcedOffline ? <WifiOff size={18} /> : <CloudOff size={18} />}
            </button>
            <form onSubmit={createFlow} className="flex items-center gap-3 bg-white p-1.5 rounded-2xl shadow-md border border-slate-200 w-full md:w-auto">
              <input 
                type="text" 
                value={newFlowName} 
                onChange={e => setNewFlowName(e.target.value)}
                placeholder="Nombre del nuevo árbol..." 
                className="flex-1 md:w-60 bg-transparent px-4 py-2 outline-none font-bold text-slate-700 text-sm"
              />
              <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors">
                <Plus size={18} />
              </button>
            </form>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatePresence>
            {flows.map((flow) => (
              <motion.div 
                key={flow.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                onClick={() => selectFlow(flow.id)}
                className="group relative bg-white p-6 rounded-[2rem] shadow-lg border-2 border-transparent hover:border-indigo-500 cursor-pointer transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <FileCode size={22} />
                  </div>
                  <button 
                    onClick={(e) => deleteFlow(e, flow.id)}
                    className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2 truncate">{flow.name}</h3>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <Calendar size={10} />
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
    <div className="h-screen w-full flex bg-slate-100 overflow-hidden font-sans selection:bg-indigo-100 select-none">
      {/* TOOLBAR SUPERIOR FLOTANTE */}
      <div className="absolute top-6 left-6 z-40 flex items-center gap-4">
        <button onClick={() => setCurrentFlowId(null)} className="bg-white p-3 rounded-xl shadow-md text-slate-500 hover:text-indigo-600 border border-slate-200 transition-all hover:scale-105 active:scale-95">
           <ArrowLeft size={18} />
        </button>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="bg-white p-3 rounded-xl shadow-md text-slate-500 hover:text-indigo-600 border border-slate-200 transition-all hover:scale-105 active:scale-95">
           <LayoutGrid size={18} />
        </button>
        <div className="bg-white/90 backdrop-blur px-5 py-2.5 rounded-xl shadow-md border border-slate-200 flex items-center gap-3 font-black text-slate-800 text-sm">
           {flows.find(f => f.id === currentFlowId)?.name}
        </div>
      </div>

      {/* CONTROLES DE ZOOM Y ESTADO */}
      <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-4">
        {hasUnsavedChanges && (
            <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-200 animate-pulse shadow-lg">
                Cambios Locales
            </div>
        )}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border border-slate-200">
           <button onClick={zoomOut} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"><ZoomOut size={16}/></button>
           <span className="text-[10px] font-bold text-slate-400 w-10 text-center">{Math.round(transform.scale * 100)}%</span>
           <button onClick={zoomIn} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"><ZoomIn size={16}/></button>
           <div className="w-px h-4 bg-slate-200 mx-1"></div>
           <button onClick={zoomToFit} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"><Maximize size={16}/></button>
        </div>
      </div>

      <motion.aside animate={{ width: sidebarOpen ? 280 : 0 }} className="bg-white border-r border-slate-200 flex flex-col shadow-2xl z-30 relative overflow-hidden shrink-0">
        <div className="p-6 min-w-[280px] h-full flex flex-col pt-24">
          <div className="flex-1 space-y-10 overflow-y-auto pr-2 scrollbar-hide">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Añadir Componente</p>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { type: NODE_TYPES.AUDIO, label: 'Mensaje Audio', icon: PhoneCall },
                  { type: NODE_TYPES.CHOICE, label: 'Opciones IVR', icon: Split },
                  { type: NODE_TYPES.END, label: 'Fin Llamada', icon: LogOut },
                ].map((item) => {
                  const theme = getNodeTheme(item.type);
                  return (
                    <button key={item.type} onClick={() => addNode(item.type)} className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group text-left shadow-sm">
                      <div className={cn("p-2 rounded-lg transition-all group-hover:bg-indigo-600 group-hover:text-white shadow-sm", theme.light, theme.text)}>
                        <item.icon size={16} />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{item.label}</span>
                      <Plus size={14} className="ml-auto text-slate-300" />
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {activeNodeId && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="pt-8 border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Propiedades</p>
                  <div className="bg-slate-50 rounded-2xl p-5 space-y-5 border border-slate-100 shadow-inner">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Etiqueta</label>
                      <input 
                        type="text" 
                        value={nodes.find(n => n.id === activeNodeId)?.data.label || ''} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes(prev => prev.map(n => n.id === activeNodeId ? { ...n, data: { ...n.data, label: val } } : n));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
                      />
                    </div>
                    <button onClick={deleteSelection} className="w-full p-3 text-rose-500 bg-white border border-rose-100 hover:bg-rose-50 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm">
                      Borrar Nodo
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-auto flex flex-col gap-4">
            <button 
              onClick={syncToCloud} 
              disabled={isSyncing || (!cloudActive && !forcedOffline)}
              className={cn(
                  "w-full text-white p-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-xl flex items-center justify-center gap-3 transition-all",
                  isSyncing ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800 active:scale-95",
                  hasUnsavedChanges && !isSyncing ? "ring-4 ring-indigo-200" : ""
              )}
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : cloudActive ? <UploadCloud size={16} /> : <Save size={16} />} 
              {isSyncing ? 'Subiendo...' : cloudActive ? 'Guardar Nube' : 'Guardar'}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* ÁREA DEL LIENZO CON TRANSFORMACIÓN */}
      <main 
        ref={mainContainerRef} 
        className="flex-1 relative overflow-hidden bg-[#f1f5f9] cursor-grab active:cursor-grabbing"
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleWheel}
      >
        <div 
           className="origin-top-left absolute inset-0 pointer-events-none"
           style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        >
            {/* GRID ESCALABLE */}
            <div className="absolute inset-[-10000px] pointer-events-none opacity-50" 
              style={{ backgroundImage: 'radial-gradient(#cbd5e1 2px, transparent 2px)', backgroundSize: '40px 40px', backgroundPosition: 'center' }} 
            />

            {/* CABLES (SVG) */}
            <svg className="absolute inset-[-10000px] w-[20000px] h-[20000px] pointer-events-none overflow-visible z-0" style={{ transform: 'translate(10000px, 10000px)'}}>
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
                </marker>
                <marker id="arrow-start" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#10b981" /></marker>
                <marker id="arrow-audio" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#3b82f6" /></marker>
                <marker id="arrow-choice" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto"><polygon points="0 0, 6 2, 0 4" fill="#a855f7" /></marker>
              </defs>
              
              {connectingNodeState && (
                 <path 
                    d={`M ${nodes.find(n => n.id === connectingNodeState)?.x + 100} ${nodes.find(n => n.id === connectingNodeState)?.y + 80} 
                        C ${nodes.find(n => n.id === connectingNodeState)?.x + 100} ${nodes.find(n => n.id === connectingNodeState)?.y + 150}, 
                          ${mousePos.x} ${mousePos.y - 80}, 
                          ${mousePos.x} ${mousePos.y}`}
                    fill="none" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="6,6"
                    className="animate-pulse"
                  />
              )}

              {connections.map((conn) => {
                const from = nodes.find(n => n.id === conn.from);
                const to = nodes.find(n => n.id === conn.to);
                if (!from || !to) return null;
                
                // Anclajes precisos: Ancho nodo 200 (centro 100). Alto aprox 80.
                const x1 = from.x + 100; const y1 = from.y + 80; 
                const x2 = to.x + 100; const y2 = to.y - 12; // -12 para chocar exacto con el puerto de entrada
                
                const theme = getNodeTheme(from.type);

                return (
                  <path 
                    key={conn.id} 
                    d={`M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 60}, ${x2} ${y2}`} 
                    fill="none" 
                    stroke={theme.stroke} 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    markerEnd={`url(#arrow-${from.type})`} 
                    className="opacity-80 drop-shadow-sm"
                  />
                );
              })}
            </svg>

            {/* NODOS (Bloques finos y precisos) */}
            {nodes.map((node) => {
                const theme = getNodeTheme(node.type);
                const Icon = getIconForType(node.type);
                const isActive = activeNodeId === node.id;
                
                return (
                <div
                    key={node.id}
                    style={{ 
                        position: 'absolute',
                        transform: `translate(${node.x}px, ${node.y}px)`,
                        touchAction: 'none' 
                    }}
                    onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                    className={cn(
                    "node-element w-[200px] bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border-2 pointer-events-auto group z-10 transition-shadow",
                    isActive ? "border-indigo-500 shadow-indigo-100 ring-4 ring-indigo-50 z-20" : "border-white hover:border-slate-200 hover:shadow-xl"
                    )}
                >
                    <div className="p-4 flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl text-white shadow-sm", theme.bg)}>
                          <Icon size={16} strokeWidth={2.5} />
                        </div>
                        <div className="overflow-hidden">
                           <span className="block text-[8px] font-black uppercase text-slate-400 tracking-widest">{node.type}</span>
                           <h3 className="text-sm font-bold text-slate-800 truncate leading-tight mt-0.5">{node.data.label}</h3>
                        </div>
                    </div>

                    {/* PUERTO ENTRADA */}
                    {node.type !== NODE_TYPES.START && (
                    <div 
                        onPointerUp={(e) => finalizeConnection(e, node.id)}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-50 border-[4px] border-white rounded-full shadow-inner flex items-center justify-center hover:scale-125 transition-transform"
                    >
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                    </div>
                    )}
                    
                    {/* PUERTO SALIDA */}
                    {node.type !== NODE_TYPES.END && (
                    <div 
                        onPointerDown={(e) => startConnection(e, node.id)}
                        className={cn(
                        "absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 border-[4px] border-white rounded-full cursor-crosshair hover:scale-125 transition-all shadow-md flex items-center justify-center z-30",
                        connectingNodeState === node.id ? "bg-amber-400 animate-pulse ring-2 ring-amber-100" : theme.bg
                        )}
                    >
                        <ChevronRight size={12} className="text-white" strokeWidth={3} />
                    </div>
                    )}
                </div>
                );
            })}
        </div>
      </main>
    </div>
  );
}