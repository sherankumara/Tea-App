import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
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
  updateDoc,
  where
} from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
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
  Calendar,
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
  BrainCircuit, 
  Loader2, 
  Users, 
  MapPin, 
  Pencil, 
  Save,
  Image as ImageIcon, 
  Camera, 
  Eye,
  Download, 
  Table
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Gemini API Configuration ---
const API_KEY = ""; // Leave as-is, Canvas will inject the key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

/**
 * Calls the Gemini API with optional grounding and exponential backoff.
 */
const callGeminiApi = async (userPrompt, withGrounding = false, systemInstructionText = null) => {
  let payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
  };

  if (withGrounding) {
    payload.tools = [{ "google_search": {} }];
  }

  if (systemInstructionText) {
    payload.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // Don't log 429 (throttling) as a hard error in console
        if (response.status !== 429) {
          console.error(`API call failed with status ${response.status}`);
        }
        throw new Error(`API call failed with status ${response.status}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        return { text }; // Return object
      } else {
        // Handle cases where API returns 200 OK but no content
        throw new Error("No text content returned from API.");
      }
    } catch (error) {
      // console.error("Gemini API Error:", error.message);
      retries--;
      if (retries === 0) {
        return { error: "Gemini API ඇමතීම අසාර්ථක විය. කරුණාකර නැවත උත්සාහ කරන්න. (Error: " + error.message + ")" };
      }
      // Implement exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; 
    }
  }
};


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
  // Use UTC date parts to avoid timezone shift issues
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const correctedDate = new Date(date.getTime() + userTimezoneOffset);
  
  return correctedDate.toLocaleDateString('si-LK', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC' // Specify UTC to match the input
  });
};


const getMonthID = (dateString) => {
  return dateString.substring(0, 7); // Returns "YYYY-MM"
};

const getMonthName = (monthId, type = 'long') => {
  if (!monthId) return "";
  const [year, month] = monthId.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('si-LK', { year: 'numeric', month: type });
};

/**
 * Compresses an image file to a Base64 string with reduced quality and size.
 * Max width/height: 800px. Quality: 0.5.
 */
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
        // Compress to JPEG at 50% quality
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
  const [authStatus, setAuthStatus] = useState('loading'); // loading, setup_admin_pin, login_app_pin, login_admin_pin, worker_view, admin_view
  const [savedAdminPin, setSavedAdminPin] = useState(null);
  const [savedAppPin, setSavedAppPin] = useState(null);
  const [inputPin, setInputPin] = useState('');
  
  // Processed data derived from records and prices
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
        ...rec, // Includes plotId, plotName, image (base64)
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
        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
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
          setAuthStatus('login_app_pin'); // Default to worker login
        } else {
          setAuthStatus('setup_admin_pin'); // First time load
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
        appPin: null // App pin must be set from settings
      });
      setSavedAdminPin(pin);
      setSavedAppPin(null);
      setAuthStatus('admin_view'); // Log in as admin immediately
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
      // Don't change tab, worker stays on entry form
    } catch (error) {
      console.error("Error adding document: ", error);
      if (error.message.includes("exceeds")) {
        alert("රූපයේ විශාලත්වය වැඩියි. කරුණාකර කුඩා රූපයක් භාවිතා කරන්න.");
      }
    }
  };
  
  const handleUpdateRecord = async (recordData) => {
    if (!user || !recordData.id) return;
    
    // Find the plot and factory names based on IDs
    const selectedPlot = plots.find(p => p.id === recordData.plotId);
    const selectedFactory = recordData.factoryId ? factories.find(f => f.id === recordData.factoryId) : null;

    const updatedData = {
      ...recordData,
      plotName: selectedPlot ? selectedPlot.name : 'Unknown Plot',
      factoryName: selectedFactory ? selectedFactory.name : null,
      updatedAt: serverTimestamp()
    };
    
    // Remove 'id' from the data object before sending to Firestore
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
  
  // PIN Screens
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
        {/* Header */}
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

        {/* Desktop Navigation */}
        <div className="hidden md:block bg-white border-b border-gray-200 shadow-sm mb-6">
          <div className="max-w-6xl mx-auto flex gap-1">
            <DesktopTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="සාරාංශ පුවරුව" />
            <DesktopTab active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FileText} label="සවිස්තර වාර්තා" />
            <DesktopTab active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={PlusCircle} label="දිනපතා දත්ත" />
            <DesktopTab active={activeTab === 'prices'} onClick={() => setActiveTab('prices')} icon={Coins} label="මිල ගණන්" />
            <DesktopTab active={activeTab === 'advice'} onClick={() => setActiveTab('advice')} icon={Sparkles} label="Gemini උපදෙස්" />
            <DesktopTab active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="සැකසුම්" />
          </div>
        </div>

        {/* Main Content */}
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
          {activeTab === 'advice' && <GeminiAdviceView />}
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

        {/* Mobile Navigation */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 grid grid-cols-6 px-1 py-2 z-50 md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="සාරාංශ" />
          <NavButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FileText} label="වාර්තා" />
          <NavButton active={activeTab === 'entry'} onClick={() => setActiveTab('entry')} icon={PlusCircle} label="නව දත්ත" />
          <NavButton active={activeTab === 'prices'} onClick={() => setActiveTab('prices')} icon={Coins} label="මිල" />
          <NavButton active={activeTab === 'advice'} onClick={() => setActiveTab('advice')} icon={Sparkles} label="උපදෙස්" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="සැකසුම්" />
        </div>
      </div>
    );
  }
  
  return null; 
}

// --- Reusable PIN Screen ---
const PinScreen = ({ 
  title, 
  message, 
  onSubmit, 
  buttonText, 
  icon: Icon, 
  disabled = false, 
  disabledMessage = "",
  onAdminLoginClick = null 
}) => {
  const [pin, setPin] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (disabled) return;
    onSubmit(pin);
    setPin('');
  };

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        
        {disabled ? (
           <div className="space-y-4">
             <div className="text-center p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">{disabledMessage}</div>
             {onAdminLoginClick && (
               <button 
                 type="button" 
                 onClick={onAdminLoginClick}
                 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
               >
                 <UserCheck className="w-4 h-4" /> Admin පිවිසුම
               </button>
             )}
           </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input 
              type="password" inputMode="numeric" maxLength="6" placeholder="PIN"
              value={pin} onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-3xl tracking-[1em] font-bold p-4 border-2 border-green-200 rounded-xl outline-none mb-6 text-gray-700"
              autoFocus
            />
            <button type="submit" className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-xl">
              {buttonText}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};


// --- Reusable Stats Component ---
const MonthStats = ({ records }) => {
  const stats = useMemo(() => {
    let totalHarvest = 0;
    let confirmedIncome = 0;
    let totalExpenses = 0;
    let pendingHarvest = 0;

    records.forEach(rec => {
      totalHarvest += rec.harvest;
      totalExpenses += rec.expenses;
      if (rec.hasPrice) {
        confirmedIncome += rec.income;
      } else {
        pendingHarvest += rec.harvest;
      }
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
      {stats.pendingHarvest > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg flex items-center gap-3 text-xs">
          <AlertCircle className="text-yellow-600 w-5 h-5 flex-shrink-0" />
          <p className="text-yellow-700">මිල තීරණය නොකළ දළු <strong>{stats.pendingHarvest.toFixed(1)} kg</strong> ඇත.</p>
        </div>
      )}
    </>
  );
};

// --- Main Views ---

const DashboardView = ({ records, reminders, onUpdateReminder, plots }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);
  const [selectedPlot, setSelectedPlot] = useState('all'); 
  
  // NEW: Date Selection State (Default to current month)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Calculate Date Ranges based on selectedMonth
  const currentMonthID = selectedMonth;
  
  // Calculate previous month based on selectedMonth
  const lastMonthDate = new Date(selectedMonth + '-01'); 
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthID = lastMonthDate.toISOString().slice(0, 7);

  // Filter Records (NOW respects selectedPlot)
  const currentMonthRecords = useMemo(() => {
    return records.filter(r => 
      r.monthId === currentMonthID && 
      (selectedPlot === 'all' || r.plotId === selectedPlot)
    );
  }, [records, currentMonthID, selectedPlot]);
  
  const lastMonthRecords = useMemo(() => {
    return records.filter(r => 
      r.monthId === lastMonthID && 
      (selectedPlot === 'all' || r.plotId === selectedPlot)
    );
  }, [records, lastMonthID, selectedPlot]);

  // Find due reminders
  const dueReminders = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return reminders.filter(r => r.status === 'pending' && new Date(r.date).setHours(0, 0, 0, 0) <= today);
  }, [reminders]);

  // Create comparative chart data
  const comparativeChartData = useMemo(() => {
    const data = [];
    for (let i = 1; i <= 31; i++) {
      let currentHarvest = 0, lastHarvest = 0, currentProfit = 0, lastProfit = 0;

      currentMonthRecords.forEach(r => {
        // Use getUTCDate() to handle timezone consistency
        if (new Date(r.date).getUTCDate() === i) {
          currentHarvest += r.harvest;
          currentProfit += r.profit;
        }
      });
      lastMonthRecords.forEach(r => {
        if (new Date(r.date).getUTCDate() === i) {
          lastHarvest += r.harvest;
          lastProfit += r.profit;
        }
      });

      if (currentHarvest > 0 || lastHarvest > 0) {
        data.push({
          "දිනය": i, // Changed 'day' to 'දිනය' for Sinhala tooltip
          "තෝරාගත් මාසය (kg)": currentHarvest,
          "පසුගිය මාසය (kg)": lastHarvest,
          "තෝරාගත් මාසයේ ලාභය": currentProfit,
          "පසුගිය මාසයේ ලාභය": lastProfit,
        });
      }
    }
    return data;
  }, [currentMonthRecords, lastMonthRecords]);

  // --- Calculate Expense Distribution (NEW) ---
  const expenseDistribution = useMemo(() => {
    let labor = 0, transport = 0, other = 0;
    currentMonthRecords.forEach(r => {
      labor += r.laborCost || 0;
      transport += r.transportCost || 0;
      other += r.otherCost || 0;
    });
    return [
      { name: 'කම්කරු පඩි', value: labor, color: '#EF4444' }, // Red
      { name: 'ප්‍රවාහන/ආහාර', value: transport, color: '#F59E0B' }, // Amber
      { name: 'වෙනත්', value: other, color: '#3B82F6' } // Blue
    ].filter(item => item.value > 0);
  }, [currentMonthRecords]);
  
  // --- Gemini: Handle Performance Analysis ---
  const handleAnalyzePerformance = async () => {
    setIsGeminiLoading(true);
    setGeminiResult(null);
    setIsModalOpen(true); 

    // 1. Get stats for the prompt
    let totalHarvest = 0;
    let confirmedIncome = 0;
    let totalExpenses = 0;
    let pendingHarvest = 0;
    let totalWorkerDays = 0; 

    currentMonthRecords.forEach(rec => {
      totalHarvest += rec.harvest;
      totalExpenses += rec.expenses;
      totalWorkerDays += rec.workerCount; 
      if (rec.hasPrice) {
        confirmedIncome += rec.income;
      } else {
        pendingHarvest += rec.harvest;
      }
    });
    const cashFlow = confirmedIncome - totalExpenses;
    const costPerKg = totalHarvest > 0 ? (totalExpenses / totalHarvest) : 0;
    const kgPerWorkerDay = totalWorkerDays > 0 ? (totalHarvest / totalWorkerDays) : 0;
    const costPerWorkerDay = totalWorkerDays > 0 ? (totalExpenses / totalWorkerDays) : 0;
    
    let plotName = "සියලුම ඉඩම්";
    if (selectedPlot !== 'all') {
      const plot = plots.find(p => p.id === selectedPlot);
      if (plot) {
        plotName = plot.name;
      }
    }

    // 2. Build Prompt 
    const systemPrompt = "You are an expert tea estate consultant and financial analyst. Your user is a tea estate owner in Sri Lanka. Analyze the following monthly data and provide a concise, actionable report in Sinhala. Focus on profitability, cost control (especially labor efficiency), and potential areas for improvement. Use bullet points for key recommendations. Be encouraging but professional.";
    
    const userPrompt = `කරුණාකර ${getMonthName(currentMonthID)} මාසය සඳහා මගේ තේ වතු දත්ත ("${plotName}" සඳහා) විශ්ලේෂණය කරන්න:
    - මුළු දළු අස්වැන්න: ${totalHarvest.toFixed(1)} kg
    - මුළු කම්කරු දින: ${totalWorkerDays}
    - තහවුරු වූ ආදායම: ${formatLKR(confirmedIncome)}
    - මුළු වියදම: ${formatLKR(totalExpenses)}
    - ශුද්ධ ලාභය: ${formatLKR(cashFlow)}
    - දළු කිලෝවක නිෂ්පාදන වියදම (Cost per KG): ${formatLKR(costPerKg)}
    - එක් කම්කරුවෙකුගේ දෛනික අස්වැන්න (KG per Worker): ${kgPerWorkerDay.toFixed(2)} kg
    - එක් කම්කරුවෙකු සඳහා දෛනික පිරිවැය (Cost per Worker): ${formatLKR(costPerWorkerDay)}
    - මිල තීරණය නොකළ දළු: ${pendingHarvest.toFixed(1)} kg
    
    කරුණාකර ඔබගේ විශ්ලේෂණය සහ නිර්දේශ සිංහලෙන් සපයන්න.`;

    // 3. Call API
    const result = await callGeminiApi(userPrompt, false, systemPrompt);

    // 4. Set result
    if (result.error) {
      setGeminiResult(result.error);
    } else {
      setGeminiResult(result.text);
    }
    setIsGeminiLoading(false);
  };


  return (
    <div className="space-y-6">
    
      {/* Due Reminders Alert */}
      {dueReminders.length > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <BellRing className="text-blue-600 w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-800 text-sm">සිදුවිය යුතු මතක් කිරීම්</h3>
              {dueReminders.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-4 mt-2">
                  <p className="text-blue-700 text-xs">
                    <strong>{formatDate(r.date)}</strong> දිනට නියමිත <strong>පොහොර යෙදීම</strong>.
                  </p>
                  <button 
                    onClick={() => onUpdateReminder(r.id, 'completed')}
                    className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    සම්පූර්ණයි
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View Header and Plot Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-700 border-b-2 border-green-500 pb-1 inline-block">
            {getMonthName(currentMonthID)} - සාරාංශය
            </h2>
             {/* Month Selector directly in Dashboard */}
            <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 text-sm bg-white"
            />
        </div>
        
        {/* Plot Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="plotFilter" className="text-sm font-medium text-gray-700">ඉඩම:</label>
          <select 
            id="plotFilter"
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
            className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 text-sm bg-white"
          >
            <option value="all">සියලුම ඉඩම්</option>
            {plots.map(plot => (
              <option key={plot.id} value={plot.id}>{plot.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Stats Cards */}
      <MonthStats records={currentMonthRecords} />
      
      {/* Gemini AI Analysis Button */}
      <button 
        onClick={handleAnalyzePerformance} 
        disabled={isGeminiLoading}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-500/20 transform transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait">
        <Sparkles className="w-5 h-5" />
        {isGeminiLoading ? "විශ්ලේෂණය කරමින්..." : `✨ ${getMonthName(currentMonthID)} කාර්ය සාධන විශ්ලේෂණය`}
      </button>


      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">දෛනික අස්වනු සැසඳීම (kg) - {getMonthName(currentMonthID)}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativeChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="දිනය" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{fontSize: "12px"}}/>
                <Bar dataKey="තෝරාගත් මාසය (kg)" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="පසුගිය මාසය (kg)" fill="#a7f3d0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">දෛනික ලාභ සැසඳීම (රු.) - {getMonthName(currentMonthID)}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparativeChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="දිනය" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatLKR(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{fontSize: "12px"}}/>
                <Line type="monotone" dataKey="තෝරාගත් මාසයේ ලාභය" stroke="#0088FE" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="පසුගිය මාසයේ ලාභය" stroke="#93c5fd" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NEW: Pie Chart for Expense Distribution */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">වියදම් බෙදීයාම - {getMonthName(currentMonthID)}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatLKR(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{fontSize: "12px"}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Gemini Result Modal */}
      {isModalOpen && (
        <GeminiResultModal 
          isLoading={isGeminiLoading} 
          result={geminiResult} 
          title={`Gemini මාසික විශ්ලේෂණය (${getMonthName(currentMonthID)})`}
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
};

// --- NEW: Gemini Advice View ---
const GeminiAdviceView = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [conversation, setConversation] = useState([]); // To store chat history

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userQuery = query.trim();
    setIsLoading(true);
    setResult(null); 
    setQuery('');
    
    setConversation(prev => [...prev, { role: 'user', text: userQuery }]);

    // System prompt
    const systemPrompt = "You are a helpful agricultural assistant specializing in Sri Lankan tea cultivation. Answer the user's questions clearly and concisely in Sinhala. Use Google Search to find the most up-to-date and relevant information.";

    // Call API with grounding
    const apiResult = await callGeminiApi(userQuery, true, systemPrompt);
    
    let aiResponse;
    if (apiResult.error) {
      aiResponse = apiResult.error;
    } else {
      aiResponse = apiResult.text;
    }
    
    setConversation(prev => [...prev, { role: 'ai', text: aiResponse }]);
    setIsLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Sparkles className="text-purple-600" /> Gemini කෘෂි උපදේශක
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          තේ වගාව, පොහොර, රෝග පාලනය හෝ වෙළඳපල මිල ගණන් වැනි ඕනෑම දෙයක් පිළිබඳව මෙතැනින් විමසන්න. Gemini අන්තර්ජාලය හරහා තොරතුරු සොයා ඔබට පිළිතුරු දෙනු ඇත.
        </p>

        {/* Conversation Area */}
        <div className="h-80 bg-gray-50 rounded-lg border p-4 space-y-4 overflow-y-auto mb-4">
          {conversation.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <BrainCircuit className="w-12 h-12 opacity-50 mb-2" />
              <p className="text-sm">ප්‍රශ්නයක් අසන්න...</p>
            </div>
          )}
          {conversation.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-lg' : 'bg-gray-200 text-gray-800 rounded-bl-lg'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
               <div className="p-3 rounded-2xl max-w-[80%] bg-gray-200 text-gray-800 rounded-bl-lg">
                  <div className="flex items-center gap-2 text-sm">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     <p>සොයමින් පවතී...</p>
                  </div>
               </div>
             </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAsk} className="flex gap-2">
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="ඔබේ ප්‍රශ්නය මෙහි ටයිප් කරන්න..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
          />
          <button 
            type="submit" 
            disabled={isLoading}
            className="bg-purple-600 text-white px-5 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "අසන්න"}
          </button>
        </form>
      </div>
    </div>
  );
};


const HistoricalReportsView = ({ records, onDelete, onUpdate, factories, plots }) => {
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'annual'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedPlot, setSelectedPlot] = useState('all'); 
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewImage, setViewImage] = useState(null); // For image modal

  // Filter records for selected month AND plot
  const monthlyRecords = useMemo(() => {
      return records
        .filter(r => r.monthId === selectedMonth && (selectedPlot === 'all' || r.plotId === selectedPlot))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [records, selectedMonth, selectedPlot]);

  // Calculate stats for 12-month summary
  const annualSummaryData = useMemo(() => {
    const last12Months = [];
    let date = new Date();
    for (let i = 0; i < 12; i++) {
        last12Months.push(date.toISOString().slice(0, 7)); // "YYYY-MM"
        date.setMonth(date.getMonth() - 1);
    }
    last12Months.reverse(); // Chronological order

    const summary = last12Months.map(monthId => {
      let monthProfit = 0;
      let monthHarvest = 0;
      records.forEach(r => {
        if (r.monthId === monthId) {
          monthProfit += r.profit;
          monthHarvest += r.harvest;
        }
      });
      return {
        month: getMonthName(monthId, 'short'),
        "ලාභය": monthProfit,
        "අස්වැන්න": monthHarvest
      };
    });
    return summary;
  }, [records]);
  
  // --- CSV Export Function ---
  const handleExportCSV = () => {
    if (monthlyRecords.length === 0) {
      alert("බාගත කිරීමට දත්ත නොමැත.");
      return;
    }

    // CSV Headers
    const headers = ["Date", "Plot Name", "Factory Name", "Harvest (kg)", "Workers", "Expenses (LKR)", "Income (LKR)", "Profit (LKR)", "Status"];
    
    // Map data to CSV rows
    const rows = monthlyRecords.map(rec => [
      rec.date,
      `"${rec.plotName || ''}"`, // Quote strings to handle commas
      `"${rec.factoryName || ''}"`,
      rec.harvest.toFixed(2),
      rec.workerCount,
      rec.expenses.toFixed(2),
      rec.income.toFixed(2),
      rec.profit.toFixed(2),
      rec.hasPrice ? "Confirmed" : "Pending Price"
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Tea_Records_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditingRecord(null);
    setIsEditModalOpen(false);
  };
  
  const handleSaveEdit = (updatedData) => {
    onUpdate(updatedData); 
    handleCloseEditModal();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-green-600"/> සවිස්තර වාර්තා
          </h2>
          <p className="text-sm text-gray-500">පසුගිය දත්ත සහ ප්‍රස්ථාර විශ්ලේෂණය කරන්න.</p>
        </div>
        
        <div className="flex gap-2">
          {/* Export Button */}
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-bold flex items-center gap-2 border border-blue-200 transition-colors"
          >
            <Download className="w-4 h-4" /> 
            <span className="hidden sm:inline">Excel/CSV ලෙස බාගන්න</span>
            <span className="sm:hidden">Excel</span>
          </button>

          {/* Toggle Switch */}
          <div className="bg-gray-200 p-1 rounded-xl flex shadow-inner">
            <button 
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'monthly' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              මාසිකව
            </button>
            <button 
              onClick={() => setViewMode('annual')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'annual' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              වාර්ෂිකව
            </button>
          </div>
        </div>
      </div>

      {/* --- MONTHLY VIEW --- */}
      {viewMode === 'monthly' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">මාසය:</label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700"
              />
            </div>
            {/* Plot Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">ඉඩම:</label>
              <select 
                value={selectedPlot}
                onChange={(e) => setSelectedPlot(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-700 bg-white"
              >
                <option value="all">සියලුම ඉඩම්</option>
                {plots.map(plot => (
                  <option key={plot.id} value={plot.id}>{plot.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {monthlyRecords.length === 0 ? (
            <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed">
                <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                {getMonthName(selectedMonth)} සඳහා දත්ත නොමැත.
            </div>
          ) : (
            <>
              {/* Monthly Stats */}
              <MonthStats records={monthlyRecords} />
              
              {/* Detailed Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                <div className="p-4 border-b border-gray-100 font-bold text-gray-700 flex justify-between items-center">
                  <span>{getMonthName(selectedMonth)} - සවිස්තරාත්මක දත්ත</span>
                  <span className="text-xs text-gray-400 font-normal">වගු දත්ත බාගත කිරීමට ඉහළ බොත්තම භාවිතා කරන්න.</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase font-bold text-xs">
                      <tr>
                        <th className="p-4">දිනය / ඉඩම</th>
                        <th className="p-4">කර්මාන්ත ශාලාව</th>
                        <th className="p-4 text-right">අස්වැන්න (kg)</th>
                        <th className="p-4 text-right">කම්. ගණන</th>
                        <th className="p-4 text-right">වියදම</th>
                        <th className="p-4 text-right">ආදායම</th>
                        <th className="p-4 text-center">පින්තූර</th>
                        <th className="p-4 text-center">ක්‍රියා</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-50">
                          <td className="p-4">
                            <div className="font-bold text-gray-800">{formatDate(rec.date)}</div>
                            <div className="text-xs text-blue-700 mt-1">
                              <MapPin className="w-3 h-3 inline mr-1"/>
                              {rec.plotName || <span className="text-gray-400">?</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-xs text-green-700 mt-1">
                              {rec.factoryName ? 
                                <><Building2 className="w-3 h-3 inline mr-1"/>{rec.factoryName}</> : 
                                <span className="text-gray-400">-</span>
                              }
                            </div>
                          </td>
                          <td className="p-4 text-right text-green-700 font-bold">{rec.harvest.toFixed(1)}</td>
                          <td className="p-4 text-right text-gray-700">{rec.workerCount || 0}</td>
                          <td className="p-4 text-right text-red-600">{formatLKR(rec.expenses)}</td>
                          <td className="p-4 text-right">
                            {rec.hasPrice ? (
                              <div>
                                <span className="font-bold text-gray-800">{formatLKR(rec.income)}</span>
                                <span className="text-[10px] text-gray-400 block">@{rec.price}/kg</span>
                              </div>
                            ) : (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {rec.image ? (
                              <button onClick={() => setViewImage(rec.image)} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-2 rounded-full">
                                <Eye className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleOpenEditModal(rec)} className="text-gray-400 hover:text-blue-500"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => onDelete(rec.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- ANNUAL VIEW --- */}
      {viewMode === 'annual' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">පසුගිය මාස 12 ලාභය (රු.)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualSummaryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(value) => formatLKR(value)} />
                  <Bar dataKey="ලාභය" fill="#0088FE" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">පසුගිය මාස 12 අස්වැන්න (kg)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualSummaryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} width={30} />
                  <Tooltip formatter={(value) => `${value.toFixed(1)} kg`} />
                  <Bar dataKey="අස්වැන්න" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Modal */}
      {isEditModalOpen && (
        <EditRecordModal 
          record={editingRecord}
          factories={factories}
          plots={plots}
          onSave={handleSaveEdit}
          onClose={handleCloseEditModal}
        />
      )}

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setViewImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh]">
             <img src={viewImage} alt="Receipt/Record" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
             <button className="absolute top-2 right-2 bg-white/20 text-white p-2 rounded-full hover:bg-white/40" onClick={() => setViewImage(null)}>
               <X className="w-6 h-6" />
             </button>
          </div>
        </div>
      )}
    </div>
  );
};


const SettingsManager = ({ 
  factories, onAddFactory, onDeleteFactory, 
  plots, onAddPlot, onDeletePlot, 
  savedAdminPin, savedAppPin, onChangeAdminPin, onChangeAppPin,
  reminders, onAddReminder, onUpdateReminder, onDeleteReminder
}) => {
  const [newFactory, setNewFactory] = useState('');
  const [newPlot, setNewPlot] = useState(''); 
  // Admin PIN
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [confirmAdminPin, setConfirmAdminPin] = useState('');
  // App PIN
  const [authAdminPin, setAuthAdminPin] = useState('');
  const [newAppPin, setNewAppPin] = useState('');
  const [confirmAppPin, setConfirmAppPin] = useState('');

  const [reminderDate, setReminderDate] = useState('');

  const handleAddFactorySubmit = (e) => {
    e.preventDefault();
    onAddFactory(newFactory);
    setNewFactory('');
  };
  
  const handleAddPlotSubmit = (e) => {
    e.preventDefault();
    onAddPlot(newPlot);
    setNewPlot('');
  };
  
  const handleChangeAdminPinSubmit = async (e) => {
    e.preventDefault();
    if (newAdminPin.length < 4) {
      alert("නව Admin මුරපදය අවම වශයෙන් ඉලක්කම් 4ක් විය යුතුය.");
      return;
    }
    if (newAdminPin !== confirmAdminPin) {
      alert("නව Admin මුරපද දෙක නොගැලපේ!");
      return;
    }
    
    const success = await onChangeAdminPin(currentAdminPin, newAdminPin);
    if (success) {
      alert("Admin මුරපදය සාර්ථකව වෙනස් කරන ලදී!");
      setCurrentAdminPin('');
      setNewAdminPin('');
      setConfirmAdminPin('');
    }
  };
  
  const handleChangeAppPinSubmit = async (e) => {
    e.preventDefault();
    if (!newAppPin) {
       alert("කරුණාකර නව සේවක මුරපදයක් ඇතුළත් කරන්න.");
       return;
    }
    if (newAppPin.length < 4) {
      alert("නව සේවක මුරපදය අවම වශයෙන් ඉලක්කම් 4ක් විය යුතුය.");
      return;
    }
    if (newAppPin !== confirmAppPin) {
      alert("නව සේවක මුරපද දෙක නොගැලපේ!");
      return;
    }
    
    const success = await onChangeAppPin(authAdminPin, newAppPin);
    if (success) {
      alert(savedAppPin ? "සේවක මුරපදය සාර්ථකව වෙනස් කරන ලදී!" : "සේවක මුරපදය සාර්ථකව සකසන ලදී!");
      setAuthAdminPin('');
      setNewAppPin('');
      setConfirmAppPin('');
    }
  };
  
  const handleAddReminderSubmit = (e) => {
    e.preventDefault();
    if (!reminderDate) {
      alert("කරුණාකර දිනයක් තෝරන්න.");
      return;
    }
    onAddReminder(reminderDate);
    setReminderDate('');
  };
  
  const pendingReminders = useMemo(() => reminders.filter(r => r.status === 'pending'), [reminders]);
  const completedReminders = useMemo(() => reminders.filter(r => r.status === 'completed'), [reminders]);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Settings className="text-gray-600" /> Admin සැකසුම්
        </h2>
        
        {/* Plot Management */}
        <div className="mb-8 p-4 border rounded-lg bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600"/> ඉඩම් ලැයිස්තුව</h3>
          <form onSubmit={handleAddPlotSubmit} className="flex gap-2 mb-4">
            <input type="text" value={newPlot} onChange={(e) => setNewPlot(e.target.value)}
              placeholder="ඉඩමේ නම (උදා: කන්ද උඩ)"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700">එකතු කරන්න</button>
          </form>
          <div className="space-y-2">
            {plots.map(plot => (
              <div key={plot.id} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                <span className="font-medium text-gray-800">{plot.name}</span>
                <button onClick={() => onDeletePlot(plot.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {plots.length === 0 && <p className="text-xs text-gray-500 p-2">ඉඩම් ඇතුළත් කර නොමැත.</p>}
          </div>
        </div>
        
        {/* Factory Management */}
        <div className="mb-8 p-4 border rounded-lg bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Factory className="w-4 h-4 text-green-600"/> කර්මාන්ත ශාලා ලැයිස්තුව</h3>
          <form onSubmit={handleAddFactorySubmit} className="flex gap-2 mb-4">
            <input type="text" value={newFactory} onChange={(e) => setNewFactory(e.target.value)}
              placeholder="කර්මාන්ත ශාලාවේ නම"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
            <button type="submit" className="bg-green-700 text-white px-6 rounded-lg font-bold hover:bg-green-800">එකතු කරන්න</button>
          </form>
          <div className="space-y-2">
            {factories.map(factory => (
              <div key={factory.id} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                <span className="font-medium text-gray-800">{factory.name}</span>
                <button onClick={() => onDeleteFactory(factory.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
             {factories.length === 0 && <p className="text-xs text-gray-500 p-2">කර්මාන්ත ශාලා ඇතුළත් කර නොමැත.</p>}
          </div>
        </div>

        {/* Reminder Management */}
        <div className="mb-8 p-4 border rounded-lg bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Bell className="w-4 h-4"/> පොහොර මතක් කිරීම්</h3>
          <form onSubmit={handleAddReminderSubmit} className="flex gap-2 mb-4">
            <input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <button type="submit" className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700">එක් කරන්න</button>
          </form>
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase">ඉදිරි මතක් කිරීම්</h4>
            {pendingReminders.length > 0 ? pendingReminders.map(r => (
              <div key={r.id} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                <span className="font-medium text-blue-800">{formatDate(r.date)}</span>
                <div className="flex gap-2">
                  <button onClick={() => onUpdateReminder(r.id, 'completed')} className="text-green-500 hover:text-green-700"><Check className="w-4 h-4" /></button>
                  <button onClick={() => onDeleteReminder(r.id)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )) : <p className="text-xs text-gray-400 p-2">මතක් කිරීම් නොමැත.</p>}
            
            <h4 className="text-xs font-bold text-gray-500 uppercase pt-2">සම්පූර්ණ කරන ලද</h4>
             {completedReminders.length > 0 ? completedReminders.map(r => (
              <div key={r.id} className="flex justify-between items-center p-3 bg-white rounded-lg border opacity-60">
                <span className="font-medium text-gray-500 line-through">{formatDate(r.date)}</span>
                <button onClick={() => onDeleteReminder(r.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            )) : <p className="text-xs text-gray-400 p-2">මතක් කිරීම් නොමැත.</p>}
          </div>
        </div>
        
        {/* PIN Management */}
        <div className="space-y-6">
          {/* Change Admin PIN */}
          <div className="p-4 border rounded-lg bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-red-600"/> Admin මුරපදය වෙනස් කිරීම</h3>
            <form onSubmit={handleChangeAdminPinSubmit} className="space-y-4">
              <input type="password" value={currentAdminPin} onChange={(e) => setCurrentAdminPin(e.target.value)} placeholder="වත්මන් Admin PIN අංකය"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 outline-none" />
              <input type="password" value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="නව Admin PIN අංකය"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
              <input type="password" value={confirmAdminPin} onChange={(e) => setConfirmAdminPin(e.target.value)} placeholder="නව Admin PIN අංකය තහවුරු කරන්න"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" />
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <RefreshCcw className="w-4 h-4" /> Admin මුරපදය යාවත්කාලීන කරන්න
              </button>
            </form>
          </div>
          
          {/* Change App PIN */}
          <div className="p-4 border rounded-lg bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4 text-blue-600"/> සේවක මුරපදය (App PIN) {savedAppPin ? "වෙනස් කිරීම" : "සැකසීම"}</h3>
            <form onSubmit={handleChangeAppPinSubmit} className="space-y-4">
              <input type="password" value={authAdminPin} onChange={(e) => setAuthAdminPin(e.target.value)} placeholder="තහවුරු කිරීමට Admin PIN අංකය ඇතුළත් කරන්න"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 outline-none" />
              <input type="password" value={newAppPin} onChange={(e) => setNewAppPin(e.target.value)} placeholder="නව සේවක PIN අංකය"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="password" value={confirmAppPin} onChange={(e) => setConfirmAppPin(e.target.value)} placeholder="නව සේවක PIN අංකය තහවුරු කරන්න"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <RefreshCcw className="w-4 h-4" /> {savedAppPin ? "සේවක මුරපදය යාවත්කාලීන කරන්න" : "සේවක මුරපදය සකසන්න"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

const EntryForm = ({ onSubmit, factories, plots }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    plotId: '', 
    factoryId: '',
    harvestAmount: '',
    workerCount: '', 
    laborCost: '',
    transportCost: '',
    otherCost: '',
    notes: '',
    image: null 
  });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (plots.length > 0 && !formData.plotId) {
      setFormData(prev => ({ ...prev, plotId: plots[0].id }));
    }
    if (factories.length > 0 && !formData.factoryId) {
      setFormData(prev => ({ ...prev, factoryId: factories[0].id }));
    }
  }, [plots, factories]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  // Handle Image Compression and State Update
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        // Compress image before setting state to avoid large memory usage and upload limits
        const compressedBase64 = await compressImage(file);
        setFormData(prev => ({ ...prev, image: compressedBase64 }));
      } catch (error) {
        console.error("Image compression failed:", error);
        alert("රූපය සැකසීමේදී දෝෂයක් ඇතිවිය.");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // --- Validation ---
    if (plots.length === 0) {
      alert("කරුණාකර පළමුව 'සැකසුම්' (Settings) වෙත ගොස් ඉඩමක් (Plot) එකතු කරන්න.");
      return;
    }
    if (!formData.plotId) {
      alert("කරුණාකර මෙම වාර්තාවට අදාළ ඉඩම තෝරන්න.");
      return;
    }
    
    const harvestAmount = Number(formData.harvestAmount) || 0;
    
    if (harvestAmount > 0 && factories.length === 0) {
      alert("කරුණාකර පළමුව 'සැකසුම්' (Settings) වෙත ගොස් කර්මාන්ත ශාලාවක් එකතු කරන්න.");
      return;
    }
    if (harvestAmount > 0 && !formData.factoryId) {
      alert("දළු ප්‍රමාණයක් ඇතුළත් කළ බැවින්, කරුණාකර කර්මාන්ත ශාලාවක් තෝරන්න.");
      return;
    }
    
    if (!formData.harvestAmount && !formData.workerCount && !formData.laborCost && !formData.transportCost && !formData.otherCost && !formData.image) {
      alert("කරුණාකර අවම වශයෙන් එක් දත්තයක් (දළු/වියදම්/පින්තූර) ඇතුළත් කරන්න.");
      return;
    }
    // --- End Validation ---

    const selectedPlot = plots.find(p => p.id === formData.plotId);
    const selectedFactory = harvestAmount > 0 ? factories.find(f => f.id === formData.factoryId) : null;

    const submitData = {
        date: formData.date,
        plotId: formData.plotId, 
        plotName: selectedPlot.name, 
        factoryId: harvestAmount > 0 ? formData.factoryId : null,
        factoryName: selectedFactory ? selectedFactory.name : null,
        harvestAmount: harvestAmount,
        workerCount: Number(formData.workerCount) || 0,
        laborCost: Number(formData.laborCost) || 0,
        transportCost: Number(formData.transportCost) || 0,
        otherCost: Number(formData.otherCost) || 0,
        notes: formData.notes,
        image: formData.image // Send base64 string
    }
    onSubmit(submitData);
    // Reset form, but keep date and plot
    setFormData(prev => ({
      ...prev,
      factoryId: factories.length > 0 ? factories[0].id : '',
      harvestAmount: '',
      workerCount: '', 
      laborCost: '',
      transportCost: '',
      otherCost: '',
      notes: '',
      image: null
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const showFactorySelector = Number(formData.harvestAmount) > 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <PlusCircle className="text-green-600" /> දෛනික තොරතුරු ඇතුළත් කිරීම
        </h2>
      </div>
      
      {plots.length === 0 ? (
         <div className="text-center py-10 bg-red-50 rounded-xl border border-red-100">
           <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
           <p className="text-red-700 font-bold">ඉඩම් ලැයිස්තුව හිස්ය!</p>
           <p className="text-sm text-red-600 mt-1">දත්ත ඇතුළත් කිරීමට පෙර කරුණාකර Admin පිවිසුම හරහා "සැකසුම්" වෙත ගොස් ඉඩමක් එක් කරන්න.</p>
         </div>
      ) : (factories.length === 0 && showFactorySelector) ? (
         <div className="text-center py-10 bg-red-50 rounded-xl border border-red-100">
           <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
           <p className="text-red-700 font-bold">කර්මාන්ත ශාලා ලැයිස්තුව හිස්ය!</p>
           <p className="text-sm text-red-600 mt-1">දළු ප්‍රමාණයක් ඇතුළත් කිරීමට පෙර "සැකසුම්" වෙත ගොස් කර්මාන්ත ශාලාවක් එක් කරන්න.</p>
         </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">දිනය (Date)</label>
              <input type="date" required name="date" value={formData.date} onChange={handleChange} 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all" />
            </div>
            
            <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-700">ඉඩම (Plot)</label>
               <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"/>
                  <select required name="plotId" value={formData.plotId} onChange={handleChange}
                    className="pl-10 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all appearance-none">
                    {plots.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
               </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
               <label className="text-sm font-semibold text-green-700">නෙලූ දළු ප්‍රමාණය (KG)</label>
               <div className="relative">
                  <Sprout className="absolute left-3 top-3 h-5 w-5 text-green-500 pointer-events-none"/>
                  <input type="number" step="0.1" placeholder="0.0" name="harvestAmount" value={formData.harvestAmount} onChange={handleChange}
                    className="pl-10 w-full p-3 bg-green-50 border border-green-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-green-800 text-lg" />
               </div>
            </div>
            
            <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-700">කම්කරු ගණන</label>
               <div className="relative">
                  <Users className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"/>
                  <input type="number" placeholder="0" name="workerCount" value={formData.workerCount} onChange={handleChange}
                    className="pl-10 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all" />
               </div>
            </div>
          </div>
          
          {/* --- CONDITIONAL FACTORY SELECTOR --- */}
          {showFactorySelector && (
            <div className="space-y-2 animate-in fade-in">
                 <label className="text-sm font-semibold text-gray-700">කර්මාන්ත ශාලාව</label>
                 <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"/>
                    <select required name="factoryId" value={formData.factoryId} onChange={handleChange}
                      className="pl-10 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all appearance-none">
                      {factories.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                 </div>
              </div>
          )}

          <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
              <label className="text-sm font-bold text-red-800 mb-3 block flex items-center gap-2">
                  <Wallet className="w-4 h-4"/> දෛනික වියදම් (Expenses)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">කම්කරු පඩි</label>
                      <input type="number" placeholder="0" name="laborCost" value={formData.laborCost} onChange={handleChange}
                      className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-red-400 outline-none" />
                  </div>
                  <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">ආහාර/ප්‍රවාහන</label>
                      <input type="number" placeholder="0" name="transportCost" value={formData.transportCost} onChange={handleChange}
                      className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-red-400 outline-none" />
                  </div>
                  <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">වෙනත්</label>
                      <input type="number" placeholder="0" name="otherCost" value={formData.otherCost} onChange={handleChange}
                      className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-red-400 outline-none" />
                  </div>
              </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-semibold text-gray-700">විශේෂ සටහන්</label>
             <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="සටහනක් එක් කරන්න..."
               className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-400 outline-none h-20 text-sm"></textarea>
          </div>
          
          {/* --- IMAGE UPLOAD --- */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">රිසිට් පතේ හෝ දවසේ ඡායාරූපයක් (Photo)</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden" 
                id="imageUpload"
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current.click()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Camera className="w-4 h-4" /> ඡායාරූපයක් ගන්න / තෝරන්න
              </button>
              
              {formData.image && (
                <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                   <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                   <button 
                    type="button" 
                    onClick={() => {
                      setFormData(prev => ({ ...prev, image: null }));
                      fileInputRef.current.value = '';
                    }}
                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-md"
                   >
                     <X className="w-3 h-3" />
                   </button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400">රූපය ස්වයංක්‍රීයව ප්‍රමාණයෙන් කුඩා කර සුරැකේ.</p>
          </div>

          <button type="submit" className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-700/20 transform transition active:scale-95 flex items-center justify-center gap-2">
            <PlusCircle className="w-5 h-5" /> දත්ත සුරකින්න
          </button>
        </form>
      )}
    </div>
  );
};

// --- Edit Record Modal ---
const EditRecordModal = ({ record, factories, plots, onSave, onClose }) => {
  // Initialize form data from the record being edited
  const [formData, setFormData] = useState({
    ...record,
    harvestAmount: record.harvestAmount || '',
    workerCount: record.workerCount || '',
    laborCost: record.laborCost || '',
    transportCost: record.transportCost || '',
    otherCost: record.otherCost || '',
    notes: record.notes || '',
    factoryId: record.factoryId || '',
    plotId: record.plotId || '',
    image: record.image || null
  });
  
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setFormData(prev => ({ ...prev, image: compressedBase64 }));
      } catch (error) {
        console.error("Image compression failed:", error);
        alert("රූපය සැකසීමේදී දෝෂයක් ඇතිවිය.");
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // --- Validation ---
    if (!formData.plotId) {
      alert("කරුණාකර ඉඩම තෝරන්න.");
      return;
    }
    
    const harvestAmount = Number(formData.harvestAmount) || 0;
    
    if (harvestAmount > 0 && !formData.factoryId) {
      alert("දළු ප්‍රමාණයක් ඇතුළත් කළ බැවින්, කර්මාන්ත ශාලාවක් තෝරන්න.");
      return;
    }
    
    // Convert back to numbers before saving
    const dataToSave = {
      ...formData,
      harvestAmount: Number(formData.harvestAmount) || 0,
      workerCount: Number(formData.workerCount) || 0,
      laborCost: Number(formData.laborCost) || 0,
      transportCost: Number(formData.transportCost) || 0,
      otherCost: Number(formData.otherCost) || 0,
      factoryId: harvestAmount > 0 ? formData.factoryId : null,
      image: formData.image
    };
    
    onSave(dataToSave);
  };
  
  const showFactorySelector = Number(formData.harvestAmount) > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Pencil className="text-blue-600" /> වාර්තාව සංස්කරණය කිරීම
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form Content */}
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">දිනය (Date)</label>
                <input type="date" required name="date" value={formData.date} onChange={handleChange} 
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all" />
              </div>
              
              <div className="space-y-2">
                 <label className="text-sm font-semibold text-gray-700">ඉඩම (Plot)</label>
                 <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"/>
                    <select required name="plotId" value={formData.plotId} onChange={handleChange}
                      className="pl-10 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all appearance-none">
                      {plots.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                 </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-sm font-semibold text-green-700">නෙලූ දළු ප්‍රමාණය (KG)</label>
                 <div className="relative">
                    <Sprout className="absolute left-3 top-3 h-5 w-5 text-green-500 pointer-events-none"/>
                    <input type="number" step="0.1" placeholder="0.0" name="harvestAmount" value={formData.harvestAmount} onChange={handleChange}
                      className="pl-10 w-full p-3 bg-green-50 border border-green-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-green-800 text-lg" />
                 </div>
              </div>
              
              <div className="space-y-2">
                 <label className="text-sm font-semibold text-gray-700">කම්කරු ගණන</label>
                 <div className="relative">
                    <Users className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"/>
                    <input type="number" placeholder="0" name="workerCount" value={formData.workerCount} onChange={handleChange}
                      className="pl-10 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all" />
                 </div>
              </div>
            </div>
            
            {showFactorySelector && (
              <div className="space-y-2 animate-in fade-in">
                   <label className="text-sm font-semibold text-gray-700">කර්මාන්ත ශාලාව</label>
                   <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400 pointer-events-none"/>
                      <select required name="factoryId" value={formData.factoryId} onChange={handleChange}
                        className="pl-10 w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all appearance-none">
                        {factories.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                   </div>
                </div>
            )}

            <div className="bg-red-50/50 p-4 rounded-xl border border-red-100">
                <label className="text-sm font-bold text-red-800 mb-3 block">වියදම් (Expenses)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">කම්කරු පඩි</label>
                        <input type="number" placeholder="0" name="laborCost" value={formData.laborCost} onChange={handleChange}
                        className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-red-400 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">ආහාර/ප්‍රවාහන</label>
                        <input type="number" placeholder="0" name="transportCost" value={formData.transportCost} onChange={handleChange}
                        className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-red-400 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">වෙනත්</label>
                        <input type="number" placeholder="0" name="otherCost" value={formData.otherCost} onChange={handleChange}
                        className="w-full p-2 border border-gray-200 rounded focus:ring-2 focus:ring-red-400 outline-none" />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-700">විශේෂ සටහන්</label>
               <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="සටහනක් එක් කරන්න..."
                 className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-400 outline-none h-20 text-sm"></textarea>
            </div>
            
            {/* Edit Image Section */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">ඡායාරූපය</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    className="hidden" 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Camera className="w-4 h-4" /> වෙනස් කරන්න
                  </button>
                  
                  {formData.image && (
                    <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                       <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                       <button 
                        type="button" 
                        onClick={() => {
                          setFormData(prev => ({ ...prev, image: null }));
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-md"
                       >
                         <X className="w-3 h-3" />
                       </button>
                    </div>
                  )}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-xl">
                අවලංගු කරන්න
              </button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2">
                <Save className="w-4 h-4" /> වෙනස්කම් සුරකින්න
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


const PriceManager = ({ prices, factories, onSave }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [inputPrices, setInputPrices] = useState({});

  useEffect(() => {
    if (prices[selectedMonth]) {
      setInputPrices(prices[selectedMonth]);
    } else {
      setInputPrices({});
    }
  }, [selectedMonth, prices]);

  const handlePriceChange = (factoryId, value) => {
    setInputPrices(prev => ({ ...prev, [factoryId]: value }));
  };

  const handleSave = () => {
    onSave(selectedMonth, inputPrices);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Coins className="text-yellow-600" /> මාසික මිල ගණන්
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">මාසය තෝරන්න</label>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
            />
          </div>

          {factories.length === 0 ? (
             <p className="text-sm text-red-500 italic">මිල ගණන් ඇතුළත් කිරීමට පෙර සැකසුම් පිටුවේ කර්මාන්ත ශාලා එකතු කරන්න.</p>
          ) : (
            <div className="space-y-3 mt-4">
               <h3 className="text-sm font-bold text-gray-700">එක් එක් කර්මාන්ත ශාලාව සඳහා 1kg මිල (රු.)</h3>
               {factories.map(factory => (
                 <div key={factory.id} className="flex items-center gap-3">
                    <div className="flex-1 text-sm font-medium text-gray-600">{factory.name}</div>
                    <div className="relative w-40">
                       <span className="absolute left-3 top-2.5 text-gray-400 text-xs">Rs.</span>
                       <input 
                        type="number" 
                        step="0.01"
                        value={inputPrices[factory.id] || ''} 
                        onChange={(e) => handlePriceChange(factory.id, e.target.value)}
                        placeholder="0.00"
                        className="w-full p-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-right"
                      />
                    </div>
                 </div>
               ))}
            </div>
          )}

          <button onClick={handleSave} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg shadow-md mt-4">
            මිල යාවත්කාලීන කරන්න
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Gemini Result Modal ---
const GeminiResultModal = ({ isLoading, result, title, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="text-purple-600" /> {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
              <p className="font-medium">විශ්ලේෂණය කරමින් පවතී...</p>
              <p className="text-sm">Gemini ඔබගේ දත්ත සකසමින් සිටී. කරුණාකර රැඳී සිටින්න.</p>
            </div>
          ) : (
            <div className="prose prose-sm prose-p:text-gray-700 prose-ul:text-gray-700 whitespace-pre-wrap">
              {result && result.split('\n').map((line, i) => {
                if (line.startsWith('* ') || line.startsWith('- ')) {
                  return <p key={i} className="flex items-start"><span className="mr-2 mt-1.5 text-green-500">✔</span><span>{line.substring(2)}</span></p>
                }
                if (line.startsWith('##')) {
                   return <h3 key={i} className="font-bold text-gray-800 text-md mt-4 mb-2">{line.substring(2).trim()}</h3>
                }
                return <p key={i}>{line}</p>;
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t rounded-b-2xl">
          <p className="text-xs text-gray-400 italic text-center">
            මෙම උපදෙස් Gemini (AI) මගින් ජනනය කරන ලදී.
          </p>
        </div>
      </div>
    </div>
  );
};


const NavButton = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 w-full ${active ? 'text-green-700' : 'text-gray-400'}`}>
    <Icon className={`h-5 w-5 ${active ? 'fill-green-100 stroke-green-700' : ''}`} />
    <span className={`text-[9px] font-medium ${active ? 'font-bold' : ''}`}>{label}</span>
  </button>
);

const DesktopTab = ({ active, onClick, label, icon: Icon }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 ${active ? 'border-green-700 text-green-800 bg-green-50' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full">
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2.5 rounded-lg text-white ${color} shadow-sm`}><Icon className="w-5 h-5" /></div>
    </div>
    <div>
      <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{title}</h3>
      <p className="text-xl font-bold text-gray-800 mt-1 truncate tracking-tight">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1 font-medium">{subtext}</p>}
    </div>
  </div>
);