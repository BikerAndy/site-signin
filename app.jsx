
/** Site Sign‑In / Sign‑Out – single‑file React app
 *  Notes:
 *   - Data stored in localStorage for offline use
 *   - Export CSV and Fire Roll Call (print) included
 *   - Default Admin PIN: 1234 (change in Settings)
 */
const { useMemo, useRef, useState, useEffect } = React;

const PPE_ITEMS = [
  { id: "boots", label: "Safety boots" },
  { id: "hivis", label: "Hi‑vis" },
  { id: "hardhat", label: "Hard hat" },
  { id: "gloves", label: "Gloves" },
  { id: "eyewear", label: "Eye protection" },
];

function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function nowISO() { return new Date().toISOString(); }

const KEY_WORKERS = "siteSignIn.workers";
const KEY_VISITS = "siteSignIn.visits";
const KEY_SETTINGS = "siteSignIn.settings";

const defaultSettings = {
  siteName: "Selfridges – Concession Works",
  adminPin: "1234",
  requireInduction: true,
  requireRAMS: true,
  requirePPE: ["boots", "hivis", "hardhat"],
};

function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function toCSV(rows, headers) {
  const escape = (s) => '"' + String(s ?? "").replaceAll('"', '""') + '"';
  const head = headers.map(h => escape(h.label)).join(",");
  const body = rows.map(r => headers.map(h => escape(h.get(r))).join(",")).join("\n");
  return head + "\n" + body;
}
function download(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Section({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Pill({ children, className = "" }) {
  return <span className={"inline-block text-xs px-2 py-1 rounded-full bg-gray-100 " + className}>{children}</span>;
}
function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={"w-12 h-6 rounded-full transition-all " + (checked ? "bg-green-500" : "bg-gray-300")}>
      <span className={"block w-5 h-5 bg-white rounded-full shadow transform transition-all " + (checked ? "translate-x-6" : "translate-x-1")}></span>
    </button>
  );
}
function TextInput({ label, value, onChange, placeholder = "", required = false }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
             className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring" />
    </label>
  );
}
function Select({ label, value, onChange, options, required=false }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded-xl px-3 py-2">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 mb-2">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function RosterList({ people }) {
  if (people.length === 0) return <p className="text-sm text-gray-500">No one on site.</p>;
  return (
    <ul className="divide-y">
      {people.map(p => (
        <li key={p.id} className="py-2 flex items-center justify-between">
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-gray-600">{p.company} · {p.role}</div>
          </div>
          <Pill>On site</Pill>
        </li>
      ))}
    </ul>
  );
}

function SignForm({ mode, settings, onUpsert, onVisit, workers }) {
  const [existingId, setExistingId] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [cscs, setCscs] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [ppe, setPpe] = useState([]);
  const [induction, setInduction] = useState(false);
  const [rams, setRams] = useState(false);
  const [notes, setNotes] = useState("");
  const [ack, setAck] = useState(false);

  useEffect(() => {
    if (!existingId) return;
    const w = workers.find(w => w.id === existingId);
    if (w) {
      setName(w.name || ""); setCompany(w.company || ""); setRole(w.role || ""); setCscs(w.cscs || "");
      setPhone(w.phone || ""); setEmail(w.email || ""); setEmergencyContact(w.emergencyContact || ""); setVehicleReg(w.vehicleReg || "");
    }
  }, [existingId]);

  function togglePPE(id) {
    setPpe(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }
  function validate() {
    if (!name.trim() || !company.trim()) return false;
    if (mode === "IN") {
      if (settings.requireInduction && !induction) return false;
      if (settings.requireRAMS && !rams) return false;
      for (const id of settings.requirePPE) if (!ppe.includes(id)) return false;
      if (!ack) return false;
    }
    return true;
  }
  function submit() {
    if (!validate()) { alert("Please complete required fields and declarations."); return; }
    let workerId = existingId; if (!workerId) { workerId = uuid(); }
    const profile = { id: workerId, name, company, role, cscs, phone, email, emergencyContact, vehicleReg };
    onUpsert(profile);
    onVisit(workerId, mode, { ppe, induction, rams, notes });
    setExistingId(""); setName(""); setCompany(""); setRole(""); setCscs(""); setPhone(""); setEmail(""); setEmergencyContact(""); setVehicleReg(""); setPpe([]); setInduction(false); setRams(false); setNotes(""); setAck(false);
    alert(`Successfully signed ${mode === 'IN' ? 'IN' : 'OUT'}.`);
  }
  const existingOpts = [{ value: "", label: "— New person —" }, ...workers.map(w => ({ value: w.id, label: `${w.name} (${w.company})` }))];

  return (
    <Section title={`Sign ${mode === 'IN' ? 'IN' : 'OUT'}`} right={
      <div className="flex items-center gap-2">
        <span className="text-sm">Switch</span>
        <Toggle checked={mode === "OUT"} onChange={() => {}} />
      </div>
    }>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Existing person" value={existingId} onChange={setExistingId} options={existingOpts} />
        <TextInput label="Full name" value={name} onChange={setName} required />
        <TextInput label="Company" value={company} onChange={setCompany} required />
        <TextInput label="Trade/Role" value={role} onChange={setRole} />
        <TextInput label="CSCS No. (optional)" value={cscs} onChange={setCscs} />
        <TextInput label="Mobile (optional)" value={phone} onChange={setPhone} />
        <TextInput label="Email (optional)" value={email} onChange={setEmail} />
        <TextInput label="Emergency contact (optional)" value={emergencyContact} onChange={setEmergencyContact} />
        <TextInput label="Vehicle reg (optional)" value={vehicleReg} onChange={setVehicleReg} />
      </div>

      {mode === 'IN' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-medium mb-2">PPE on person</h3>
            {PPE_ITEMS.map(p => (
              <Checkbox key={p.id} checked={ppe.includes(p.id)} onChange={()=>togglePPE(p.id)} label={p.label} />
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-medium mb-2">Declarations</h3>
            <Checkbox checked={induction} onChange={setInduction} label="I have completed the site induction" />
            <Checkbox checked={rams} onChange={setRams} label="I have read and understood applicable RAMS" />
            <Checkbox checked={ack} onChange={setAck} label="I understand site rules and emergency procedures" />
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-medium mb-2">Notes</h3>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Reason for visit, delivery details, hot works, etc." className="w-full border rounded-xl p-2 h-28"></textarea>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col md:flex-row gap-3">
        <button onClick={submit} className={"px-4 py-3 rounded-xl text-white font-semibold " + (mode==='IN' ? 'bg-green-600' : 'bg-red-600')}>Sign {mode==='IN'?'IN':'OUT'}</button>
        <button onClick={() => { setExistingId(""); setName(""); setCompany(""); setRole(""); setCscs(""); setPhone(""); setEmail(""); setEmergencyContact(""); setVehicleReg(""); setPpe([]); setInduction(false); setRams(false); setNotes(""); setAck(false); }} className="px-4 py-3 rounded-xl bg-gray-200">Clear</button>
      </div>
    </Section>
  );
}

function App() {
  const [settings, setSettings] = useState(() => ({ ...defaultSettings, ...load(KEY_SETTINGS, {}) }));
  const [workers, setWorkers] = useState(() => load(KEY_WORKERS, []));
  const [visits, setVisits] = useState(() => load(KEY_VISITS, []));
  const [admin, setAdmin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [mode, setMode] = useState("IN");
  const [search, setSearch] = useState("");

  useEffect(() => save(KEY_SETTINGS, settings), [settings]);
  useEffect(() => save(KEY_WORKERS, workers), [workers]);
  useEffect(() => save(KEY_VISITS, visits), [visits]);

  const activeWorkerIds = useMemo(() => {
    const lastByWorker = new Map();
    for (const v of visits) lastByWorker.set(v.workerId, v);
    const active = new Set();
    for (const w of workers) {
      const v = lastByWorker.get(w.id);
      if (v && v.direction === "IN") active.add(w.id);
    }
    return active;
  }, [visits, workers]);

  const activeWorkers = workers.filter(w => activeWorkerIds.has(w.id));

  function upsertWorker(profile) {
    setWorkers(prev => {
      const i = prev.findIndex(p => p.id === profile.id);
      if (i === -1) return [...prev, profile];
      const copy = [...prev]; copy[i] = profile; return copy;
    });
  }
  function recordVisit(workerId, direction, payload) {
    const visit = { id: uuid(), workerId, direction, timeISO: nowISO(), ...payload };
    setVisits(v => [...v, visit]);
  }
  function exportCSV() {
    const headers = [
      { label: "Timestamp", get: r => r.timeISO },
      { label: "Direction", get: r => r.direction },
      { label: "Name", get: r => workers.find(w => w.id === r.workerId)?.name || "" },
      { label: "Company", get: r => workers.find(w => w.id === r.workerId)?.company || "" },
      { label: "Role", get: r => workers.find(w => w.id === r.workerId)?.role || "" },
      { label: "CSCS", get: r => workers.find(w => w.id === r.workerId)?.cscs || "" },
      { label: "Phone", get: r => workers.find(w => w.id === r.workerId)?.phone || "" },
      { label: "Induction", get: r => r.induction ? "Yes" : "No" },
      { label: "RAMS Ack", get: r => r.rams ? "Yes" : "No" },
      { label: "PPE", get: r => (r.ppe||[]).join(";") },
      { label: "Notes", get: r => r.notes || "" },
    ];
    const csv = toCSV(visits, headers);
    download(`site-attendance_${new Date().toISOString().slice(0,10)}.csv`, csv);
  }
  function resetAll() {
    if (!confirm("This will clear ALL local data (workers & visits). Continue?")) return;
    setWorkers([]); setVisits([]);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{settings.siteName}</h1>
          <p className="text-sm text-gray-600">Site Sign‑In / Sign‑Out (Offline‑ready)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-white rounded-full px-2 py-1 shadow">
            <span className={"text-xs px-2 py-1 rounded-full " + (mode === "IN" ? "bg-green-100 text-green-800" : "bg-gray-100")}>IN</span>
            <Toggle checked={mode === "OUT"} onChange={(c) => setMode(c ? "OUT" : "IN")} />
            <span className={"text-xs px-2 py-1 rounded-full " + (mode === "OUT" ? "bg-red-100 text-red-800" : "bg-gray-100")}>OUT</span>
          </div>
          {!admin ? (
            <div className="flex items-center gap-2">
              <input value={pinInput} onChange={e=>setPinInput(e.target.value)} placeholder="Admin PIN" className="w-28 border rounded-xl px-3 py-1" />
              <button onClick={() => setAdmin(pinInput === settings.adminPin)} className="px-3 py-2 rounded-xl bg-black text-white">Admin</button>
            </div>
          ) : (
            <button onClick={() => setAdmin(false)} className="px-3 py-2 rounded-xl bg-gray-800 text-white">Exit Admin</button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SignForm mode={mode} settings={settings} onUpsert={upsertWorker} onVisit={recordVisit} workers={workers} />
        </div>

        <div className="lg:col-span-1">
          <Section title="On‑site right now" right={<button onClick={exportCSV} className="text-sm bg-black text-white px-3 py-2 rounded-xl">Export CSV</button>}>
            <div className="flex items-center gap-2 mb-2">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name/company" className="w-full border rounded-xl px-3 py-2" />
              <button onClick={()=>setSearch("")} className="text-sm underline">Clear</button>
            </div>
            <RosterList people={workers.filter(w => (new Set(visits.filter(v=>v.direction==='IN').map(v=>v.workerId))).has(w.id)).filter(w => (w.name+" "+w.company).toLowerCase().includes(search.toLowerCase()))} />
            <button onClick={() => window.print()} className="mt-3 w-full bg-amber-500 text-white px-3 py-3 rounded-xl font-semibold">Fire Roll Call (Print)</button>
          </Section>

          {admin && (
            <>
              <Section title="Admin – Attendance Log" right={<Pill>{visits.length} records</Pill>}>
                <div className="max-h-64 overflow-auto border rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-100">
                      <tr>
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Dir</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Company</th>
                        <th className="text-left p-2">PPE</th>
                        <th className="text-left p-2">Ind/RAMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.slice().reverse().map(v => {
                        const w = workers.find(x => x.id === v.workerId);
                        return (
                          <tr key={v.id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 whitespace-nowrap">{new Date(v.timeISO).toLocaleString()}</td>
                            <td className="p-2"><span className={"px-2 py-1 rounded-full text-xs " + (v.direction==='IN'?'bg-green-100 text-green-800':'bg-red-100 text-red-800')}>{v.direction}</span></td>
                            <td className="p-2">{w?.name}</td>
                            <td className="p-2">{w?.company}</td>
                            <td className="p-2">{(v.ppe||[]).join(', ')}</td>
                            <td className="p-2">{v.induction? 'Inducted' : '—'} / {v.rams? 'RAMS' : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-black text-white">Export CSV</button>
                  <button onClick={resetAll} className="px-3 py-2 rounded-xl bg-red-600 text-white">Reset ALL data</button>
                </div>
              </Section>

              <Section title="Admin – Settings">
                <TextInput label="Site name" value={settings.siteName} onChange={v=>setSettings(s=>({...s, siteName:v}))} />
                <TextInput label="Admin PIN" value={settings.adminPin} onChange={v=>setSettings(s=>({...s, adminPin:v}))} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <h3 className="font-medium mb-2">Mandatory declarations</h3>
                    <Checkbox checked={settings.requireInduction} onChange={v=>setSettings(s=>({...s, requireInduction:v}))} label="Induction completed" />
                    <Checkbox checked={settings.requireRAMS} onChange={v=>setSettings(s=>({...s, requireRAMS:v}))} label="RAMS reviewed/acknowledged" />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <h3 className="font-medium mb-2">Required PPE to sign IN</h3>
                    {PPE_ITEMS.map(p => (
                      <Checkbox key={p.id} checked={settings.requirePPE.includes(p.id)} onChange={(v)=>{
                        setSettings(s=>({
                          ...s,
                          requirePPE: v ? Array.from(new Set([...s.requirePPE, p.id])) : s.requirePPE.filter(x=>x!==p.id)
                        }));
                      }} label={p.label} />
                    ))}
                  </div>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gray-500">
        <p>Data is stored locally in this browser. Export CSV for backups. © {new Date().getFullYear()} RSK Consultancy – Site Kiosk MVP</p>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
