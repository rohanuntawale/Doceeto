import { useEffect, useMemo, useState } from "react";
import { Browser } from "@capacitor/browser";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, HeartPulse, Home, LogOut, MapPin, Search, ShieldCheck, Stethoscope, UserRound, Video, X, Zap } from "lucide-react";
import { api, type Patient, type Provider, type RequestRow } from "./api/client";

type Screen = "home" | "find" | "active" | "account";
type Cadre = "doctor" | "nurse";

async function openExternal(url: string) {
  if ("Capacitor" in window) await Browser.open({ url });
  else window.open(url, "_blank", "noopener,noreferrer");
}

export default function App() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  async function refreshSession() {
    try {
      const body = await api.me();
      setPatient(body.patient ?? body.user ?? null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not connect to Doceeto.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refreshSession(); }, []);

  if (loading) return <Loading />;
  if (!patient) return <Login onSignedIn={refreshSession} initialError={authError} />;
  return <MobileShell patient={patient} onLogout={() => setPatient(null)} />;
}

function Loading() {
  return <div className="loading"><img src="/brand/doceeto-icon.png" alt="Doceeto" /><span>Care that reaches you.</span></div>;
}

function Login({ onSignedIn, initialError }: { onSignedIn: () => Promise<void>; initialError: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api.login(email, password); await onSignedIn(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  function google() {
    const mobileReturn = `${window.location.origin}/?auth=google`;
    const query = new URLSearchParams({ role: "patient", next: "/patient", mobile_return: mobileReturn });
    window.location.assign(`${api.baseUrl}/api/auth/google/start?${query}`);
  }

  return <main className="auth-page">
    <div className="auth-brand"><img src="/brand/doceeto-icon.png" alt="Doceeto" /><span>DOCEETO</span></div>
    <section className="auth-card">
      <p className="eyebrow">YOUR FRONT DOOR TO CARE</p>
      <h1>Welcome back.</h1>
      <p className="muted">One calm place for doctors, nurses, medicine and urgent help.</p>
      <form onSubmit={submit} className="stack">
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="or"><span>or</span></div>
      <button className="google" onClick={google}><span className="google-g">G</span> Continue with Google</button>
      <button className="text-button" onClick={() => void openExternal(`${api.baseUrl}/signup?role=patient`)}>Create a patient account <ArrowRight size={15} /></button>
    </section>
  </main>;
}

function MobileShell({ patient, onLogout }: { patient: Patient; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<Provider | null>(null);
  const [cadre, setCadre] = useState<Cadre>("doctor");
  const [reload, setReload] = useState(0);

  function openProvider(provider: Provider | null) { setSelected(provider); setScreen("find"); }
  async function logout() { await api.logout().catch(() => undefined); onLogout(); }

  return <div className="app-frame">
    <header className="topbar"><div className="mini-brand"><img src="/brand/doceeto-icon.png" alt="" /> <span>DOCEETO</span></div><span className="location"><MapPin size={14} /> India</span></header>
    <main className="screen-area">
      {screen === "home" && <HomeScreen patient={patient} onFind={() => { setSelected(null); setScreen("find"); }} onActive={() => setScreen("active")} reload={reload} />}
      {screen === "find" && <FindScreen cadre={cadre} setCadre={setCadre} selected={selected} setSelected={openProvider} patient={patient} onBooked={() => { setReload(v => v + 1); setScreen("active"); }} />}
      {screen === "active" && <ActiveScreen reload={reload} />}
      {screen === "account" && <AccountScreen patient={patient} logout={logout} />}
    </main>
    <nav className="bottom-nav">
      <NavItem active={screen === "home"} label="Home" icon={<Home size={20} />} onClick={() => { setSelected(null); setScreen("home"); }} />
      <NavItem active={screen === "find"} label="Find care" icon={<Search size={20} />} onClick={() => setScreen("find")} />
      <NavItem active={screen === "active"} label="Care now" icon={<Zap size={20} />} onClick={() => setScreen("active")} />
      <NavItem active={screen === "account"} label="Account" icon={<UserRound size={20} />} onClick={() => setScreen("account")} />
    </nav>
  </div>;
}

function NavItem({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function HomeScreen({ patient, onFind, onActive, reload }: { patient: Patient; onFind: () => void; onActive: () => void; reload: number }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  useEffect(() => { void api.requests().then(setRequests).catch(() => setRequests([])); }, [reload]);
  const active = requests.find(r => !["completed", "cancelled", "declined"].includes(r.status ?? ""));
  return <div className="content">
    <div className="greeting"><p className="eyebrow">GOOD TO SEE YOU</p><h1>Hello, {patient.name.split(" ")[0]}.</h1><p className="muted">What kind of care do you need today?</p></div>
    {active && <button className="active-banner" onClick={onActive}><span className="pulse"><HeartPulse size={19} /></span><span><strong>Your care is in motion</strong><small>{active.doctorName || "Finding the right provider"}</small></span><ChevronRight /></button>}
    <section className="hero-card"><div><p className="eyebrow light">DOCEETO CARE</p><h2>Care, without<br />the chase.</h2><p>Reach the right person, right when you need them.</p></div><div className="hero-orbit"><HeartPulse size={34} /></div></section>
    <h2 className="section-title">Start here</h2>
    <div className="care-grid">
      <ActionCard icon={<Video />} label="Video doctor" tint="coral" onClick={onFind} />
      <ActionCard icon={<Stethoscope />} label="Doctor visit" tint="sage" onClick={onFind} />
      <ActionCard icon={<HeartPulse />} label="Nurse at home" tint="blue" onClick={onFind} />
      <ActionCard icon={<Zap />} label="Care now" tint="gold" onClick={onActive} />
    </div>
    <section className="quiet-card"><ShieldCheck size={19} /><div><strong>Care with context</strong><p>Your health profile stays with you, so every visit starts informed.</p></div><ChevronRight size={18} /></section>
  </div>;
}

function ActionCard({ icon, label, tint, onClick }: { icon: React.ReactNode; label: string; tint: string; onClick: () => void }) {
  return <button className={`action-card ${tint}`} onClick={onClick}><span className="action-icon">{icon}</span><span>{label}</span><ArrowRight size={15} /></button>;
}

function FindScreen({ cadre, setCadre, selected, setSelected, patient, onBooked }: { cadre: Cadre; setCadre: (v: Cadre) => void; selected: Provider | null; setSelected: (v: Provider | null) => void; patient: Patient; onBooked: () => void }) {
  const [providers, setProviders] = useState<Provider[]>([]); const [query, setQuery] = useState(""); const [error, setError] = useState("");
  useEffect(() => { void api.doctors(cadre).then(setProviders).catch(err => setError(err instanceof Error ? err.message : "Could not load providers.")); }, [cadre]);
  if (selected) return <ProviderDetail provider={selected} patient={patient} onBack={() => setSelected(null)} onBooked={onBooked} />;
  const filtered = providers.filter(p => `${p.name} ${p.specialty ?? ""} ${p.title ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="content"><div className="screen-heading"><p className="eyebrow">FIND YOUR FIT</p><h1>Someone to help.</h1><p className="muted">Browse the people ready to care for you.</p></div><div className="segmented"><button className={cadre === "doctor" ? "selected" : ""} onClick={() => setCadre("doctor")}>Doctors</button><button className={cadre === "nurse" ? "selected" : ""} onClick={() => setCadre("nurse")}>Nurses</button></div><label className="search"><Search size={18} /><input placeholder="Search by name or specialty" value={query} onChange={e => setQuery(e.target.value)} /></label>{error && <p className="error">{error}</p>}<div className="provider-list">{filtered.map(provider => <ProviderCard key={provider.id} provider={provider} onClick={() => setSelected(provider)} />)}{!filtered.length && !error && <div className="empty"><MapPin size={24} /><strong>No one matches that search yet.</strong><span>Try another name or switch care type.</span></div>}</div></div>;
}

function ProviderCard({ provider, onClick }: { provider: Provider; onClick: () => void }) {
  return <button className="provider-card" onClick={onClick}><Avatar provider={provider} /><span className="provider-copy"><strong>{provider.name}</strong><small>{provider.specialty || provider.title || "Care provider"}</small><small className="provider-meta"><span className={`status-dot ${provider.status === "online" ? "online" : ""}`} /> {provider.status === "online" ? "Available now" : "View availability"}{provider.rating ? ` · ${provider.rating.toFixed(1)} ★` : ""}</small></span><ChevronRight size={18} /></button>;
}

function ProviderDetail({ provider, patient, onBack, onBooked }: { provider: Provider; patient: Patient; onBack: () => void; onBooked: () => void }) {
  const [type, setType] = useState<"video" | "home_visit">("video"); const [symptoms, setSymptoms] = useState(""); const [address, setAddress] = useState(patient.address || ""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function book() {
    setBusy(true); setError("");
    try {
      const coords = await locate(patient); if (!coords) throw new Error("Allow location so your provider can find you.");
      await api.action("createRequest", { mode: "emergency", doctorId: provider.id, targetCadre: provider.cadre === "nurse" ? "nurse" : "doctor", type, fee: type === "home_visit" ? provider.homeVisitFee ?? 600 : provider.consultFee ?? 400, symptoms, address, lat: coords.lat, lng: coords.lng, paymentMethod: "online" }); onBooked();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the booking."); } finally { setBusy(false); }
  }
  return <div className="content"><button className="back" onClick={onBack}><ArrowLeft size={18} /> Find care</button><div className="detail-hero"><Avatar provider={provider} large /><p className="eyebrow">{provider.status === "online" ? "AVAILABLE NOW" : "CARE PROVIDER"}</p><h1>{provider.name}</h1><p className="muted">{provider.specialty || provider.title || "Personal care, when it matters."}</p>{provider.verified && <span className="verified"><ShieldCheck size={14} /> Verified provider</span>}</div><div className="detail-panel"><h2>Choose your visit</h2><div className="visit-options"><button className={type === "video" ? "visit selected" : "visit"} onClick={() => setType("video")}><Video /><span><strong>Video consultation</strong><small>From ₹{provider.consultFee ?? 400}</small></span><Check size={17} /></button><button className={type === "home_visit" ? "visit selected" : "visit"} onClick={() => setType("home_visit")}><Home /><span><strong>Home visit</strong><small>From ₹{provider.homeVisitFee ?? 600}</small></span><Check size={17} /></button></div>{type === "home_visit" && <label>Visit address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Where should we meet?" /></label>}<label>What do you need help with?<textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="A short note for your provider" rows={3} /></label>{error && <p className="error">{error}</p>}<button className="primary wide" onClick={book} disabled={busy}>{busy ? "Finding care…" : "Request care"}<ArrowRight size={17} /></button></div></div>;
}

function ActiveScreen({ reload }: { reload: number }) { const [requests, setRequests] = useState<RequestRow[]>([]); useEffect(() => { void api.requests().then(setRequests).catch(() => setRequests([])); }, [reload]); const active = requests.filter(r => !["completed", "cancelled", "declined"].includes(r.status ?? "")); return <div className="content"><div className="screen-heading"><p className="eyebrow">YOUR CARE</p><h1>Right here with you.</h1><p className="muted">Bookings, arrivals and active visits in one place.</p></div>{active.length ? active.map(request => <RequestCard key={request.id} request={request} />) : <div className="empty large"><HeartPulse size={28} /><strong>No active care yet.</strong><span>When you request a doctor or nurse, their progress will appear here.</span></div>}<section className="help-card"><Zap size={19} /><div><strong>Need urgent help?</strong><p>For emergencies, call your local emergency service.</p></div></section></div>; }

function RequestCard({ request }: { request: RequestRow }) { const [busy, setBusy] = useState(false); async function cancel() { setBusy(true); await api.action("cancelRequest", { id: request.id, reason: "Cancelled by patient" }).catch(() => undefined); setBusy(false); } return <section className="request-card"><div className="request-top"><span className="pulse small"><HeartPulse size={17} /></span><span><strong>{request.doctorName || "Finding your provider"}</strong><small>{request.type === "home_visit" ? "Home visit" : "Video consultation"}</small></span><span className="request-status">{request.status || "pending"}</span></div>{request.startCode && <div className="code"><span>Arrival code</span><strong>{request.startCode}</strong><small>Share this with your provider when they arrive.</small></div>}<button className="cancel" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel request"}</button></section>; }

function AccountScreen({ patient, logout }: { patient: Patient; logout: () => Promise<void> }) { return <div className="content"><div className="screen-heading"><p className="eyebrow">YOUR DOCEETO</p><h1>Account.</h1><p className="muted">Keep your care details close and current.</p></div><section className="account-card"><Avatar provider={{ name: patient.name, avatarUrl: patient.avatarUrl }} large /><div><h2>{patient.name}</h2><p>{patient.email || "Patient account"}</p></div></section><button className="account-row"><UserRound size={19} /><span>Health profile</span><ChevronRight /></button><button className="account-row"><CalendarDays size={19} /><span>Care history</span><ChevronRight /></button><button className="account-row danger" onClick={() => void logout}><LogOut size={19} /><span>Sign out</span><ChevronRight /></button></div>; }

function Avatar({ provider, large = false }: { provider: Pick<Provider, "name" | "avatarUrl">; large?: boolean }) { return provider.avatarUrl ? <img className={`avatar ${large ? "large" : ""}`} src={provider.avatarUrl} alt="" /> : <span className={`avatar initials ${large ? "large" : ""}`}>{provider.name.slice(0, 1).toUpperCase()}</span>; }

function locate(patient: Patient): Promise<{ lat: number; lng: number } | null> { if (Number.isFinite(patient.lat) && Number.isFinite(patient.lng)) return Promise.resolve({ lat: patient.lat as number, lng: patient.lng as number }); return new Promise(resolve => { if (!navigator.geolocation) return resolve(null); navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 12000 }); }); }
