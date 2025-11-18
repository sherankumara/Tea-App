import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  setDoc,
  getDoc,
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Sprout, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Trash2,
  Coins,
  AlertCircle,
  Lock,
  Settings,
  Building2,
  Factory,
  CalendarDays,
  KeyRound,
  RefreshCcw,
  Bell,
  Check,
  X,
  BellRing,
  UserCheck,
  ShieldCheck,
  LogOut,
  Sparkles, 
  Loader2, 
  Users, 
  MapPin, 
  Pencil, 
  Save,
  Camera, 
  Eye,
  Download
} from 'lucide-react';

// --- Firebase Configuration (Your Specific Key) ---
const firebaseConfig = {
  apiKey: "AIzaSyBrtv7D89sDboUrEkBEbXazJQlmjGF7C4g",
  authDomain: "my-teaapp.firebaseapp.com",
  projectId: "my-teaapp",
  storageBucket: "my-teaapp.firebasestorage.app",
  messagingSenderId: "97042947360",
  appId: "1:97042947360:web:9b7a276e93f71dfa118b45"
};

// --- APP ID Setting ---
const __app_id = "my_tea_app_main"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helper Functions ---
const formatLKR = (value) => {
  return new Intl.NumberFormat('si-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2
  }).format(value);
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString('si-LK', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
};

const getMonthID = (dateString) => {
  return dateString.substring(0, 7); 
};

const getMonthName = (monthId, type = 'long') => {
  if (!monthId) return "";
  const [year, month] = monthId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('si-LK', { year: 'numeric', month: type });
};

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5); 
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [prices, setPrices] = useState({}); 
  const [factories, setFactories] = useState([]);
  const [plots, setPlots] = useState([]); 
  const [reminders, setReminders] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Auth States
  const [authStatus, setAuthStatus] = useState('loading'); 
  const [savedAdminPin, setSavedAdminPin] = useState(null);
  const [savedAppPin, setSavedAppPin] = useState(null);
  const [inputPin, setInputPin] = useState('');
  
  const processedRecords = useMemo(() => {
    return records.map(rec => {
      const monthId = getMonthID(rec.date);
      const monthPrices = prices[monthId] || {};
      
      let price = 0;
      if (rec.factoryId && monthPrices[rec.factoryId]) {
        price = parseFloat(monthPrices[rec.factoryId]);
      }

      const hasPrice = price > 0;
      const harvest = parseFloat(rec.harvestAmount) || 0;
      const labor = parseFloat(rec.laborCost) || 0;
      const transport = parseFloat(rec.transportCost) || 0;
      const other = parseFloat(rec.otherCost) || 0;
      const expenses = labor + transport + other;
      const workerCount = parseInt(rec.workerCount) || 0; 
      
      const income = harvest * price;
      const profit = income - expenses;

      return {
        ...rec, 
        monthId,
        price,
        hasPrice,
        harvest,
        expenses,
        income,
        profit,
        workerCount
      };
    });
  }, [records, prices]);


  // --- Auth & Data Loading ---
  useEffect(() => {
    const initAuth = async () => {
      try {
         // FIXED: Directly sign in anonymously without checking custom tokens
         await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };

    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // 1. Check for PINs
        const pinDocRef = doc(db, `artifacts/${__app_id}/users/${currentUser.uid}/settings`, 'security');
        const pinDoc = await getDoc(pinDocRef);

        if (pinDoc.exists() && pinDoc.data().adminPin) {
          setSavedAdminPin(pinDoc.data().adminPin);
          setSavedAppPin(pinDoc.data().appPin || null); 
          setAuthStatus('login_app_pin'); 
        } else {
          setAuthStatus('setup_admin_pin'); 
        }

        // 2. Load Tea Records
        const qRecords = query(
          collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/tea_records`),
          orderBy('date', 'desc')
        );
        const unsubRecords = onSnapshot(qRecords, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRecords(data);
        });

        // 3. Load Monthly Prices
        const qPrices = query(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/monthly_prices`));
        const unsubPrices = onSnapshot(qPrices, (snapshot) => {
          const pricesMap = {};
          snapshot.docs.forEach(doc => {
            pricesMap[doc.id] = doc.data(); 
          });
          setPrices(pricesMap);
        });

        // 4. Load Factories
        const qFactories = query(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/factories`));
        const unsubFactories = onSnapshot(qFactories, (snapshot) => {
          const factoryData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFactories(factoryData);
        });
        
        // 5. Load Plots
        const qPlots = query(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/plots`));
        const unsubPlots = onSnapshot(qPlots, (snapshot) => {
          const plotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setPlots(plotData);
        });

        // 6. Load Reminders
        const qReminders = query(
          collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/reminders`),
          orderBy('date', 'asc')
        );
        const unsubReminders = onSnapshot(qReminders, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setReminders(data);
        });

        setLoading(false);

        return () => {
          unsubRecords();
          unsubPrices();
          unsubFactories();
          unsubPlots(); 
          unsubReminders();
        };
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // --- Security Logic ---
  const handleSetupAdminPin = async (pin) => {
    if (pin.length < 4) {
      alert("කරුණාකර ඉලක්කම් 4ක හෝ ඊට වැඩි Admin PIN අංකයක් ලබා දෙන්න.");
      return;
    }
    try {
      await setDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/settings`, 'security'), {
        adminPin: pin,
        appPin: null 
      });
      setSavedAdminPin(pin);
      setSavedAppPin(null);
      setAuthStatus('admin_view'); 
      alert("Admin මුරපදය සාර්ථකව සකසන ලදී!");
    } catch (e) {
      console.error(e);
      alert("මුරපදය සැකසීමේදී දෝෂයක් ඇතිවිය.");
    }
  };
  
  const handleLoginAppPin = (pin) => {
    if (pin === savedAppPin) {
      setAuthStatus('worker_view');
      setInputPin('');
    } else {
      alert("සේවක මුරපදය වැරදියි!");
      setInputPin('');
    }
  };
  
  const handleLoginAdminPin = (pin) => {
    if (pin === savedAdminPin) {
      setAuthStatus('admin_view');
      setInputPin('');
    } else {
      alert("Admin මුරපදය වැරදියි!");
      setInputPin('');
    }
  };
  
  const handleChangeAdminPin = async (currentAdminPin, newAdminPin) => {
    if (currentAdminPin !== savedAdminPin) {
      alert("ඔබගේ වත්මන් Admin මුරපදය වැරදියි!");
      return false;
    }
    try {
      await updateDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/settings`, 'security'), {
        adminPin: newAdminPin
      });
      setSavedAdminPin(newAdminPin);
      return true;
    } catch (e) {
      console.error(e);
      alert("දෝෂයක් සිදුවිය!");
      return false;
    }
  };

  const handleChangeAppPin = async (adminPin, newAppPin) => {
    if (adminPin !== savedAdminPin) {
      alert("තහවුරු කිරීමට ඇතුළත් කළ Admin මුරපදය වැරදියි!");
      return false;
    }
    try {
      await updateDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/settings`, 'security'), {
        appPin: newAppPin
      });
      setSavedAppPin(newAppPin);
      return true;
    } catch (e) {
      console.error(e);
      alert("දෝෂයක් සිදුවිය!");
      return false;
    }
  };

  const handleLockApp = () => {
    setAuthStatus('login_app_pin');
    setActiveTab('dashboard');
  };
  
  const handleExitAdmin = () => {
    setAuthStatus('worker_view');
    setActiveTab('dashboard');
  }

  // --- Data Actions ---
  const handleAddRecord = async (formData) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${user.uid}/tea_records`), {
        ...formData,
        createdAt: serverTimestamp()
      });
      alert("දත්ත සාර්ථකව ඇතුළත් කරන ලදී!");
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };
  
  const handleUpdateRecord = async (recordData) => {
    if (!user || !recordData.id) return;
    const selectedPlot = plots.find(p => p.id === recordData.plotId);
    const selectedFactory = recordData.factoryId ? factories.find(f => f.id === recordData.factoryId) : null;

    const updatedData = {
      ...recordData,
      plotName: selectedPlot ? selectedPlot.name : 'Unknown Plot',
      factoryName: selectedFactory ? selectedFactory.name : null,
      updatedAt: serverTimestamp()
    };
    
    const recordId = updatedData.id;
    delete updatedData.id; 

    try {
      const docRef = doc(db, `artifacts/${__app_id}/users/${user.uid}/tea_records`, recordId);
      await updateDoc(docRef, updatedData);
      alert("වාර්තාව සාර්ථකව යාවත්කාලීන කරන ලදී!");
    } catch (error) {
      console.error("Error updating document: ", error);
    }
  };

  const handleSetPrice = async (monthId, factoryPrices) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/monthly_prices`, monthId), {
        ...factoryPrices,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert(`${getMonthName(monthId)} සඳහා මිල යාවත්කාලීන කරන ලදී.`);
    } catch (error) {
      console.error("Error setting price: ", error);
    }
  };

  const handleAddFactory = async (name) => {
    if (!user || !name.trim()) return;
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${user.uid}/factories`), {
        name: name.trim(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding factory: ", error);
    }
  };

  const handleDeleteFactory = async (id) => {
    if (!confirm("මෙම කර්මාන්ත ශාලාව ලැයිස්තුවෙන් ඉවත් කිරීමට අවශ්‍යද?")) return;
    try {
      await deleteDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/factories`, id));
    } catch (error) {
      console.error("Error deleting factory: ", error);
    }
  };
  
  const handleAddPlot = async (name) => {
    if (!user || !name.trim()) return;
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${user.uid}/plots`), {
        name: name.trim(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding plot: ", error);
    }
  };

  const handleDeletePlot = async (id) => {
    if (!confirm("මෙම ඉඩම ලැයිස්තුවෙන් ඉවත් කිරීමට අවශ්‍යද?")) return;
    try {
      await deleteDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/plots`, id));
    } catch (error) {
      console.error("Error deleting plot: ", error);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!confirm("මෙම වාර්තාව මකා දැමීමට අවශ්‍ය බව විශ්වාසද?")) return;
    try {
      await deleteDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/tea_records`, id));
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };
  
  const handleAddReminder = async (date) => {
    if (!user || !date) return;
    try {
      await addDoc(collection(db, `artifacts/${__app_id}/users/${user.uid}/reminders`), {
        date: date,
        type: 'fertilizer',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert("මතක් කිරීම සාර්ථකව එක් කරන ලදී!");
    } catch (error) {
      console.error("Error adding reminder: ", error);
    }
  };
  
  const handleUpdateReminderStatus = async (id, status) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/reminders`, id), {
        status: status
      });
    } catch (error) {
      console.error("Error updating reminder: ", error);
    }
  };
  
  const handleDeleteReminder = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/reminders`, id));
    } catch (error) {
      console.error("Error deleting reminder: ", error);
    }
  };

  // --- RENDER LOGIC ---

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-green-700 font-bold">සකසමින් පවතී...</div>;
  }
  
  if (authStatus === 'setup_admin_pin') {
    return <PinScreen 
      title="Admin මුරපදය සාදන්න"
      message="පළමු වරට පිවිසීම. කරුණාකර ප්‍රධාන Admin PIN අංකයක් සකසන්න."
      onSubmit={handleSetupAdminPin}
      buttonText="සකසන්න"
      icon={ShieldCheck}
    />
  }
  
  if (authStatus === 'login_app_pin') {
    return <PinScreen 
      title="ඇතුල් වන්න"
      message="කරුණාකර සේවක PIN අංකය ඇතුළත් කරන්න."
      onSubmit={handleLoginAppPin}
      buttonText="ඇතුල් වන්න"
      icon={Lock}
      disabled={!savedAppPin}
      disabledMessage="සේවක PIN අංකයක් සකසා නොමැත. Admin ලෙස පිවිසෙන්න."
      onAdminLoginClick={() => setAuthStatus('login_admin_pin')}
    />
  }
  
  if (authStatus === 'login_admin_pin') {
    return <PinScreen 
      title="Admin පිවිසුම"
      message="කරුණාකර Admin PIN අංකය ඇතුළත් කරන්න."
      onSubmit={handleLoginAdminPin}
      buttonText="Admin පිවිසුම"
      icon={UserCheck}
    />
  }
  
  // Worker View
  if (authStatus === 'worker_view') {
     return (
       <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
         <header className="bg-green-800 text-white p-4 shadow-lg sticky top-0 z-40">
           <div className="max-w-6xl mx-auto flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="bg-white/20 p-2 rounded-full">
                 <Sprout className="h-6 w-6 text-white" />
               </div>
               <h1 className="text-lg md:text-xl font-bold">දෛනික දත්ත ඇතුළත් කිරීම</h1>
             </div>
             <button 
               onClick={() => setAuthStatus('login_admin_pin')} 
               className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors border border-blue-400">
               <UserCheck className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span>
             </button>
           </div>
         </header>
         <main className="max-w-6xl mx-auto p-4">
           <EntryForm factories={factories} plots={plots} onSubmit={handleAddRecord} />
         </main>
       </div>
     );
  }

  // Admin View
  if (authStatus === 'admin_view') {
    return (
      <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:pb-0">
        <header className="bg-green-800 text-white p-4 shadow-lg sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Sprout className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold leading-tight">තේ වතු පාලක (Admin)</h1>
                <p className="text-[10px] md:text-xs text-green-200 opacity-90">Smart Tea Estate Manager</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExitAdmin} className="bg-blue-600/50 hover:bg-blue-600 p-2 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors border border-blue-700">
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Worker View</span>
              </button>
              <button onClick={handleLockApp} className="bg-green-900/50 hover:bg-green-900 p-2 rounded-lg flex items-center gap-2 text-xs font-medium transition-colors border border-green-700">
                <Lock className="w-4 h-4" /> <span className="hidden sm:inline">Lock</span>
              </button>
            </div>
          </div>
        </header>

        <div className="hidden md:block bg-white border-b border-gray-200 shadow-sm mb-6">
          <div className="max-w-6xl mx-auto flex gap-1">
            <DesktopTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="සාරාංශ පුවරුව" />
            <DesktopTab active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FileText} label="සවිස්තර වාර්තා" />
            <DesktopTab active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={PlusCircle} label="දිනපතා දත්ත" />
            <DesktopTab active={activeTab === 'prices'} onClick={() => setActiveTab('prices')} icon={Coins} label="මිල ගණන්" />
            <DesktopTab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="සැකසුම්" />
          </div>
        </div>

        <main className="max-w-6xl mx-auto p-4">
          {activeTab === 'dashboard' && <DashboardView records={processedRecords} reminders={reminders} onUpdateReminder={handleUpdateReminderStatus} plots={plots} />}
          {activeTab === 'reports' && <HistoricalReportsView 
                                        records={processedRecords} 
                                        onDelete={handleDeleteRecord} 
                                        onUpdate={handleUpdateRecord} 
                                        factories={factories} 
                                        plots={plots} 
                                      />}
          {activeTab === 'entry' && <EntryForm factories={factories} plots={plots} onSubmit={handleAddRecord} />}
          {activeTab === 'prices' && <PriceManager prices={prices} factories={factories} onSave={handleSetPrice} />}
          {activeTab === 'settings' && <SettingsManager 
                                        factories={factories} 
                                        onAddFactory={handleAddFactory} 
                                        onDeleteFactory={handleDeleteFactory}
                                        plots={plots}
                                        onAddPlot={handleAddPlot}
                                        onDeletePlot={handleDeletePlot}
                                        savedAdminPin={savedAdminPin}
                                        savedAppPin={savedAppPin}
                                        onChangeAdminPin={handleChangeAdminPin}
                                        onChangeAppPin={handleChangeAppPin}
                                        reminders={reminders}
                                        onAddReminder={handleAddReminder}
                                        onUpdateReminder={handleUpdateReminderStatus}
                                        onDeleteReminder={handleDeleteReminder}
                                      />}
        </main>

        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 grid grid-cols-5 px-1 py-2 z-50 md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="සාරාංශ" />
          <NavButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FileText} label="වාර්තා" />
          <NavButton active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={PlusCircle} label="නව දත්ත" />
          <NavButton active={activeTab === 'prices'} onClick={() => setActiveTab('prices')} icon={Coins} label="මිල" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="සැකසුම්" />
        </div>
      </div>
    );
  }
  
  return null; 
}

// --- Reusable Components ---
const PinScreen = ({ title, message, onSubmit, buttonText, icon: Icon, disabled = false, disabledMessage = "", onAdminLoginClick = null }) => {
  const [pin, setPin] = useState('');
  const handleSubmit = (e) => { e.preventDefault(); if (disabled) return; onSubmit(pin); setPin(''); };
  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Icon className="w-10 h-10 text-green-600" /></div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        {disabled ? (
           <div className="space-y-4"><div className="text-center p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">{disabledMessage}</div>{onAdminLoginClick && (<button type="button" onClick={onAdminLoginClick} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><UserCheck className="w-4 h-4" /> Admin පිවිසුම</button>)}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="password" inputMode="numeric" maxLength="6" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full text-center text-3xl tracking-[1em] font-bold p-4 border-2 border-green-200 rounded-xl outline-none mb-6 text-gray-700" autoFocus />
            <button type="submit" className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-xl">{buttonText}</button>
          </form>
        )}
      </div>
    </div>
  );
};

const MonthStats = ({ records }) => {
  const stats = useMemo(() => {
    let totalHarvest = 0; let confirmedIncome = 0; let totalExpenses = 0; let pendingHarvest = 0;
    records.forEach(rec => {
      totalHarvest += rec.harvest; totalExpenses += rec.expenses;
      if (rec.hasPrice) { confirmedIncome += rec.income; } else { pendingHarvest += rec.harvest; }
    });
    const cashFlow = confirmedIncome - totalExpenses;
    return { totalHarvest, confirmedIncome, totalExpenses, cashFlow, pendingHarvest };
  }, [records]);
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="මුළු දළු අස්වැන්න" value={`${stats.totalHarvest.toFixed(1)} kg`} icon={Sprout} color="bg-green-500" />
        <StatCard title="තහවුරු වූ ආදායම" value={formatLKR(stats.confirmedIncome)} icon={Wallet} color="bg-blue-500" />
        <StatCard title="මුළු වියදම" value={formatLKR(stats.totalExpenses)} icon={TrendingDown} color="bg-red-500" />
        <StatCard title="ලාභය/අලාභය" value={formatLKR(stats.cashFlow)} icon={TrendingUp} color={stats.cashFlow >= 0 ? "bg-emerald-600" : "bg-orange-500"} />
      </div>
      {stats.pendingHarvest > 0 && (<div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg flex items-center gap-3 text-xs"><AlertCircle className="text-yellow-600 w-5 h-5 flex-shrink-0" /><p className="text-yellow-700">මිල තීරණය නොකළ දළු <strong>{stats.pendingHarvest.toFixed(1)} kg</strong> ඇත.</p></div>)}
    </>
  );
};

const DashboardView = ({ records, reminders, onUpdateReminder, plots }) => {
  const [selectedPlot, setSelectedPlot] = useState('all'); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const currentMonthID = selectedMonth;
  const currentMonthRecords = useMemo(() => records.filter(r => r.monthId === currentMonthID && (selectedPlot === 'all' || r.plotId === selectedPlot)), [records, currentMonthID, selectedPlot]);
  const dueReminders = useMemo(() => { const today = new Date().setHours(0, 0, 0, 0); return reminders.filter(r => r.status === 'pending' && new Date(r.date).setHours(0, 0, 0, 0) <= today); }, [reminders]);
  const expenseDistribution = useMemo(() => {
    let labor = 0, transport = 0, other = 0;
    currentMonthRecords.forEach(r => { labor += r.laborCost || 0; transport += r.transportCost || 0; other += r.otherCost || 0; });
    return [{ name: 'කම්කරු පඩි', value: labor, color: '#EF4444' }, { name: 'ප්‍රවාහන/ආහාර', value: transport, color: '#F59E0B' }, { name: 'වෙනත්', value: other, color: '#3B82F6' }].filter(item => item.value > 0);
  }, [currentMonthRecords]);

  return (
    <div className="space-y-6">
      {dueReminders.length > 0 && (<div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm"><div className="flex items-start gap-3"><BellRing className="text-blue-600 w-5 h-5 flex-shrink-0 mt-0.5" /><div><h3 className="font-bold text-blue-800 text-sm">සිදුවිය යුතු මතක් කිරීම්</h3>{dueReminders.map(r => (<div key={r.id} className="flex items-center justify-between gap-4 mt-2"><p className="text-blue-700 text-xs"><strong>{formatDate(r.date)}</strong> දිනට නියමිත <strong>පොහොර යෙදීම</strong>.</p><button onClick={() => onUpdateReminder(r.id, 'completed')} className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-700 transition-colors">සම්පූර්ණයි</button></div>))}</div></div></div>)}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3"><h2 className="text-lg font-bold text-gray-700 border-b-2 border-green-500 pb-1 inline-block">{getMonthName(currentMonthID)} - සාරාංශය</h2><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 text-sm bg-white" /></div>
        <div className="flex items-center gap-2"><label htmlFor="plotFilter" className="text-sm font-medium text-gray-700">ඉඩම:</label><select id="plotFilter" value={selectedPlot} onChange={(e) => setSelectedPlot(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 text-sm bg-white"><option value="all">සියලුම ඉඩම්</option>{plots.map(plot => (<option key={plot.id} value={plot.id}>{plot.name}</option>))}</select></div>
      </div>
      <MonthStats records={currentMonthRecords} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200"><h3 className="text-sm font-bold uppercase text-gray-500 mb-4">වියදම් බෙදීයාම</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{expenseDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={(value) => formatLKR(value)} /><Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{fontSize: "12px"}}/></PieChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
};

const HistoricalReportsView = ({ records, onDelete, onUpdate, factories, plots }) => {
  const [viewMode, setViewMode] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedPlot, setSelectedPlot] = useState('all'); 
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const monthlyRecords = useMemo(() => records.filter(r => r.monthId === selectedMonth && (selectedPlot === 'all' || r.plotId === selectedPlot)).sort((a, b) => new Date(a.date) - new Date(b.date)), [records, selectedMonth, selectedPlot]);
  const handleOpenEditModal = (record) => { setEditingRecord(record); setIsEditModalOpen(true); };
  const handleCloseEditModal = () => { setEditingRecord(null); setIsEditModalOpen(false); };
  const handleSaveEdit = (updatedData) => { onUpdate(updatedData); handleCloseEditModal(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-2"><label className="text-sm font-medium text-gray-700">මාසය:</label><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700" /></div>
        <div className="flex items-center gap-2"><label className="text-sm font-medium text-gray-700">ඉඩම:</label><select value={selectedPlot} onChange={(e) => setSelectedPlot(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 bg-white"><option value="all">සියලුම ඉඩම්</option>{plots.map(plot => (<option key={plot.id} value={plot.id}>{plot.name}</option>))}</select></div>
      </div>
      {monthlyRecords.length === 0 ? (<div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed"><CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />{getMonthName(selectedMonth)} සඳහා දත්ත නොමැත.</div>) : (
        <>
          <MonthStats records={monthlyRecords} />
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs"><tr><th className="p-4">දිනය / ඉඩම</th><th className="p-4">කර්මාන්ත ශාලාව</th><th className="p-4 text-right">අස්වැන්න (kg)</th><th className="p-4 text-right">වියදම</th><th className="p-4 text-right">ආදායම</th><th className="p-4 text-center">ක්‍රියා</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{monthlyRecords.map((rec) => (<tr key={rec.id} className="hover:bg-gray-50"><td className="p-4"><div className="font-bold text-gray-800">{formatDate(rec.date)}</div><div className="text-xs text-blue-700 mt-1">{rec.plotName}</div></td><td className="p-4">{rec.factoryName || '-'}</td><td className="p-4 text-right text-green-700 font-bold">{rec.harvest.toFixed(1)}</td><td className="p-4 text-right text-red-600">{formatLKR(rec.expenses)}</td><td className="p-4 text-right">{rec.hasPrice ? formatLKR(rec.income) : <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>}</td><td className="p-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleOpenEditModal(rec)} className="text-gray-400 hover:text-blue-500"><Pencil className="h-4 w-4" /></button><button onClick={() => onDelete(rec.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {isEditModalOpen && (<EditRecordModal record={editingRecord} factories={factories} plots={plots} onSave={handleSaveEdit} onClose={handleCloseEditModal} />)}
    </div>
  );
};

const SettingsManager = ({ factories, onAddFactory, onDeleteFactory, plots, onAddPlot, onDeletePlot, savedAdminPin, savedAppPin, onChangeAdminPin, onChangeAppPin, reminders, onAddReminder, onUpdateReminder, onDeleteReminder }) => {
  const [newFactory, setNewFactory] = useState(''); const [newPlot, setNewPlot] = useState(''); 
  const [currentAdminPin, setCurrentAdminPin] = useState(''); const [newAdminPin, setNewAdminPin] = useState(''); const [confirmAdminPin, setConfirmAdminPin] = useState('');
  const [authAdminPin, setAuthAdminPin] = useState(''); const [newAppPin, setNewAppPin] = useState(''); const [confirmAppPin, setConfirmAppPin] = useState('');
  const [reminderDate, setReminderDate] = useState('');

  const handleAddFactorySubmit = (e) => { e.preventDefault(); onAddFactory(newFactory); setNewFactory(''); };
  const handleAddPlotSubmit = (e) => { e.preventDefault(); onAddPlot(newPlot); setNewPlot(''); };
  const handleChangeAdminPinSubmit = async (e) => { e.preventDefault(); if (newAdminPin !== confirmAdminPin || newAdminPin.length < 4) return alert("නව මුරපදය වලංගු නැත"); if (await onChangeAdminPin(currentAdminPin, newAdminPin)) { setCurrentAdminPin(''); setNewAdminPin(''); setConfirmAdminPin(''); alert("සාර්ථකයි!"); } };
  const handleChangeAppPinSubmit = async (e) => { e.preventDefault(); if (newAppPin !== confirmAppPin || newAppPin.length < 4) return alert("නව මුරපදය වලංගු නැත"); if (await onChangeAppPin(authAdminPin, newAppPin)) { setAuthAdminPin(''); setNewAppPin(''); setConfirmAppPin(''); alert("සාර්ථකයි!"); } };
  const handleAddReminderSubmit = (e) => { e.preventDefault(); if (!reminderDate) return; onAddReminder(reminderDate); setReminderDate(''); };
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="mb-8 p-4 border rounded-lg bg-gray-50/50"><h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600"/> ඉඩම් ලැයිස්තුව</h3><form onSubmit={handleAddPlotSubmit} className="flex gap-2 mb-4"><input type="text" value={newPlot} onChange={(e) => setNewPlot(e.target.value)} placeholder="ඉඩමේ නම" className="flex-1 p-3 border border-gray-300 rounded-lg outline-none" /><button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold">එකතු කරන්න</button></form><div className="space-y-2">{plots.map(plot => (<div key={plot.id} className="flex justify-between items-center p-3 bg-white rounded-lg border"><span className="font-medium text-gray-800">{plot.name}</span><button onClick={() => onDeletePlot(plot.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>))}</div></div>
        <div className="mb-8 p-4 border rounded-lg bg-gray-50/50"><h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Factory className="w-4 h-4 text-green-600"/> කර්මාන්ත ශාලා ලැයිස්තුව</h3><form onSubmit={handleAddFactorySubmit} className="flex gap-2 mb-4"><input type="text" value={newFactory} onChange={(e) => setNewFactory(e.target.value)} placeholder="කර්මාන්ත ශාලාවේ නම" className="flex-1 p-3 border border-gray-300 rounded-lg outline-none" /><button type="submit" className="bg-green-700 text-white px-6 rounded-lg font-bold">එකතු කරන්න</button></form><div className="space-y-2">{factories.map(factory => (<div key={factory.id} className="flex justify-between items-center p-3 bg-white rounded-lg border"><span className="font-medium text-gray-800">{factory.name}</span><button onClick={() => onDeleteFactory(factory.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>))}</div></div>
        <div className="mb-8 p-4 border rounded-lg bg-gray-50/50"><h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Bell className="w-4 h-4"/> මතක් කිරීම්</h3><form onSubmit={handleAddReminderSubmit} className="flex gap-2 mb-4"><input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="flex-1 p-3 border border-gray-300 rounded-lg outline-none" /><button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold">එක් කරන්න</button></form><div className="space-y-2">{reminders.map(r => (<div key={r.id} className="flex justify-between items-center p-3 bg-white rounded-lg border"><span className={`font-medium ${r.status === 'completed' ? 'line-through text-gray-400' : 'text-blue-800'}`}>{formatDate(r.date)}</span><div className="flex gap-2">{r.status !== 'completed' && <button onClick={() => onUpdateReminder(r.id, 'completed')} className="text-green-500"><Check className="w-4 h-4" /></button>}<button onClick={() => onDeleteReminder(r.id)} className="text-red-400"><X className="w-4 h-4" /></button></div></div>))}</div></div>
        <div className="space-y-6">
          <div className="p-4 border rounded-lg bg-gray-50/50"><h3 className="text-sm font-bold text-gray-700 mb-2">Admin මුරපදය වෙනස් කිරීම</h3><form onSubmit={handleChangeAdminPinSubmit} className="space-y-4"><input type="password" value={currentAdminPin} onChange={(e) => setCurrentAdminPin(e.target.value)} placeholder="වත්මන් Admin PIN" className="w-full p-3 border rounded-lg" /><input type="password" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="නව Admin PIN" className="w-full p-3 border rounded-lg" /><input type="password" value={confirmAdminPin} onChange={(e) => setConfirmAdminPin(e.target.value)} placeholder="තහවුරු කරන්න" className="w-full p-3 border rounded-lg" /><button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">වෙනස් කරන්න</button></form></div>
          <div className="p-4 border rounded-lg bg-gray-50/50"><h3 className="text-sm font-bold text-gray-700 mb-2">සේවක මුරපදය වෙනස් කිරීම</h3><form onSubmit={handleChangeAppPinSubmit} className="space-y-4"><input type="password" value={authAdminPin} onChange={(e) => setAuthAdminPin(e.target.value)} placeholder="Admin PIN (තහවුරු කිරීමට)" className="w-full p-3 border rounded-lg" /><input type="password" value={newAppPin} onChange={(e) => setNewAppPin(e.target.value)} placeholder="නව සේවක PIN" className="w-full p-3 border rounded-lg" /><input type="password" value={confirmAppPin} onChange={(e) => setConfirmAppPin(e.target.value)} placeholder="තහවුරු කරන්න" className="w-full p-3 border rounded-lg" /><button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">වෙනස් කරන්න</button></form></div>
        </div>
      </div>
    </div>
  );
};

const EntryForm = ({ onSubmit, factories, plots }) => {
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], plotId: '', factoryId: '', harvestAmount: '', workerCount: '', laborCost: '', transportCost: '', otherCost: '', notes: '', image: null });
  const fileInputRef = useRef(null);
  useEffect(() => { if (plots.length > 0 && !formData.plotId) setFormData(prev => ({ ...prev, plotId: plots[0].id })); if (factories.length > 0 && !formData.factoryId) setFormData(prev => ({ ...prev, factoryId: factories[0].id })); }, [plots, factories]);
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleImageChange = async (e) => { const file = e.target.files[0]; if (file) { const compressed = await compressImage(file); setFormData(prev => ({ ...prev, image: compressed })); } };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (plots.length === 0) return alert("කරුණාකර ඉඩමක් එකතු කරන්න.");
    const selectedPlot = plots.find(p => p.id === formData.plotId);
    const selectedFactory = factories.find(f => f.id === formData.factoryId);
    onSubmit({ ...formData, plotName: selectedPlot.name, factoryName: selectedFactory ? selectedFactory.name : null, harvestAmount: Number(formData.harvestAmount), workerCount: Number(formData.workerCount), laborCost: Number(formData.laborCost), transportCost: Number(formData.transportCost), otherCost: Number(formData.otherCost) });
    setFormData(prev => ({ ...prev, harvestAmount: '', workerCount: '', laborCost: '', transportCost: '', otherCost: '', notes: '', image: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-sm font-semibold text-gray-700">දිනය</label><input type="date" required name="date" value={formData.date} onChange={handleChange} className="w-full p-3 border rounded-lg" /></div><div className="space-y-2"><label className="text-sm font-semibold text-gray-700">ඉඩම</label><select required name="plotId" value={formData.plotId} onChange={handleChange} className="w-full p-3 border rounded-lg">{plots.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><label className="text-sm font-semibold text-green-700">දළු ප්‍රමාණය (KG)</label><input type="number" step="0.1" placeholder="0.0" name="harvestAmount" value={formData.harvestAmount} onChange={handleChange} className="w-full p-3 bg-green-50 border-green-200 rounded-lg font-bold text-green-800" /></div><div className="space-y-2"><label className="text-sm font-semibold text-gray-700">කම්කරු ගණන</label><input type="number" placeholder="0" name="workerCount" value={formData.workerCount} onChange={handleChange} className="w-full p-3 border rounded-lg" /></div></div>
        {Number(formData.harvestAmount) > 0 && (<div className="space-y-2"><label className="text-sm font-semibold text-gray-700">කර්මාන්ත ශාලාව</label><select required name="factoryId" value={formData.factoryId} onChange={handleChange} className="w-full p-3 border rounded-lg">{factories.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}</select></div>)}
        <div className="bg-red-50/50 p-4 rounded-xl border border-red-100"><label className="text-sm font-bold text-red-800 mb-3 block">වියදම්</label><div className="grid grid-cols-3 gap-4"><input type="number" placeholder="පඩි" name="laborCost" value={formData.laborCost} onChange={handleChange} className="p-2 border rounded" /><input type="number" placeholder="ප්‍රවාහන" name="transportCost" value={formData.transportCost} onChange={handleChange} className="p-2 border rounded" /><input type="number" placeholder="වෙනත්" name="otherCost" value={formData.otherCost} onChange={handleChange} className="p-2 border rounded" /></div></div>
        <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">සටහන්</label><textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-3 border rounded-lg h-20"></textarea></div>
        <div className="space-y-2"><label className="text-sm font-semibold text-gray-700">ඡායාරූපය</label><input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div>
        <button type="submit" className="w-full bg-green-700 text-white font-bold py-3 rounded-xl">දත්ත සුරකින්න</button>
      </form>
    </div>
  );
};

const EditRecordModal = ({ record, factories, plots, onSave, onClose }) => {
  const [formData, setFormData] = useState({ ...record });
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, harvestAmount: Number(formData.harvestAmount), workerCount: Number(formData.workerCount), laborCost: Number(formData.laborCost), transportCost: Number(formData.transportCost), otherCost: Number(formData.otherCost) }); };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">සංස්කරණය</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded" />
          <select name="plotId" value={formData.plotId} onChange={handleChange} className="w-full p-2 border rounded">{plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="number" name="harvestAmount" value={formData.harvestAmount} onChange={handleChange} className="w-full p-2 border rounded" placeholder="අස්වැන්න" />
          <div className="flex gap-2"><button type="button" onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded">අවලංගුයි</button><button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded">සුරකින්න</button></div>
        </form>
      </div>
    </div>
  );
};

const PriceManager = ({ prices, factories, onSave }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [inputPrices, setInputPrices] = useState({});
  useEffect(() => { setInputPrices(prices[selectedMonth] || {}); }, [selectedMonth, prices]);
  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-sm">
      <h2 className="text-xl font-bold mb-4">මිල ගණන්</h2>
      <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full p-3 border rounded-lg mb-4" />
      <div className="space-y-3">{factories.map(f => (<div key={f.id} className="flex items-center gap-3"><span className="flex-1">{f.name}</span><input type="number" value={inputPrices[f.id] || ''} onChange={(e) => setInputPrices(prev => ({ ...prev, [f.id]: e.target.value }))} className="w-32 p-2 border rounded text-right" placeholder="Rs." /></div>))}</div>
      <button onClick={() => onSave(selectedMonth, inputPrices)} className="w-full bg-yellow-500 text-white font-bold py-3 rounded-lg mt-4">මිල යාවත්කාලීන කරන්න</button>
    </div>
  );
};

const NavButton = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 w-full ${active ? 'text-green-700' : 'text-gray-400'}`}><Icon className={`h-5 w-5 ${active ? 'fill-green-100 stroke-green-700' : ''}`} /><span className={`text-[9px] font-medium ${active ? 'font-bold' : ''}`}>{label}</span></button>
);
const DesktopTab = ({ active, onClick, label, icon: Icon }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 ${active ? 'border-green-700 text-green-800 bg-green-50' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}><Icon className="w-4 h-4" /> {label}</button>
);
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full"><div className="flex items-start justify-between mb-3"><div className={`p-2.5 rounded-lg text-white ${color} shadow-sm`}><Icon className="w-5 h-5" /></div></div><div><h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{title}</h3><p className="text-xl font-bold text-gray-800 mt-1 truncate tracking-tight">{value}</p></div></div>
);