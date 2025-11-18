import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, deleteDoc, setDoc, getDoc, doc, onSnapshot, query, orderBy, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  LayoutDashboard, PlusCircle, FileText, Sprout, TrendingUp, TrendingDown, Wallet, Trash2, Coins, AlertCircle, Lock, Settings, Building2, Factory, CalendarDays, Bell, Check, X, BellRing, UserCheck, ShieldCheck, LogOut, Sparkles, Loader2, MapPin, Pencil, Save, Camera
} from 'lucide-react';

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyBrtv7D89sDboUrEkBEbXazJQlmjGF7C4g",
  authDomain: "my-teaapp.firebaseapp.com",
  projectId: "my-teaapp",
  storageBucket: "my-teaapp.firebasestorage.app",
  messagingSenderId: "97042947360",
  appId: "1:97042947360:web:9b7a276e93f71dfa118b45"
};

const __app_id = "my_tea_app_main"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Helpers ---
const formatLKR = (v) => new Intl.NumberFormat('si-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(v);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('si-LK', { year: 'numeric', month: 'long', day: 'numeric' }) : "";
const getMonthName = (m) => m ? new Date(m.split('-')[0], parseInt(m.split('-')[1])-1).toLocaleDateString('si-LK', { year: 'numeric', month: 'long' }) : "";
const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.readAsDataURL(file);
  reader.onload = (e) => { const img = new Image(); img.src = e.target.result; img.onload = () => { const cvs = document.createElement('canvas'), ctx = cvs.getContext('2d'); let w = img.width, h = img.height, m = 800; if(w>h){if(w>m){h*=m/w;w=m}}else{if(h>m){w*=m/h;h=m}}; cvs.width=w; cvs.height=h; ctx.drawImage(img,0,0,w,h); resolve(cvs.toDataURL('image/jpeg',0.5)); }; };
});

// --- LOGIN SCREEN COMPONENT ---
const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.includes('invalid-credential') ? "ඊමේල් හෝ මුරපදය වැරදියි" : err.message.includes('email-already-in-use') ? "මෙම ඊමේල් ලිපිනය දැනටමත් භාවිතා කර ඇත" : "දෝෂයක් ඇතිවිය. නැවත උත්සාහ කරන්න.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><Sprout className="w-10 h-10 text-green-600"/></div>
          <h2 className="text-2xl font-bold text-gray-800">{isLogin ? "සාදරයෙන් පිළිගනිමු" : "නව ගිණුමක් සාදන්න"}</h2>
          <p className="text-sm text-gray-500">ඔබේ තේ වතු දත්ත ආරක්ෂිතව තබාගන්න</p>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center">{error}</div>}
        <form onSubmit={handleAuth} className="space-y-4">
          <div><label className="text-xs font-bold text-gray-600 uppercase">Email ලිපිනය</label><input type="email" required className="w-full p-3 border rounded-lg outline-none focus:border-green-500" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></div>
          <div><label className="text-xs font-bold text-gray-600 uppercase">මුරපදය (Password)</label><input type="password" required className="w-full p-3 border rounded-lg outline-none focus:border-green-500" value={password} onChange={e=>setPassword(e.target.value)} placeholder="******" minLength={6}/></div>
          <button disabled={loading} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">{loading ? "සකසමින්..." : (isLogin ? "ඇතුල් වන්න (Login)" : "ගිණුම සාදන්න (Register)")}</button>
        </form>
        <div className="mt-6 text-center"><button onClick={() => setIsLogin(!isLogin)} className="text-sm text-green-700 font-semibold hover:underline">{isLogin ? "ගිණුමක් නැද්ද? මෙතනින් සාදන්න" : "දැනටමත් ගිණුමක් තිබේද? Login වන්න"}</button></div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [prices, setPrices] = useState({});
  const [factories, setFactories] = useState([]);
  const [plots, setPlots] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState('loading');
  const [savedAdminPin, setSavedAdminPin] = useState(null);
  const [savedAppPin, setSavedAppPin] = useState(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const pinDoc = await getDoc(doc(db, `artifacts/${__app_id}/users/${currentUser.uid}/settings`, 'security'));
        if (pinDoc.exists() && pinDoc.data().adminPin) {
          setSavedAdminPin(pinDoc.data().adminPin); setSavedAppPin(pinDoc.data().appPin); setAuthStatus('login_app_pin');
        } else { setAuthStatus('setup_admin_pin'); }
        
        const unsub1 = onSnapshot(query(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/tea_records`), orderBy('date', 'desc')), s => setRecords(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsub2 = onSnapshot(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/monthly_prices`), s => { const p={}; s.docs.forEach(d=>p[d.id]=d.data()); setPrices(p); });
        const unsub3 = onSnapshot(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/factories`), s => setFactories(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsub4 = onSnapshot(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/plots`), s => setPlots(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsub5 = onSnapshot(query(collection(db, `artifacts/${__app_id}/users/${currentUser.uid}/reminders`), orderBy('date', 'asc')), s => setReminders(s.docs.map(d => ({id:d.id, ...d.data()}))));
        setLoading(false);
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
      } else { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => { if(confirm("ඔබට ඉවත් වීමට අවශ්‍යද?")) signOut(auth); };
  const processedRecords = useMemo(() => records.map(rec => { const mId = rec.date.substring(0,7); const price = (rec.factoryId && prices[mId]?.[rec.factoryId]) || 0; const exp = (rec.laborCost||0)+(rec.transportCost||0)+(rec.otherCost||0); return { ...rec, monthId: mId, price, hasPrice: price>0, income: (rec.harvestAmount||0)*price, expenses: exp, profit: ((rec.harvestAmount||0)*price)-exp }; }), [records, prices]);

  // Database Actions
  const handleSetupPin = async (p) => { if(p.length<4)return alert("අංක 4ක් අවශ්‍යයි"); await setDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/settings`, 'security'), {adminPin:p}); setSavedAdminPin(p); setAuthStatus('admin_view'); };
  const handleUpdatePin = async (type, oldP, newP) => { if(type==='admin' && oldP!==savedAdminPin) return false; if(type==='app' && oldP!==savedAdminPin) return false; await updateDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/settings`, 'security'), {[type==='admin'?'adminPin':'appPin']:newP}); if(type==='admin') setSavedAdminPin(newP); else setSavedAppPin(newP); return true; };
  const addRec = async (d) => { await addDoc(collection(db, `artifacts/${__app_id}/users/${user.uid}/tea_records`), {...d, createdAt: serverTimestamp()}); alert("සාර්ථකයි!"); };
  const upRec = async (d) => { const {id,...rest}=d; const p=plots.find(x=>x.id===d.plotId); const f=factories.find(x=>x.id===d.factoryId); await updateDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/tea_records`, id), {...rest, plotName:p?.name, factoryName:f?.name, updatedAt: serverTimestamp()}); alert("යාවත්කාලීනයි!"); };
  const delRec = async (id) => { if(confirm("මකා දමන්නද?")) await deleteDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/tea_records`, id)); };
  const setPrice = async (m, p) => { await setDoc(doc(db, `artifacts/${__app_id}/users/${user.uid}/monthly_prices`, m), {...p, updatedAt: serverTimestamp()}, {merge:true}); alert("මිල යාවත්කාලීනයි"); };
  
  if (loading) return <div className="flex h-screen items-center justify-center text-green-700 font-bold animate-pulse">සකසමින් පවතී...</div>;
  if (!user) return <AuthScreen />;
  if (authStatus === 'setup_admin_pin') return <PinScreen title="මුරපදයක් සාදන්න" message="පළමු වරට පිවිසීම. Admin PIN එකක් දෙන්න." onSubmit={handleSetupPin} buttonText="සකසන්න" icon={ShieldCheck} />;
  if (authStatus === 'login_app_pin') return <PinScreen title="ඇතුල් වන්න" message="සේවක PIN අංකය දෙන්න." onSubmit={(p) => p===savedAppPin ? setAuthStatus('worker_view') : alert("වැරදියි!")} buttonText="Login" icon={Lock} onAdmin={() => setAuthStatus('login_admin_pin')} showAdminBtn={true} />;
  if (authStatus === 'login_admin_pin') return <PinScreen title="Admin පිවිසුම" message="Admin PIN අංකය දෙන්න." onSubmit={(p) => p===savedAdminPin ? setAuthStatus('admin_view') : alert("වැරදියි!")} buttonText="Login" icon={UserCheck} />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 pb-20 md:pb-0">
      <header className="bg-green-800 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-full"><Sprout className="h-6 w-6"/></div><div><h1 className="text-lg font-bold">{authStatus==='worker_view'?"දත්ත ඇතුළත් කිරීම":"තේ වතු පාලක"}</h1><p className="text-xs opacity-80">{user.email}</p></div></div>
          <div className="flex gap-2">
            {authStatus==='admin_view' && <button onClick={()=>setAuthStatus('worker_view')} className="bg-white/20 p-2 rounded"><LogOut size={16}/></button>}
            {authStatus==='admin_view' && <button onClick={()=>{setAuthStatus('login_app_pin');setActiveTab('dashboard')}} className="bg-white/20 p-2 rounded"><Lock size={16}/></button>}
            <button onClick={handleLogout} className="bg-red-500/80 p-2 rounded text-xs font-bold">Logout</button>
          </div>
        </div>
      </header>
      {authStatus==='admin_view' && <div className="hidden md:block bg-white border-b shadow-sm"><div className="max-w-6xl mx-auto flex"><NavTab active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} icon={LayoutDashboard} label="සාරාංශ"/><NavTab active={activeTab==='reports'} onClick={()=>setActiveTab('reports')} icon={FileText} label="වාර්තා"/><NavTab active={activeTab==='entry'} onClick={()=>setActiveTab('entry')} icon={PlusCircle} label="නව දත්ත"/><NavTab active={activeTab==='prices'} onClick={()=>setActiveTab('prices')} icon={Coins} label="මිල"/><NavTab active={activeTab==='settings'} onClick={()=>setActiveTab('settings')} icon={Settings} label="සැකසුම්"/></div></div>}
      <main className="max-w-6xl mx-auto p-4">
        {authStatus==='worker_view' ? <EntryForm factories={factories} plots={plots} onSubmit={addRec} /> : (
          <>
            {activeTab==='dashboard' && <DashboardView records={processedRecords} reminders={reminders} plots={plots} onUpdateReminder={(id,s)=>updateDoc(doc(db,`artifacts/${__app_id}/users/${user.uid}/reminders`,id),{status:s})} />}
            {activeTab==='reports' && <HistoryView records={processedRecords} plots={plots} factories={factories} onDelete={delRec} onUpdate={upRec} />}
            {activeTab==='entry' && <EntryForm factories={factories} plots={plots} onSubmit={addRec} />}
            {activeTab==='prices' && <PriceManager prices={prices} factories={factories} onSave={setPrice} />}
            {activeTab==='settings' && <SettingsManager factories={factories} plots={plots} savedAdminPin={savedAdminPin} savedAppPin={savedAppPin} onAddFac={(n)=>addDoc(collection(db,`artifacts/${__app_id}/users/${user.uid}/factories`),{name:n})} onDelFac={(id)=>deleteDoc(doc(db,`artifacts/${__app_id}/users/${user.uid}/factories`,id))} onAddPlot={(n)=>addDoc(collection(db,`artifacts/${__app_id}/users/${user.uid}/plots`),{name:n})} onDelPlot={(id)=>deleteDoc(doc(db,`artifacts/${__app_id}/users/${user.uid}/plots`,id))} onChangePin={handleUpdatePin} reminders={reminders} onAddRem={(d)=>addDoc(collection(db,`artifacts/${__app_id}/users/${user.uid}/reminders`),{date:d,status:'pending'})} onDelRem={(id)=>deleteDoc(doc(db,`artifacts/${__app_id}/users/${user.uid}/reminders`,id))} onUpRem={(id,s)=>updateDoc(doc(db,`artifacts/${__app_id}/users/${user.uid}/reminders`,id),{status:s})} />}
          </>
        )}
      </main>
      {authStatus==='admin_view' && <div className="fixed bottom-0 w-full bg-white border-t md:hidden grid grid-cols-5 p-2"><MobileNav active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} icon={LayoutDashboard} label="සාරාංශ"/><MobileNav active={activeTab==='reports'} onClick={()=>setActiveTab('reports')} icon={FileText} label="වාර්තා"/><MobileNav active={activeTab==='entry'} onClick={()=>setActiveTab('entry')} icon={PlusCircle} label="දත්ත"/><MobileNav active={activeTab==='prices'} onClick={()=>setActiveTab('prices')} icon={Coins} label="මිල"/><MobileNav active={activeTab==='settings'} onClick={()=>setActiveTab('settings')} icon={Settings} label="සැකසුම්"/></div>}
    </div>
  );
}

// --- Sub Components ---
const PinScreen = ({title, message, onSubmit, buttonText, icon:Icon, onAdmin, showAdminBtn}) => {
  const [p, sP] = useState('');
  return <div className="min-h-screen bg-green-900 flex items-center justify-center p-4"><div className="bg-white p-8 rounded-2xl w-full max-w-md text-center"><div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Icon className="w-10 h-10 text-green-600"/></div><h2 className="text-2xl font-bold mb-2">{title}</h2><p className="text-gray-500 mb-6">{message}</p><form onSubmit={e=>{e.preventDefault(); onSubmit(p); sP('')}}><input type="password" inputMode="numeric" maxLength="6" className="w-full text-center text-3xl font-bold p-4 border-2 rounded-xl mb-6" value={p} onChange={e=>sP(e.target.value)} autoFocus/><button className="w-full bg-green-700 text-white font-bold py-4 rounded-xl mb-4">{buttonText}</button></form>{showAdminBtn && <button onClick={onAdmin} className="text-blue-600 text-sm font-bold">Admin පිවිසුම</button>}</div></div>;
};
const DashboardView = ({records, plots, reminders, onUpdateReminder}) => {
  const [m, sM] = useState(new Date().toISOString().slice(0,7)); const [p, sP] = useState('all');
  const recs = records.filter(r => r.monthId===m && (p==='all' || r.plotId===p));
  const stats = recs.reduce((acc, r) => ({ ...acc, h: acc.h+r.harvest, e: acc.e+r.expenses, i: acc.i+(r.hasPrice?r.income:0), p: acc.p+(r.hasPrice?0:r.harvest) }), {h:0,e:0,i:0,p:0});
  const due = reminders.filter(r => r.status==='pending' && new Date(r.date) <= new Date());
  return <div className="space-y-6">{due.length>0 && <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500"><h3 className="font-bold text-blue-800">මතක් කිරීම්!</h3>{due.map(d=><div key={d.id} className="flex justify-between mt-2 text-sm"><p><strong>{formatDate(d.date)}</strong> පොහොර යෙදීම.</p><button onClick={()=>onUpdateReminder(d.id,'completed')} className="text-blue-600 font-bold"> හරි</button></div>)}</div>}<div className="flex justify-between items-center"><h2 className="font-bold text-lg">{getMonthName(m)}</h2><div className="flex gap-2"><input type="month" value={m} onChange={e=>sM(e.target.value)} className="border p-1 rounded"/><select value={p} onChange={e=>sP(e.target.value)} className="border p-1 rounded"><option value="all">සියල්ල</option>{plots.map(pl=><option key={pl.id} value={pl.id}>{pl.name}</option>)}</select></div></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><StatBox t="අස්වැන්න" v={stats.h.toFixed(1)+" kg"} c="bg-green-500"/><StatBox t="ආදායම" v={formatLKR(stats.i)} c="bg-blue-500"/><StatBox t="වියදම" v={formatLKR(stats.e)} c="bg-red-500"/><StatBox t="ලාභය" v={formatLKR(stats.i-stats.e)} c="bg-emerald-600"/></div>{stats.p>0 && <div className="bg-yellow-50 p-2 rounded text-yellow-700 text-sm">මිල නොදැමූ දළු: {stats.p} kg</div>}</div>;
};
const EntryForm = ({factories, plots, onSubmit}) => {
  const [d, sD] = useState({date:new Date().toISOString().split('T')[0], plotId:'', factoryId:'', harvestAmount:'', workerCount:'', laborCost:'', transportCost:'', otherCost:'', notes:'', image:null});
  useEffect(()=>{if(plots.length && !d.plotId)sD(p=>({...p,plotId:plots[0].id})); if(factories.length && !d.factoryId)sD(p=>({...p,factoryId:factories[0].id}))},[plots,factories]);
  const sub = (e) => { e.preventDefault(); if(!d.plotId)return alert('ඉඩම තෝරන්න'); onSubmit({...d, harvestAmount:Number(d.harvestAmount), workerCount:Number(d.workerCount), laborCost:Number(d.laborCost), transportCost:Number(d.transportCost), otherCost:Number(d.otherCost)}); sD(p=>({...p, harvestAmount:'', workerCount:'', laborCost:'', transportCost:'', otherCost:'', notes:'', image:null})); };
  return <div className="bg-white p-6 rounded-xl shadow-sm max-w-2xl mx-auto"><h2 className="font-bold text-lg mb-4">නව දත්ත</h2><form onSubmit={sub} className="space-y-4"><div className="grid grid-cols-2 gap-4"><input type="date" value={d.date} onChange={e=>sD({...d,date:e.target.value})} className="border p-2 rounded w-full"/><select value={d.plotId} onChange={e=>sD({...d,plotId:e.target.value})} className="border p-2 rounded w-full">{plots.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="grid grid-cols-2 gap-4"><input type="number" step="0.1" placeholder="දළු KG" value={d.harvestAmount} onChange={e=>sD({...d,harvestAmount:e.target.value})} className="border p-2 rounded bg-green-50 font-bold"/><input type="number" placeholder="කම්කරු ගණන" value={d.workerCount} onChange={e=>sD({...d,workerCount:e.target.value})} className="border p-2 rounded"/></div>{Number(d.harvestAmount)>0 && <select value={d.factoryId} onChange={e=>sD({...d,factoryId:e.target.value})} className="border p-2 rounded w-full">{factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}<div className="bg-red-50 p-3 rounded"><p className="text-xs font-bold mb-2">වියදම්</p><div className="grid grid-cols-3 gap-2"><input type="number" placeholder="පඩි" value={d.laborCost} onChange={e=>sD({...d,laborCost:e.target.value})} className="border p-1 rounded text-sm"/><input type="number" placeholder="ප්‍රවාහන" value={d.transportCost} onChange={e=>sD({...d,transportCost:e.target.value})} className="border p-1 rounded text-sm"/><input type="number" placeholder="වෙනත්" value={d.otherCost} onChange={e=>sD({...d,otherCost:e.target.value})} className="border p-1 rounded text-sm"/></div></div><div className="border p-2 rounded"><p className="text-xs text-gray-500 mb-1">ඡායාරූපය</p><input type="file" accept="image/*" onChange={async(e)=>{if(e.target.files[0])sD({...d,image:await compressImage(e.target.files[0])})}}/></div><button className="w-full bg-green-700 text-white py-3 rounded-lg font-bold">සුරකින්න</button></form></div>;
};
const HistoryView = ({records, onDelete, onUpdate, plots, factories}) => {
  const [m, sM] = useState(new Date().toISOString().slice(0,7)); const [edit, sEdit] = useState(null);
  const recs = records.filter(r => r.monthId===m);
  return <div className="space-y-4"><div className="flex items-center gap-2"><label>මාසය:</label><input type="month" value={m} onChange={e=>sM(e.target.value)} className="border p-2 rounded"/></div>{recs.length===0 ? <div className="text-center py-10 text-gray-400">දත්ත නැත</div> : <div className="bg-white rounded shadow overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-gray-100 text-xs uppercase"><tr><th className="p-3">දිනය</th><th className="p-3">අස්වැන්න</th><th className="p-3">ආදායම</th><th className="p-3">ක්‍රියා</th></tr></thead><tbody>{recs.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-bold">{formatDate(r.date)}<div className="text-xs font-normal text-gray-500">{r.plotName}</div></td><td className="p-3 text-green-700 font-bold">{r.harvest} kg</td><td className="p-3">{r.hasPrice?formatLKR(r.income):<span className="text-xs bg-yellow-200 px-1 rounded">Pending</span>}</td><td className="p-3 flex gap-2"><button onClick={()=>onDelete(r.id)} className="text-red-500"><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}</div>;
};
const PriceManager = ({prices, factories, onSave}) => {
  const [m, sM] = useState(new Date().toISOString().slice(0,7)); const [inp, sInp] = useState({});
  useEffect(()=>sInp(prices[m]||{}),[m,prices]);
  return <div className="bg-white p-6 rounded max-w-md mx-auto"><h2 className="font-bold mb-4">මිල ගණන්</h2><input type="month" value={m} onChange={e=>sM(e.target.value)} className="w-full border p-2 rounded mb-4"/><div className="space-y-2">{factories.map(f=><div key={f.id} className="flex justify-between items-center"><span>{f.name}</span><input type="number" value={inp[f.id]||''} onChange={e=>sInp({...inp,[f.id]:e.target.value})} placeholder="Rs." className="border p-2 rounded w-24 text-right"/></div>)}</div><button onClick={()=>onSave(m,inp)} className="w-full bg-yellow-500 text-white font-bold py-2 rounded mt-4">සුරකින්න</button></div>;
};
const SettingsManager = ({factories, plots, onAddFac, onDelFac, onAddPlot, onDelPlot, onChangePin, savedAdminPin, savedAppPin, reminders, onAddRem, onDelRem, onUpRem}) => {
  const [nf, sNf] = useState(''); const [np, sNp] = useState(''); const [rd, sRd] = useState('');
  const [pass, sPass] = useState({old:'', new:'', con:''});
  const changeP = async(type) => { if(pass.new!==pass.con || pass.new.length<4)return alert("මුරපදය ගැටළුවක්"); if(await onChangePin(type, pass.old, pass.new)){alert("හරි"); sPass({old:'',new:'',con:''})}else{alert("පරණ මුරපදය වැරදියි")} };
  return <div className="max-w-2xl mx-auto space-y-6"><div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">ඉඩම්</h3><div className="flex gap-2 mb-2"><input value={np} onChange={e=>sNp(e.target.value)} className="border p-2 flex-1 rounded" placeholder="නම"/><button onClick={()=>{onAddPlot(np);sNp('')}} className="bg-blue-600 text-white px-4 rounded">Add</button></div>{plots.map(p=><div key={p.id} className="flex justify-between p-2 border-b"><span>{p.name}</span><button onClick={()=>onDelPlot(p.id)}><Trash2 size={16} className="text-red-500"/></button></div>)}</div><div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">කර්මාන්ත ශාලා</h3><div className="flex gap-2 mb-2"><input value={nf} onChange={e=>sNf(e.target.value)} className="border p-2 flex-1 rounded" placeholder="නම"/><button onClick={()=>{onAddFac(nf);sNf('')}} className="bg-green-600 text-white px-4 rounded">Add</button></div>{factories.map(f=><div key={f.id} className="flex justify-between p-2 border-b"><span>{f.name}</span><button onClick={()=>onDelFac(f.id)}><Trash2 size={16} className="text-red-500"/></button></div>)}</div><div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">මතක් කිරීම්</h3><div className="flex gap-2 mb-2"><input type="date" value={rd} onChange={e=>sRd(e.target.value)} className="border p-2 flex-1 rounded"/><button onClick={()=>{onAddRem(rd);sRd('')}} className="bg-purple-600 text-white px-4 rounded">Add</button></div>{reminders.map(r=><div key={r.id} className="flex justify-between p-2 border-b"><span>{formatDate(r.date)}</span><div className="flex gap-2">{r.status!=='completed'&&<button onClick={()=>onUpRem(r.id,'completed')} className="text-green-500"><Check size={16}/></button>}<button onClick={()=>onDelRem(r.id)} className="text-red-500"><X size={16}/></button></div></div>)}</div><div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-2">Admin මුරපදය වෙනස් කිරීම</h3><div className="space-y-2"><input type="password" placeholder="පරණ එක" className="border p-2 w-full rounded" value={pass.old} onChange={e=>sPass({...pass,old:e.target.value})}/><input type="password" placeholder="අලුත් එක" className="border p-2 w-full rounded" value={pass.new} onChange={e=>sPass({...pass,new:e.target.value})}/><input type="password" placeholder="තහවුරු කරන්න" className="border p-2 w-full rounded" value={pass.con} onChange={e=>sPass({...pass,con:e.target.value})}/><button onClick={()=>changeP('admin')} className="bg-red-600 text-white w-full py-2 rounded font-bold">වෙනස් කරන්න</button></div></div></div>;
};
const NavTab = ({active, onClick, icon:Icon, label}) => <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 border-b-2 ${active?'border-green-700 text-green-800':'border-transparent'}`}><Icon size={18}/>{label}</button>;
const MobileNav = ({active, onClick, icon:Icon, label}) => <button onClick={onClick} className={`flex flex-col items-center ${active?'text-green-700':'text-gray-400'}`}><Icon size={20}/><span className="text-[10px]">{label}</span></button>;
const StatBox = ({t,v,c}) => <div className="bg-white p-3 rounded shadow border"><div className={`w-8 h-8 rounded flex items-center justify-center text-white mb-2 ${c}`}><Sprout size={16}/></div><p className="text-xs text-gray-500 font-bold uppercase">{t}</p><p className="font-bold text-lg truncate">{v}</p></div>;