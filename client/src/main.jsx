import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';


const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
async function request(path, { token, body, headers = {}, ...options } = {}) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!isForm && body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Request could not be completed.');
  return data;
}

const shortHash = (hash = '') => hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : '—';
const titleCase = (value = '') => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateText = (date) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—';

function Badge({ value }) { return <span className={`badge ${String(value).toLowerCase()}`}>{titleCase(value)}</span>; }
function Empty({ title, text }) { return <div className="empty"><div className="empty-icon">⌁</div><strong>{title}</strong><span>{text}</span></div>; }
function Toast({ message, kind, onClose }) { if (!message) return null; return <div className={`toast ${kind || ''}`}><span>{kind === 'error' ? '!' : '✓'}</span><p>{message}</p><button onClick={onClose}>×</button></div>; }

function Login({ onLogin }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [role, setRole] = useState('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const body = mode === 'register' ? { name, role, email, password } : { email, password };
      onLogin(await request(path, { method: 'POST', body }));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-aside">
      <div className="brand"><div className="brand-mark">▦</div><span>LandLedger</span></div>
      <div className="login-hero"><p className="eyebrow">ACADEMIC BLOCKCHAIN PROTOTYPE</p><h1>Clear records.<br/><i>Accountable</i> workflows.</h1><p>Manage self-submitted property claims, document integrity, authority workflow review, and an auditable transaction history.</p></div>
      <div className="chain-preview"><span>SUBMISSION</span><b>→</b><span>REVIEW</span><b>→</b><span>WORKFLOW</span><b>→</b><span>AUDIT</span></div>
      <small>Academic research prototype. Not a government land registry or proof of legal title.</small>
    </section>
    <section className="login-card-wrap"><form className="login-card" onSubmit={submit}>
      <p className="eyebrow">{mode === 'register' ? 'CREATE AN ACCOUNT' : 'WELCOME BACK'}</p>
      <h2>{mode === 'register' ? 'Register your account' : 'Sign in to your portal'}</h2>
      <p className="muted">{mode === 'register' ? 'Create an owner, buyer, or seller account. Authority accounts must be provisioned separately by the organisation.' : 'Use your registered email and password.'}</p>
      {mode === 'register' && <>
        <label>Full name<input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength="2" maxLength="120" required /></label>
        <label>Account type<select value={role} onChange={(e) => setRole(e.target.value)}><option value="owner">Property claimant</option><option value="seller">Seller</option><option value="buyer">Buyer</option></select></label>
      </>}
      <label>Email<input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" name="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === 'register' ? 12 : 1} required /></label>
      {mode === 'register' && <p className="info-note">Registration records your submitted identity details only. It does not verify identity, land ownership, or legal title. Use at least 12 characters, with upper-case, lower-case, and a number.</p>}
      {error && <div className="form-error">{error}</div>}
      <button className="primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in securely'} <span>→</span></button>
      <button type="button" className="secondary full" disabled={busy} onClick={() => { setMode(mode === 'register' ? 'signin' : 'register'); setError(''); }}>{mode === 'register' ? 'Back to sign in' : 'Create a new account'}</button>
    </form></section>
  </main>;
}

function Stat({ label, value, help, icon, tone = '' }) { return <div className={`stat ${tone}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value ?? '—'}</strong><small>{help}</small></div></div>; }

function PropertyTable({ properties, onSelect, allowRegister }) {
  return <section className="panel property-panel"><div className="panel-head"><div><p className="eyebrow">PROPERTY REGISTER</p><h2>Submitted claims in view</h2></div>{allowRegister && <button className="primary" onClick={allowRegister}>+ Register property</button>}</div>
    {properties.length ? <div className="table-wrap"><table><thead><tr><th>Parcel & property</th><th>Claimant (self-reported)</th><th>Land type</th><th>Review state</th><th></th></tr></thead><tbody>{properties.map((property) => <tr key={property.id} onClick={() => onSelect(property)}><td><b>{property.title}</b><small>{property.parcelNumber} · {property.address}</small></td><td>{property.ownerName}</td><td>{property.landType}<small>{property.areaSqm} sq m</small></td><td><Badge value={property.status}/></td><td><button className="row-action">View →</button></td></tr>)}</tbody></table></div> : <Empty title="No submitted claims found" text="Submit a claim to begin the application workflow." />}
  </section>;
}

function Dashboard({ user, properties, transfers, analytics, onSelect, onRegister }) {
  const owned = properties.filter((item) => item.ownerId === user.id);
  const pendingTransfers = transfers.filter((item) => ['PROPOSED', 'ACCEPTED'].includes(item.status));
  const authority = ['authority', 'admin'].includes(user.role);
  return <><section className="page-heading"><div><p className="eyebrow">{authority ? 'AUTHORITY COMMAND CENTER' : `${titleCase(user.role)} WORKSPACE`}</p><h1>Good day, {user.name.split(' ')[0]}.</h1><p>Here is the current application-workflow view. Submitted claims are not legal title records.</p></div><div className="ledger-pill"><span className={analytics?.integrity?.valid ? 'ledger-dot healthy' : 'ledger-dot'}></span><div><b>Audit ledger</b><small>{analytics?.integrity?.valid ? `${analytics.integrity.checkedBlocks} blocks verified` : 'Local audit mode'}</small></div></div></section>
    <section className="stats-grid">
      <Stat label={authority ? 'Submitted property claims' : 'Claims you submitted'} value={authority ? analytics?.summary?.totalProperties : owned.length} help={authority ? `${analytics?.summary?.approvedProperties || 0} workflow-reviewed` : `${owned.filter((x) => x.status === 'APPROVED').length} workflow-reviewed`} icon="⌂" tone="mint"/>
      <Stat label={authority ? 'Awaiting review' : 'Transfer activity'} value={authority ? analytics?.summary?.pendingApprovals : pendingTransfers.length} help={authority ? 'Require an authority workflow decision' : 'Open proposals in your inbox'} icon="◌" tone="gold"/>
      <Stat label={authority ? 'Integrity flags' : 'Available history'} value={authority ? analytics?.conflicts?.totalFlags : owned.reduce((n, p) => n + (p.documents?.length || 0), 0)} help={authority ? 'Duplicates or claims to inspect' : 'Documents secured off-chain'} icon="◇" tone="rose"/>
      <Stat label="Ledger entries" value={analytics?.summary?.ledgerBlocks || '—'} help="Tamper-evident event chain" icon="↗" tone="blue"/>
    </section>
    <section className="dashboard-grid"><PropertyTable properties={properties.slice(0, 6)} onSelect={onSelect} allowRegister={['owner', 'seller', 'authority', 'admin'].includes(user.role) ? onRegister : null}/><Activity events={analytics?.recentActivity || []}/></section>
  </>;
}

function Activity({ events }) { return <aside className="panel activity"><div className="panel-head"><div><p className="eyebrow">LEDGER ACTIVITY</p><h2>Recent events</h2></div></div>{events.length ? <ol>{events.map((event) => <li key={`${event.id}-${event.blockHash}`}><span className="timeline-dot"></span><div><b>{titleCase(event.action)}</b><p>{event.entityType} #{event.entityId}</p><small>{dateText(event.timestamp)}</small></div></li>)}</ol> : <Empty title="No ledger entries" text="Actions will appear here."/>}</aside>; }

function PropertyDetail({ property, token, onClose, refresh, toast, user }) {
  const [history, setHistory] = useState([]); const [loading, setLoading] = useState(true); const [reviewing, setReviewing] = useState(false); const [reason, setReason] = useState(''); const [uploading, setUploading] = useState(false);
  const authority = ['authority', 'admin'].includes(user.role);
  useEffect(() => { let active = true; request(`/properties/${property.id}/history`, { token }).then((data) => active && setHistory(data.history)).catch((error) => toast(error.message, 'error')).finally(() => active && setLoading(false)); return () => { active = false; }; }, [property.id, token]);
  async function review(decision) { setReviewing(true); try { const data = await request(`/properties/${property.id}/review`, { token, method: 'POST', body: { decision, reason } }); toast(data.message); refresh(); onClose(); } catch (error) { toast(error.message, 'error'); } finally { setReviewing(false); } }
  async function upload(event) { const file = event.target.files?.[0]; if (!file) return; setUploading(true); const form = new FormData(); form.append('document', file); try { const data = await request(`/properties/${property.id}/documents`, { token, method: 'POST', body: form }); toast(`Document secured with SHA-256 ${shortHash(data.document.sha256)}.`); refresh(); } catch (error) { toast(error.message, 'error'); } finally { setUploading(false); event.target.value = ''; } }
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-top"><div><p className="eyebrow">PARCEL {property.parcelNumber}</p><h2>{property.title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="drawer-section key-grid"><div><span>Claimant (self-reported)</span><b>{property.ownerName}</b></div><div><span>Application workflow</span><Badge value={property.status}/></div><div><span>Land classification</span><b>{property.landType}</b></div><div><span>Area</span><b>{property.areaSqm} sq m</b></div></div><div className="drawer-section"><span className="label">Title / identity boundary</span><p>This record is user-submitted. Claimant identity and statutory legal title are not verified by this prototype. Workflow approval is not a land-registry title decision.</p></div><div className="drawer-section"><span className="label">Self-reported parcel location</span><p>{property.address}</p></div>
    <div className="drawer-section"><div className="split-title"><div><span className="label">Off-chain documents</span><p>SHA-256 fingerprints are written to the ledger.</p></div>{(property.ownerId === user.id || authority) && <label className="upload-button">{uploading ? 'Hashing…' : '+ Add document'}<input type="file" onChange={upload} /></label>}</div>{property.documents?.length ? <div className="documents">{property.documents.map((document) => <div className="document" key={document.id}><span className="doc-icon">▤</span><div><b>{document.fileName}</b><small>SHA-256 {shortHash(document.sha256)} · validation {document.validationStatus || 'REVIEW'} {document.validation?.semanticScore !== undefined ? `· score ${Math.round(document.validation.semanticScore * 100)}%` : ''}</small></div><a href={`${API}/documents/${document.id}/download`} onClick={(event) => { event.preventDefault(); toast('Downloads require the signed API session; use the API route with your token for this prototype.', 'error'); }}>View</a></div>)}</div> : <p className="muted">No document has been uploaded yet.</p>}</div>
    {authority && property.status === 'PENDING' && <div className="review-box"><span className="label">Authority decision</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional review note or rejection reason"/><div><button className="secondary danger" disabled={reviewing} onClick={() => review('REJECTED')}>Reject</button><button className="primary" disabled={reviewing} onClick={() => review('APPROVED')}>{reviewing ? 'Saving…' : 'Approve property'}</button></div></div>}
    <div className="drawer-section history"><span className="label">Tamper-evident history</span>{loading ? <p className="muted">Loading history…</p> : history.length ? <ol>{history.map((event) => <li key={`${event.id}-${event.blockHash}`}><span></span><div><b>{titleCase(event.action)}</b><small>{dateText(event.timestamp)} · block {shortHash(event.blockHash)}</small></div></li>)}</ol> : <p className="muted">No events recorded.</p>}</div>
  </aside></div>;
}

function RegisterModal({ token, close, refresh, toast }) {
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subDistricts, setSubDistricts] = useState([]);
  const [districtMode, setDistrictMode] = useState('select');
  const [subDistrictMode, setSubDistrictMode] = useState('select');
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [form, setForm] = useState({
    parcelNumber: '', title: '', address: '', areaSqm: '', landType: 'Residential',
    stateCode: '', stateName: '', districtName: '', districtSourceLgdCode: '',
    subDistrictName: '', subDistrictSourceLgdCode: ''
  });
  const [file, setFile] = useState(null);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    let active = true;
    request('/abdb/states', { token }).then((result) => active && setStates(result.states || []))
      .catch((error) => active && toast(`Administrative data could not be loaded: ${error.message}`, 'error'));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    let active = true;
    setDistricts([]); setSubDistricts([]);
    if (!form.stateCode) return () => { active = false; };
    setLoadingAdmin(true);
    request(`/abdb/districts?state=${encodeURIComponent(form.stateCode)}`, { token })
      .then((result) => active && setDistricts(result.districts || []))
      .catch((error) => active && toast(error.message, 'error'))
      .finally(() => active && setLoadingAdmin(false));
    return () => { active = false; };
  }, [token, form.stateCode]);

  useEffect(() => {
    let active = true;
    setSubDistricts([]);
    if (!form.stateCode || !form.districtName || districtMode === 'manual') return () => { active = false; };
    request(`/abdb/subdistricts?state=${encodeURIComponent(form.stateCode)}&district=${encodeURIComponent(form.districtName)}&limit=2000`, { token })
      .then((result) => active && setSubDistricts(result.records || []))
      .catch((error) => active && toast(error.message, 'error'));
    return () => { active = false; };
  }, [token, form.stateCode, form.districtName, districtMode]);

  function changeState(event) {
    const stateCode = event.target.value;
    const state = states.find((item) => item.code === stateCode);
    setDistrictMode('select'); setSubDistrictMode('select');
    setForm((current) => ({
      ...current, stateCode, stateName: state?.name || '', districtName: '', districtSourceLgdCode: '',
      subDistrictName: '', subDistrictSourceLgdCode: ''
    }));
  }
  function changeDistrict(event) {
    const value = event.target.value;
    if (value === '__manual__') {
      setDistrictMode('manual'); setSubDistrictMode('manual');
      setForm((current) => ({ ...current, districtName: '', districtSourceLgdCode: '', subDistrictName: '', subDistrictSourceLgdCode: '' }));
      return;
    }
    const district = districts.find((item) => String(item.sourceFeatureId) === value);
    setDistrictMode('select'); setSubDistrictMode('select');
    setForm((current) => ({
      ...current, districtName: district?.districtName || '', districtSourceLgdCode: district?.sourceDistrictLgdCode || '',
      subDistrictName: '', subDistrictSourceLgdCode: ''
    }));
  }
  function changeSubDistrict(event) {
    const value = event.target.value;
    if (value === '__manual__') {
      setSubDistrictMode('manual');
      setForm((current) => ({ ...current, subDistrictName: '', subDistrictSourceLgdCode: '' }));
      return;
    }
    const selected = subDistricts.find((item) => String(item.sourceFeatureId) === value);
    setSubDistrictMode('select');
    setForm((current) => ({
      ...current, subDistrictName: selected?.subDistrictName || '', subDistrictSourceLgdCode: selected?.sourceSubDistrictLgdCode || ''
    }));
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true);
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (file) data.append('document', file);
    try {
      const result = await request('/properties', { token, method: 'POST', body: data });
      toast(result.message); refresh(); close();
    } catch (error) { toast(error.message, 'error'); }
    finally { setBusy(false); }
  }
  const selectedState = states.find((item) => item.code === form.stateCode);
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><p className="eyebrow">NEW SUBMISSION</p><h2>Submit a property claim</h2></div><button type="button" className="icon-button" onClick={close}>×</button></div>
    <p className="muted">This is a self-reported claim for workflow review. It does not prove identity or legal title. The official ABDB hierarchy is used only to match administrative location.</p>
    <div className="form-grid">
      <label className="span-2">State / Union Territory<select value={form.stateCode} onChange={changeState} required><option value="">Select State / UT</option>{states.map((state)=><option key={state.code} value={state.code}>{state.name} ({state.type})</option>)}</select></label>
      <label className="span-2">District
        {districtMode === 'select' ? <select value={districts.find((d)=>d.districtName===form.districtName && String(d.sourceDistrictLgdCode||'')===String(form.districtSourceLgdCode||''))?.sourceFeatureId || ''} onChange={changeDistrict} required disabled={!form.stateCode || loadingAdmin}>
          <option value="">{loadingAdmin ? 'Loading districts…' : 'Select district'}</option>
          {districts.map((district)=><option key={district.sourceFeatureId} value={district.sourceFeatureId}>{district.districtName}{district.sourceDistrictLgdCode ? ` · LGD ${district.sourceDistrictLgdCode}` : ''}</option>)}
          <option value="__manual__">District not listed — enter manually</option>
        </select> : <input value={form.districtName} onChange={set('districtName')} placeholder="Enter district exactly as on source document" required/>}
      </label>
      {form.districtName && districtMode === 'select' && <label className="span-2">Sub-District / Tehsil / Taluk
        {subDistrictMode === 'select' ? <select value={subDistricts.find((item)=>item.subDistrictName===form.subDistrictName && String(item.sourceSubDistrictLgdCode||'')===String(form.subDistrictSourceLgdCode||''))?.sourceFeatureId || ''} onChange={changeSubDistrict}>
          <option value="">Optional — select sub-district</option>
          {subDistricts.map((item)=><option key={item.sourceFeatureId} value={item.sourceFeatureId}>{item.subDistrictName}{item.sourceSubDistrictLgdCode ? ` · LGD ${item.sourceSubDistrictLgdCode}` : ''}</option>)}
          <option value="__manual__">Not listed — enter manually</option>
        </select> : <input value={form.subDistrictName} onChange={set('subDistrictName')} placeholder="Enter sub-district / tehsil name"/>}
      </label>}
      {form.districtName && districtMode === 'manual' && <label className="span-2">Sub-District / Tehsil / Taluk (optional)<input value={form.subDistrictName} onChange={set('subDistrictName')} placeholder="Enter administrative area"/></label>}
      <label>Parcel / Survey number<input value={form.parcelNumber} onChange={set('parcelNumber')} placeholder="Enter identifier exactly as shown on source record" required maxLength="120"/></label>
      <label>Land type<select value={form.landType} onChange={set('landType')}><option>Residential</option><option>Commercial</option><option>Agricultural</option><option>Industrial</option><option>Mixed use</option><option>Other</option></select></label>
      <label className="span-2">Property description<input value={form.title} onChange={set('title')} placeholder="Description shown in supporting record" required maxLength="160"/></label>
      <label className="span-2">Self-reported location / address<textarea value={form.address} onChange={set('address')} placeholder="Survey number, mouza/locality, post office, PIN, town/city" required maxLength="1000"/></label>
      <label>Area in sq m<input type="number" min="0.01" step="0.01" value={form.areaSqm} onChange={set('areaSqm')} required/></label>
      <label>Supporting record <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] || null)}/></label>
    </div>
    {selectedState && <p className="info-note">State/UT matched against the Survey of India administrative reference: {selectedState.name}. ABDB does not contain private ownership or title details. Where the local area is not present in ABDB, the application marks it for manual review.</p>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={busy || !form.stateCode || !form.districtName}>{busy ? 'Securing record…' : 'Submit claim for review'} →</button></div>
  </form></div>;
}

function Transfers({ token, user, transfers, properties, refresh, toast }) {
  const [showForm, setShowForm] = useState(false); const [propertyId, setPropertyId] = useState(''); const [buyerEmail, setBuyerEmail] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  const canCreate = ['owner', 'seller'].includes(user.role); const owned = properties.filter((property) => property.ownerId === user.id && property.status === 'APPROVED');
  async function action(id, action, body = {}) { try { const result = await request(`/transfers/${id}/${action}`, { token, method: 'POST', body }); toast(result.message || `Transfer ${action}ed.`); refresh(); } catch (error) { toast(error.message, 'error'); } }
  async function submit(event) { event.preventDefault(); setBusy(true); try { const result = await request('/transfers', { token, method: 'POST', body: { propertyId, buyerEmail, notes } }); toast(result.message); setShowForm(false); setPropertyId(''); setBuyerEmail(''); setNotes(''); refresh(); } catch (error) { toast(error.message, 'error'); } finally { setBusy(false); } }
  return <><section className="page-heading compact"><div><p className="eyebrow">CLAIMANT WORKFLOW</p><h1>Property transfers</h1><p>Claimant-reference workflows require a seller proposal, buyer acceptance and authority workflow review; they do not perform statutory mutation.</p></div>{canCreate && <button className="primary" onClick={() => setShowForm(true)}>+ Propose transfer</button>}</section><section className="panel transfers-panel">{transfers.length ? <div className="transfer-list">{transfers.map((transfer) => <article className="transfer-card" key={transfer.id}><div className="transfer-main"><div className="transfer-badge">⇄</div><div><div className="transfer-title"><h3>{transfer.property?.title || `Property #${transfer.propertyId}`}</h3><Badge value={transfer.status}/></div><p>{transfer.property?.parcelNumber} · {transfer.property?.address}</p><small>From <b>{transfer.seller?.name || 'Seller'}</b> to <b>{transfer.buyer?.name || 'Buyer'}</b> · initiated {dateText(transfer.createdAt)}</small>{transfer.notes && <blockquote>{transfer.notes}</blockquote>}</div></div><div className="transfer-actions">{transfer.status === 'PROPOSED' && transfer.buyerId === user.id && <button className="primary" onClick={() => action(transfer.id, 'accept')}>Accept</button>}{transfer.status === 'ACCEPTED' && ['authority','admin'].includes(user.role) && <button className="primary" onClick={() => action(transfer.id, 'finalize')}>Validate & finalize</button>}{['PROPOSED','ACCEPTED'].includes(transfer.status) && (transfer.buyerId === user.id || ['authority','admin'].includes(user.role)) && <button className="secondary danger" onClick={() => action(transfer.id, 'reject', { reason: 'Rejected through portal.' })}>Reject</button>}</div></article>)}</div> : <Empty title="No transfers in view" text={canCreate ? 'Choose an approved property to start a controlled transfer.' : 'New transfer proposals addressed to you will appear here.'}/>}</section>
  {showForm && <div className="modal-backdrop"><form className="modal transfer-form" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">NEW WORKFLOW</p><h2>Propose transfer</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}>×</button></div><label>Verified property<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} required><option value="">Select a workflow-reviewed claim</option>{owned.map((property) => <option key={property.id} value={property.id}>{property.parcelNumber} — {property.title}</option>)}</select></label><label>Registered buyer email<input type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} placeholder="buyer@example.in" required/></label><label>Transfer note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional reference or note for the authority"/></label><p className="info-note">The buyer must accept before an authority can finalise this application's workflow state. This does not update the government title register or establish legal ownership.</p><div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Send to buyer'} →</button></div></form></div>}</>;
}

function Authority({ token, properties, analytics, refresh, toast, onSelect }) {
  const pending = properties.filter((property) => property.status === 'PENDING'); const [integrity, setIntegrity] = useState(analytics?.integrity);
  async function verify() { try { const data = await request('/ledger/verify', { token }); setIntegrity(data); toast(data.valid ? `Ledger verified: ${data.checkedBlocks} blocks are intact.` : 'Ledger verification found an issue.', data.valid ? '' : 'error'); } catch (error) { toast(error.message, 'error'); } }
  return <><section className="page-heading compact"><div><p className="eyebrow">AUTHORIZED AUTHORITY PORTAL</p><h1>Review & integrity control</h1><p>Review self-submitted claims, investigate screening signals, and maintain the prototype audit chain.</p></div><button className="secondary" onClick={verify}>⌁ Verify ledger</button></section><section className="authority-top"><div className="panel integrity-card"><span className={integrity?.valid ? 'big-check healthy' : 'big-check'}>{integrity?.valid ? '✓' : '!'}</span><div><p className="eyebrow">TAMPER CHECK</p><h2>{integrity?.valid ? 'Ledger integrity intact' : 'Verification required'}</h2><p>{integrity?.valid ? `${integrity.checkedBlocks} linked blocks recomputed successfully.` : 'Run a verification to inspect the mock ledger chain.'}</p></div></div><div className="panel flag-card"><span className="flag-count">{analytics?.conflicts?.totalFlags ?? '—'}</span><div><p className="eyebrow">REVIEW SIGNALS</p><h2>Conflict monitor</h2><p>Duplicate parcels, active conflicting claimant claims, and repeated document fingerprints.</p></div></div></section><section className="authority-grid"><section className="panel"><div className="panel-head"><div><p className="eyebrow">PENDING CLAIMS</p><h2>Awaiting your decision</h2></div><span className="count-chip">{pending.length}</span></div>{pending.length ? <div className="review-list">{pending.map((property) => <button key={property.id} onClick={() => onSelect(property)}><span>⌂</span><div><b>{property.title}</b><small>{property.parcelNumber} · submitted by {property.ownerName}</small></div><Badge value="PENDING"/><i>→</i></button>)}</div> : <Empty title="All caught up" text="There are no pending property claims."/>}</section><section className="panel conflict-panel"><div className="panel-head"><div><p className="eyebrow">ANALYTICS FLAGS</p><h2>Potential conflicts</h2></div></div><ConflictGroup title="Duplicate parcel references" flags={analytics?.conflicts?.duplicateParcels} render={(item) => `${item.parcelNumber} · ${item.propertyIds.length} records`}/><ConflictGroup title="Multiple active owners" flags={analytics?.conflicts?.conflictingOwnership} render={(item) => `${item.parcelNumber} · ${item.ownerNames.join(', ')}`}/><ConflictGroup title="Repeated document hashes" flags={analytics?.conflicts?.duplicateDocuments} render={(item) => `${shortHash(item.sha256)} · ${item.propertyIds.length} properties`}/></section></section></>;
}

function ConflictGroup({ title, flags = [], render }) { return <div className="conflict-group"><span>{title}</span>{flags.length ? flags.map((item, index) => <div className="conflict-item" key={`${title}-${index}`}><i>!</i><p>{render(item)}</p></div>) : <p className="clear-item">No flags detected.</p>}</div>; }


function DataSources({ token, user }) {
  const [data, setData] = useState(null);
  const [stateData, setStateData] = useState(null);
  const [abdb, setAbdb] = useState(null);
  const [governmentSummary, setGovernmentSummary] = useState(null);
  const [enrichment, setEnrichment] = useState(null);
  const [parcelAccess, setParcelAccess] = useState(null);
  const [parcelEvidence, setParcelEvidence] = useState(null);
  const [parcelQuery, setParcelQuery] = useState({ stateCode: 'MP', district: '', village: '', primaryIdentifier: '', consentReference: '' });
  const [parcelLookup, setParcelLookup] = useState(null);
  const [parcelBusy, setParcelBusy] = useState(false);
  const [parcelError, setParcelError] = useState('');
  const [iprAccess, setIprAccess] = useState(null);
  const [iprPlaceQuery, setIprPlaceQuery] = useState('');
  const [iprPlaces, setIprPlaces] = useState(null);
  const [iprCoverageState, setIprCoverageState] = useState('19');
  const [iprCoverage, setIprCoverage] = useState(null);
  const [iprVillageLgd, setIprVillageLgd] = useState('');
  const [iprPlotNumber, setIprPlotNumber] = useState('');
  const [iprMatches, setIprMatches] = useState(null);
  const [iprDetail, setIprDetail] = useState(null);
  const [iprBusy, setIprBusy] = useState(false);
  const [iprError, setIprError] = useState('');
  const [acquisitionState, setAcquisitionState] = useState('WB');
  const [acquisitionDiscovery, setAcquisitionDiscovery] = useState(null);
  const [acquisitionDiscoveryBusy, setAcquisitionDiscoveryBusy] = useState(false);
  const [acquisitionDocument, setAcquisitionDocument] = useState(null);
  const [stateQuery, setStateQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { let active = true; Promise.all([
    request('/data-sources', { token }),
    request('/real-data?limit=200', { token }),
    request('/real-data/state-level', { token }),
    request('/abdb/status', { token }),
    request('/government-data/summary', { token }),
    request('/data-enrichment', { token }),
    request('/federated-land-records/status', { token }),
    request('/government-data/parcels?limit=100&offset=0', { token }),
    request('/third-party-land-records/status', { token })
  ]).then(([meta, rows, states, abdbStatus, governmentStatus, enriched, parcelStatus, parcelRows, iprStatus]) => active && (setData({ ...meta, records: rows.records }), setStateData(states), setAbdb(abdbStatus), setGovernmentSummary(governmentStatus), setEnrichment(enriched), setParcelAccess(parcelStatus), setParcelEvidence(parcelRows), setIprAccess(iprStatus)))
    .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [token]);
  if (error) return <section className="panel"><div className="form-error">{error}</div></section>;
  if (!data || !stateData || !abdb || !governmentSummary || !enrichment || !parcelAccess || !parcelEvidence || !iprAccess) return <section className="panel"><div className="empty"><strong>Loading official government data layers…</strong></div></section>;
  const source = data.source || {};
  const safeRecords = Array.isArray(data.records) ? data.records : [];
  const safeStates = Array.isArray(stateData.records) ? stateData.records : [];
  const national = stateData.nationalTotals || {};
  const acq = enrichment.acquisition?.metrics || {};
  const selectedAcquisitionState = (enrichment.acquisition?.stateRows || []).find((row) => row.stateCode === acquisitionState) || (enrichment.acquisition?.stateRows || [])[0];
  const filteredStates = safeStates.filter((r) => `${r.state} ${r.lgdCode}`.toLowerCase().includes(stateQuery.toLowerCase()));
  const portalRows = (enrichment.portalDirectory?.rows || []).filter((r) => `${r.state} ${r.stateCode} ${r.portalName || ''}`.toLowerCase().includes(stateQuery.toLowerCase()));
  const number = (value) => value == null ? '—' : Number(value).toLocaleString('en-IN');
  const refreshEnrichment = async () => { const fresh = await request('/data-enrichment', { token }); setEnrichment(fresh); };
  const refreshParcelEvidence = async () => { const fresh = await request('/government-data/parcels?limit=100&offset=0', { token }); setParcelEvidence(fresh); };
  const discoverAcquisitionSources = async () => { setAcquisitionDiscoveryBusy(true); try { const result = await request('/land-acquisition/discover', { token, method: 'POST', body: {} }); setAcquisitionDiscovery(result); alert(`Official source discovery: ${result.fetchedCount}/${result.sourceCount} fetched; ${result.candidateCount} review candidates. These are not verified acquisition facts.`); } catch (e) { alert(e.message); } finally { setAcquisitionDiscoveryBusy(false); } };
  const extractAcquisitionDocument = () => { const sourceUrl = window.prompt('Paste the official government/NIC URL for the exact award/notification PDF:'); if (!sourceUrl) return; const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.pdf,.png,.jpg,.jpeg,.txt'; picker.onchange = async () => { const file = picker.files?.[0]; if (!file) return; const body = new FormData(); body.append('sourceUrl', sourceUrl); body.append('sourceDocument', file); try { const result = await request('/land-acquisition/extract', { token, method: 'POST', body }); setAcquisitionDocument(result); alert(`Extracted ${result.acquisitionReferences.length} references, ${result.parcelIdentifiers.length} parcel IDs and ${result.areaCandidates.length} area candidates. Authority review is required before import.`); } catch (e) { alert(e.message); } }; picker.click(); };
  const checkIprCoverage = async () => { setIprBusy(true); setIprError(''); setIprCoverage(null); try { const result = await request(`/third-party-land-records/coverage?stateLgd=${encodeURIComponent(iprCoverageState)}`, { token }); setIprCoverage(result); } catch (e) { setIprError(e.message); } finally { setIprBusy(false); } };
  const searchIprPlaces = async (event) => { event.preventDefault(); setIprBusy(true); setIprError(''); setIprPlaces(null); try { const result = await request(`/third-party-land-records/places?q=${encodeURIComponent(iprPlaceQuery)}`, { token }); setIprPlaces(result); } catch (e) { setIprError(e.message); } finally { setIprBusy(false); } };
  const searchIprPlot = async (event) => { event.preventDefault(); setIprBusy(true); setIprError(''); setIprMatches(null); setIprDetail(null); try { const params = new URLSearchParams({ villageLgd: iprVillageLgd, plot: iprPlotNumber }); const result = await request(`/third-party-land-records/plots?${params}`, { token }); setIprMatches(result); } catch (e) { setIprError(e.message); } finally { setIprBusy(false); } };
  const loadIprDetail = async (iprId) => { setIprBusy(true); setIprError(''); setIprDetail(null); try { const result = await request(`/third-party-land-records/plots/${encodeURIComponent(iprId)}`, { token }); setIprDetail(result); } catch (e) { setIprError(e.message); } finally { setIprBusy(false); } };
  const submitParcelLookup = async (event) => { event.preventDefault(); setParcelBusy(true); setParcelError(''); setParcelLookup(null); try { const result = await request('/federated-land-records/query', { token, method: 'POST', body: parcelQuery }); setParcelLookup(result); } catch (e) { setParcelError(e.message); } finally { setParcelBusy(false); } };
  const pollParcelLookup = async () => { if (!parcelLookup?.requestId) return; setParcelBusy(true); setParcelError(''); try { const params = new URLSearchParams({ consentReference: parcelQuery.consentReference }); const result = await request(`/federated-land-records/requests/${encodeURIComponent(parcelLookup.requestId)}?${params}`, { token }); setParcelLookup((current) => ({ ...current, latest: result })); } catch (e) { setParcelError(e.message); } finally { setParcelBusy(false); } };
  const verifyParcelRow = async (row) => { const verificationReference = window.prompt('Enter the exact reference/number on the official RoR or source order:'); if (!verificationReference) return; const verificationSourceUrl = window.prompt('Enter HTTPS official government URL for the source record/document:', row.sourceDocumentUrl || row.sourceUrl); if (!verificationSourceUrl) return; const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.pdf,.png,.jpg,.jpeg,.txt'; picker.onchange = async () => { const file = picker.files?.[0]; if (!file) return; const body = new FormData(); body.append('verificationMethod', 'OFFICIAL_SOURCE_RECORD_REVIEW'); body.append('verificationReference', verificationReference); body.append('verificationSourceUrl', verificationSourceUrl); body.append('sourceDocument', file); try { const result = await request(`/parcel-evidence/${encodeURIComponent(row.recordKey)}/verify`, { token, method: 'POST', body }); alert(result.notice); await refreshParcelEvidence(); } catch (e) { alert(e.message); } }; picker.click(); };
  const importSourceFile = async (endpoint, event) => { const file = event.target.files?.[0]; if (!file) return; const body = new FormData(); body.append('file', file); try { const result = await request(endpoint, { token, method: 'POST', body }); alert(`Import completed: ${result.inserted} inserted, ${result.duplicates} duplicates.`); await refreshEnrichment(); if (endpoint.includes('parcel-evidence')) await refreshParcelEvidence(); } catch (e) { alert(e.message); } finally { event.target.value = ''; } };
  const refreshMap = async () => { try { const result = await request('/map-digitization/refresh', { token, method: 'POST' }); setEnrichment((current) => ({ ...current, mapDigitization: { ...current.mapDigitization, currentSnapshot: result } })); alert(`DILRMP Map Digitization refreshed: ${result.coverage?.stateRows || 0}/36 states.`); } catch (e) { alert(e.message); } };
  return <>
    <section className="page-heading compact"><div><p className="eyebrow">OFFICIAL DATA / PROVENANCE</p><h1>India land-administration data</h1><p>Government aggregate indicators and administrative boundary reference data are separated from user-submitted property claims.</p></div><span className="status-pill ok">Official public sources</span></section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">ON-DEMAND PARCEL / HOLDER LOOKUP</p><h2>India Property Register connector</h2></div><span className={`status-pill ${iprAccess.enabled ? 'ok' : 'warn'}`}>{iprAccess.enabled ? 'API key configured' : 'API key required'}</span></div>
      <p className="muted">Independent third-party aggregator of published State land records—not a government database. Its documentation reports plot coverage in 28 of 36 jurisdictions, with depth varying by record type. This connector makes one parcel lookup at a time and does not bulk-download or store provider responses.</p>
      <div className="source-meta"><div><span>Provider-reported parcel coverage</span><b>28/36 State/UT</b></div><div><span>Provider-reported scale</span><b>Claim; check live coverage</b></div><div><span>Personal records bundled here</span><b>0</b></div><div><span>Persistence</span><b>Disabled</b></div></div>
      {['authority','admin'].includes(user.role) ? <>
        <div className="form-grid" style={{marginTop:16}}><label>Check this State/UT's provider coverage<select value={iprCoverageState} onChange={(e)=>setIprCoverageState(e.target.value)}>{safeStates.map((st)=><option key={st.stateCode} value={st.lgdCode}>{st.state} — LGD {st.lgdCode}</option>)}</select></label><div className="form-actions"><button type="button" className="secondary" onClick={checkIprCoverage} disabled={!iprAccess.enabled || iprBusy}>Check provider coverage</button></div></div>
        {iprCoverage && <><p className="info-note">Provider coverage response for LGD {iprCoverage.stateLgd} was checked at {dateText(iprCoverage.checkedAt)}. Check its per-layer last-run date before using a record.</p><pre className="data-result">{JSON.stringify(iprCoverage.coverage,null,2)}</pre></>}
        <form className="form-grid" style={{marginTop:16}} onSubmit={searchIprPlaces}>
          <label>Find the revenue village / place<input value={iprPlaceQuery} onChange={(e)=>setIprPlaceQuery(e.target.value)} maxLength="120" required placeholder="Village, town or pincode"/></label>
          <div className="form-actions"><button className="secondary" disabled={!iprAccess.enabled || iprBusy}>Find village LGD code</button></div>
        </form>
        {iprPlaces && <div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Village / place</th><th>District</th><th>State</th><th>LGD</th><th></th></tr></thead><tbody>{(iprPlaces.villages || []).map((v,i)=><tr key={`${v.lgd || v.code || i}`}><td>{v.name || v.village || '—'}</td><td>{v.district?.name || v.district || '—'}</td><td>{v.state?.name || v.state || '—'}</td><td>{v.lgd || v.lgd_code || '—'}</td><td><button className="secondary" onClick={()=>setIprVillageLgd(String(v.lgd || v.lgd_code || ''))}>Use this village</button></td></tr>)}</tbody></table></div>}
        <form className="form-grid" style={{marginTop:16}} onSubmit={searchIprPlot}>
          <label>Village LGD code<input inputMode="numeric" value={iprVillageLgd} onChange={(e)=>setIprVillageLgd(e.target.value)} maxLength="12" required placeholder="Numeric village LGD code"/></label>
          <label>Exact survey / khasra / khata / dag / plot number<input value={iprPlotNumber} onChange={(e)=>setIprPlotNumber(e.target.value)} maxLength="80" required placeholder="As printed on the source record"/></label>
          <div className="form-actions"><button className="primary" disabled={!iprAccess.enabled || iprBusy}>{iprBusy ? 'Searching…' : 'Find parcel'}</button></div>
        </form>
        {iprMatches?.matches?.length > 0 && <div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Plot number</th><th>IPR ID</th><th>Area (sq m)</th><th>Holder count</th><th></th></tr></thead><tbody>{iprMatches.matches.map((m)=><tr key={m.ipr_id}><td>{m.plot_no || '—'}</td><td>{m.ipr_id}</td><td>{m.area_sqm == null ? '—' : number(m.area_sqm)}</td><td>{m.holders == null ? '—' : m.holders}</td><td><button className="secondary" onClick={()=>loadIprDetail(m.ipr_id)}>View published record</button></td></tr>)}</tbody></table></div>}
        {iprMatches && !iprMatches.matches?.length && <p className="info-note">No exact match returned. Check the LGD village code and identifier; related subdivisions, if any, are shown separately below.</p>}
        {iprMatches?.related?.length > 0 && <p className="info-note">Related plot subdivisions: {iprMatches.related.map((r)=>r.plot_no || r.ipr_id).join(', ')}. Choose and verify the precise subdivision before opening a full record.</p>}
        {iprDetail && <><p className="info-note">Provider record read date: {iprDetail.readOn || 'Not supplied'} · Underlying source: {iprDetail.sourceUrl ? <a href={iprDetail.sourceUrl} target="_blank" rel="noreferrer">Open cited source ↗</a> : 'Not supplied'}. The holder array is reproduced from the provider response; compare it with certified source records before relying on it.</p><pre className="data-result">{JSON.stringify(iprDetail.record,null,2)}</pre></>}
      </> : <p className="info-note">Only authority/admin users can initiate lookups that may return holder names.</p>}
      {iprError && <p className="form-error">{iprError}</p>}
      {!iprAccess.enabled && <p className="info-note">Connector not configured. Create an account at <a href="https://indiapropertyregister.com/signup" target="_blank" rel="noreferrer">India Property Register</a>, then set <code>IPR_API_KEY</code> on the server. Their documentation lists ₹0.40 per successful API call; a search and full detail fetch may cost two calls. Never place the key in frontend code.</p>}
      <div className="source-meta" style={{marginTop:12}}><div><span>API documentation</span><b><a href={iprAccess.documentation} target="_blank" rel="noreferrer">Open API docs ↗</a></b></div><div><span>Provider terms</span><b><a href={iprAccess.terms} target="_blank" rel="noreferrer">Read terms ↗</a></b></div><div><span>Government source programme</span><b><a href="https://dilrmp.gov.in/" target="_blank" rel="noreferrer">DILRMP ↗</a></b></div></div>
      <p className="info-note">The provider states that records are not certified copies or proof of title. Its terms restrict bulk scraping, redistribution/resale, competing databases and AI training/evaluation without written licence. This project performs on-demand lookups only and does not automatically persist returned names.</p>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">FEDERATED OWNER / PARCEL VERIFICATION</p><h2>Government-backed single-parcel lookup</h2></div><span className={`status-pill ${parcelAccess.configured ? 'ok' : 'warn'}`}>{parcelAccess.configured ? 'Credentials configured' : 'External onboarding required'}</span></div>
      <p className="muted">This is an on-demand query through RBIH's Unified Lending Interface (ULI) Next-Gen Land Records Service. It is not a bulk owner database. The documented Next-Gen provider currently covers 12 State backends; RBIH requires institutional onboarding, a service subscription, IP whitelisting, credentials and a purpose-specific consent reference.</p>
      <div className="source-meta"><div><span>Next-Gen supported States</span><b>{parcelAccess.nextGenStateCount}/36</b></div><div><span>Separate LRS v3 guide</span><b>{parcelAccess.v3GuideStateCount} States</b></div><div><span>Bundled personal-owner rows</span><b>{parcelAccess.personLevelRowsBundled}</b></div><div><span>Bulk owner export</span><b>No</b></div></div>
      {['authority','admin'].includes(user.role) ? <form className="form-grid" style={{marginTop:16}} onSubmit={submitParcelLookup}>
        <label>State with documented LRS support<select value={parcelQuery.stateCode} onChange={(e)=>setParcelQuery((v)=>({...v,stateCode:e.target.value,primaryIdentifier:''}))}>{parcelAccess.supportedNextGenStates.map((r)=><option key={r.stateCode} value={r.stateCode}>{r.stateName} — {r.primaryIdentifierLabel}</option>)}</select></label>
        <label>District<input value={parcelQuery.district} onChange={(e)=>setParcelQuery((v)=>({...v,district:e.target.value}))} maxLength="180" required placeholder="District name"/></label>
        <label>Village<input value={parcelQuery.village} onChange={(e)=>setParcelQuery((v)=>({...v,village:e.target.value}))} maxLength="180" required placeholder="Village / revenue village"/></label>
        <label>{parcelAccess.supportedNextGenStates.find((r)=>r.stateCode===parcelQuery.stateCode)?.primaryIdentifierLabel || 'Parcel identifier'}<input value={parcelQuery.primaryIdentifier} onChange={(e)=>setParcelQuery((v)=>({...v,primaryIdentifier:e.target.value}))} maxLength="120" required placeholder="Enter the exact identifier from the land record"/></label>
        <label>Consent artefact / reference<input value={parcelQuery.consentReference} onChange={(e)=>setParcelQuery((v)=>({...v,consentReference:e.target.value}))} maxLength="200" required placeholder="Authorised lender/customer consent reference"/></label>
        <div className="form-actions"><button className="primary" disabled={parcelBusy || !parcelAccess.configured}>{parcelBusy ? 'Submitting…' : 'Query official source'} →</button></div>
      </form> : <p className="info-note">Only authority/admin users may submit person-level lookups in this prototype. This prevents the application from becoming a public owner-name harvesting interface.</p>}
      {parcelError && <p className="form-error">{parcelError}</p>}
      {!parcelAccess.configured && <p className="info-note">Connector is currently not configured. You must have approved RBIH/ULI access; enter the subscribed API base URL, Client ID and JWT only in the server environment. No API keys are embedded in this ZIP. A student/demo account alone does not grant lender API access.</p>}
      {parcelLookup && <div className="source-meta" style={{marginTop:16}}><div><span>RBIH request ID</span><b>{parcelLookup.requestId}</b></div><div><span>Remote status</span><b>{parcelLookup.latest?.status || parcelLookup.remoteStatus}</b></div><div><span>State</span><b>{parcelLookup.stateName}</b></div><div><span>Identifier</span><b>{parcelQuery.primaryIdentifier}</b></div></div>}
      {parcelLookup?.requestId && <div className="form-actions" style={{marginTop:12}}><button className="secondary" onClick={pollParcelLookup} disabled={parcelBusy}>↻ Check source response</button></div>}
      {parcelLookup?.latest?.result && <><p className="info-note">Source returned a record. Review the fields against the signed/official State RoR. Capturing an API response does not itself establish legal title.</p><pre className="data-result">{JSON.stringify(parcelLookup.latest.result,null,2)}</pre></>}
      {parcelLookup?.latest?.error && <p className="form-error">{parcelLookup.latest.error.message || 'The State provider did not complete this lookup.'}</p>}
      <div className="source-meta" style={{marginTop:12}}><div><span>API documentation</span><b><a href={parcelAccess.documentation} target="_blank" rel="noreferrer">RBIH Next-Gen LRS ↗</a></b></div><div><span>State-specific LRS integration guide</span><b><a href={parcelAccess.integrationGuide} target="_blank" rel="noreferrer">RBIH LRS v3 ↗</a></b></div><div><span>All-India programme framework</span><b><a href="https://dolr.gov.in/en/document-category/program-dilrmp/" target="_blank" rel="noreferrer">DILRMP 3.0 ↗</a></b></div></div>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">SOURCE-BACKED PARCEL / HOLDER EVIDENCE</p><h2>Imported owner-to-parcel relationships</h2></div><span className="count-chip">{parcelEvidence.count || 0} rows</span></div>
      <p className="muted">Owner names are visible only to authority/admin users. Imported records remain unverified until an authority reviews the official source document and records its SHA-256. Even then the status means “matches the reviewed source record”, not legal title certification.</p>
      {['authority','admin'].includes(user.role) && <div className="form-grid" style={{marginTop:12}}><label>Import official RoR / authorised parcel extract (CSV/JSON)<input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e)=>importSourceFile('/parcel-evidence/import',e)}/></label><p className="muted">Use the supplied <code>server/data/parcel_ownership_import_template.csv</code>. Include only the minimum fields, record reference, official source URL, retrieval timestamp and documented access basis. No Aadhaar/PAN/phone/email data.</p></div>}
      {(parcelEvidence.records || []).length ? <div className="table-wrap"><table><thead><tr><th>State / parcel</th><th>Source record</th><th>Source holder</th><th>Evidence status</th><th>Source</th><th></th></tr></thead><tbody>{parcelEvidence.records.map((row)=><tr key={row.recordKey}><td><b>{row.stateName} · {row.parcelIdentifier}</b><small>{row.district} · {row.villageOrMouza} · {row.khatianOrRecordNumber || 'No khatian/record number'}</small></td><td>{row.sourceRecordId}<small>{row.recordDate || row.retrievedAt || ''}</small></td><td>{Array.isArray(row.ownerNames) ? row.ownerNames.join(', ') : row.ownerIdentity}</td><td>{titleCase(row.verificationStatus)}<small>{titleCase(row.ownerParcelMatchStatus || 'Not captured')}</small></td><td><a href={row.sourceUrl} target="_blank" rel="noreferrer">Official record ↗</a></td><td>{['authority','admin'].includes(user.role) && row.verificationStatus !== 'AUTHORITY_VERIFIED_SOURCE_RECORD' && <button className="secondary" onClick={()=>verifyParcelRow(row)}>Review & verify</button>}</td></tr>)}</tbody></table></div> : <Empty title="No person-level parcel evidence imported" text="This is intentionally blank until a lawful source record or authorised API response is captured. No demo owner or parcel rows are inserted."/>}
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">DEPARTMENT OF LAND RESOURCES / LACRRIS</p><h2>National land acquisition dashboard</h2></div><a href="https://larr.dolr.gov.in/faces/common/dashboard.xhtml" target="_blank" rel="noreferrer">Open official dashboard ↗</a></div>
      <p className="muted">LACRRIS national dashboard snapshot observed 14-Nov-2026. The portal says State Governments/UT Administrations and DoLR update entries, but the captured dashboard does not expose a single national as-of timestamp; verify again before operational or legal reliance.</p>
      <div className="stats-grid">
        <Stat label="Projects" value={number(acq.projects)} help={`${number(acq.projectSegments)} project segments`} icon="▤" tone="mint"/>
        <Stat label="Area acquired" value={`${number(acq.areaAcquiredHectare)} ha`} help="LACRRIS national snapshot" icon="▦" tone="blue"/>
        <Stat label="Compensation" value={`₹${number(acq.compensationAmountInr)}`} help="LACRRIS national snapshot" icon="₹" tone="gold"/>
        <Stat label="R&R amount" value={`₹${number(acq.rehabilitationResettlementAmountInr)}`} help="LACRRIS national snapshot" icon="⌂" tone="rose"/>
      </div>
      <div className="source-meta"><div><span>Displaced families</span><b>{number(acq.projectDisplacedFamilies)}</b></div><div><span>Affected families</span><b>{number(acq.projectAffectedFamilies)}</b></div><div><span>State/UT selector</span><b>{enrichment.acquisition?.coverageByState?.length || 36}/36</b></div><div><span>Bundled detailed cases</span><b>{number(enrichment.acquisition?.records?.length || 0)}</b></div></div>
      <div className="form-grid" style={{marginTop:16}}><label>Choose State / UT<select value={acquisitionState} onChange={(e)=>setAcquisitionState(e.target.value)}>{safeStates.map((r)=><option key={r.stateCode} value={r.stateCode}>{r.state}</option>)}</select></label><div><label>Official state-wise report</label><p><a href="https://larr.dolr.gov.in/faces/public/rptLandAcqProg2.xhtml" target="_blank" rel="noreferrer">Open LACRRIS State/UT report ↗</a> · Select <b>{selectedAcquisitionState?.state || 'a State/UT'}</b> in the portal, then choose project/district filters.</p></div></div>
      <p className="info-note">Important: the State/UT report is interactive and requires a State selection. The rows below are report-availability states, not measured acquisitions. Missing state values remain null—not zero—and the nationwide totals are never divided across States/UTs. Detailed fields include project, Act, land-requiring body, district, rural/urban, land extent, SIA/notification/award/payment/possession milestones, affected/displaced families and compensation/R&amp;R.</p>
      {['authority','admin'].includes(user.role) && <div className="form-grid" style={{marginTop:16}}><div><b>Official source discovery</b><p className="muted">Scan up to eight allowlisted government acquisition index pages for notice/award/SIA candidates.</p><button type="button" className="secondary" onClick={discoverAcquisitionSources} disabled={acquisitionDiscoveryBusy}>{acquisitionDiscoveryBusy ? 'Scanning official indexes…' : 'Scan official acquisition indexes'}</button></div><div><b>Extract an award / notification</b><p className="muted">Upload the exact government document; extraction returns candidates and does not auto-import or mark an award paid/possessed.</p><button type="button" className="secondary" onClick={extractAcquisitionDocument}>Inspect acquisition PDF / scan</button></div></div>}
      {acquisitionDiscovery && <p className="info-note"><b>Last discovery run:</b> {acquisitionDiscovery.fetchedCount}/{acquisitionDiscovery.sourceCount} fetched · {acquisitionDiscovery.candidateCount} review candidates · {acquisitionDiscovery.skippedSourceCount || 0} sources deferred. {acquisitionDiscovery.results?.filter((r)=>r.status !== 'FETCHED').map((r)=>`${r.sourceId}: ${r.status}`).join(' · ')}</p>}
      {acquisitionDocument && <div className="info-note"><b>Document extraction:</b> {acquisitionDocument.extractionMethod} · SHA-256 {acquisitionDocument.sourceSha256}<div>Parcel candidates: {acquisitionDocument.parcelIdentifiers.join(', ') || 'None detected'} · Area candidates: {acquisitionDocument.areaCandidates.join(', ') || 'None detected'} · References: {acquisitionDocument.acquisitionReferences.join(', ') || 'None detected'}</div><small>These are extraction candidates only. Compare with the complete official order before importing.</small></div>}
      {(enrichment.acquisition?.records || []).filter((r)=>r.stateCode === acquisitionState).length > 0 && <><h3 style={{marginTop:20}}>Source-reviewed award records for {selectedAcquisitionState?.state || acquisitionState}</h3><div className="table-wrap"><table><thead><tr><th>Village / award</th><th>Stage</th><th>Extent as published</th><th>Award amount</th><th>Parcel IDs captured</th><th>Title / possession caveat</th><th>Source PDF</th></tr></thead><tbody>{(enrichment.acquisition.records || []).filter((r)=>r.stateCode === acquisitionState).map((r)=><tr key={r.recordKey}><td><b>{r.sourceReference}</b><small>{r.district} · {r.projectName}</small></td><td>{titleCase(r.acquisitionStage)}<small>{r.awardDate || 'Award date not captured'}</small></td><td>{r.landExtentAsPublished || 'Not published'}<small>{r.landExtentUnitAsPublished || ''}</small></td><td>{r.compensationAmountInr == null ? '—' : `₹${number(r.compensationAmountInr)}`}<small>{r.compensationStatus || 'Not captured'}</small></td><td>{(r.parcelIdentifiers || []).slice(0,12).join(', ')}{(r.parcelIdentifiers || []).length > 12 ? ` +${r.parcelIdentifiers.length - 12} more` : ''}<small>{r.parcelIdentifierCoverage || ''}</small></td><td>{r.possessionStatusNote || r.titleStatusNote || 'No later milestone inferred'}<small>{r.sourceDataQualityNotes || ''}</small></td><td>{r.sourceDocumentUrl ? <a href={r.sourceDocumentUrl} target="_blank" rel="noreferrer">Open award PDF ↗</a> : 'No PDF'}</td></tr>)}</tbody></table></div><p className="info-note">These two selected Delhi records are document-derived award evidence, not current RoR/title records. Award amount is not confirmed payment; the Bamnoli record specifically says possession/title cannot change for land under status quo.</p></>}
      <p className="info-note">The public LACRRIS dashboard does not expose a universal cadastral plot/khasra/dag identifier in its published column set. The two Delhi award PDFs add selected acquisition khasra identifiers, but do not complete nationwide acquired/not-acquired parcel status or current title.</p>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">LACRRIS / STATE-WISE REPORT STATUS</p><h2>Land acquisition coverage by State / UT</h2></div><a href="https://larr.dolr.gov.in/faces/public/rptLandAcqProg2.xhtml" target="_blank" rel="noreferrer">Open LACRRIS report ↗</a></div>
      <p className="muted">Every State/UT is listed in the government report selector. State-specific amounts are populated only after importing that State's selected official report; null means not ingested, not zero.</p>
      <label className="search-field">Filter State / UT<input type="search" value={stateQuery} onChange={(e)=>setStateQuery(e.target.value)} placeholder="Search State/UT, LGD code or portal"/></label>
      <div className="table-wrap"><table><thead><tr><th>State / UT</th><th>Report status</th><th>Imported rows</th><th>Acquired area</th><th>Compensation</th><th>Official report</th></tr></thead><tbody>{(enrichment.acquisition?.stateRows || []).filter((r)=>!stateQuery || `${r.state} ${r.stateCode}`.toLowerCase().includes(stateQuery.toLowerCase())).map((r)=><tr key={r.stateCode}><td><b>{r.state}</b><small>{r.stateCode} · LGD {r.lgdCode}</small></td><td>{r.status === 'partial_import_official_rows' ? 'Partial source import' : 'Selection required / not imported'}</td><td>{number(r.importedRecordCount || 0)}</td><td>{number(r.areaAcquiredHectare)}</td><td>{r.compensationAmountInr == null ? '—' : `₹${number(r.compensationAmountInr)}`}</td><td><a href={r.reportUrl} target="_blank" rel="noreferrer">Select State ↗</a></td></tr>)}</tbody></table></div>
      <p className="info-note">The {enrichment.acquisition?.notices?.length || 0} bundled notice references below are not a complete inventory. Numeric parcel area or compensation remains blank unless visible in the official page/document. A notice or SIA is not proof that possession has occurred.</p>
      <div className="table-wrap"><table><thead><tr><th>State / District</th><th>Project / notice</th><th>Type / date</th><th>Area</th><th>Compensation</th><th>Official source</th></tr></thead><tbody>{(enrichment.acquisition?.notices || []).map((r)=><tr key={r.recordId}><td><b>{r.state}</b><small>{r.district || 'District not specified'}</small></td><td>{r.projectName}<small>{r.sourceReference}</small></td><td>{titleCase(r.recordType)}<small>{r.documentDate || 'Date not captured'}</small></td><td>{r.landExtentAsPublished || (r.landExtentHectare == null ? '—' : `${number(r.landExtentHectare)} ha`)}</td><td>{r.compensationAmountInr == null ? '—' : `₹${number(r.compensationAmountInr)}`}</td><td><a href={r.sourceUrl} target="_blank" rel="noreferrer">Open government notice ↗</a></td></tr>)}</tbody></table></div>
      {['authority','admin'].includes(user.role) && <div className="form-grid" style={{marginTop:16}}><label>Import selected State LACRRIS CSV/JSON<input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e)=>importSourceFile('/land-acquisition/import',e)}/></label><p className="muted">Authority/admin only. Import rows from the selected official report with source URL, district, project and source reference. The importer rejects personal owner/contact fields and deduplicates source records.</p></div>}
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">STATE / UT REVENUE PORTALS</p><h2>Owner and parcel record access directory</h2></div><span className="count-chip">{enrichment.portalDirectory?.jurisdictions || 36} jurisdictions</span></div>
      <p className="muted">Verified government access points and scope notes. These links support lawful parcel-specific lookups; a portal URL does not imply an open bulk API or authority to scrape every person's records.</p>
      <div className="source-meta"><div><span>Portal/source URLs</span><b>{enrichment.portalDirectory?.urls ?? '—'} / 36</b></div><div><span>Open bulk APIs verified</span><b>{enrichment.portalDirectory?.openBulkApisVerified ?? 0}</b></div><div><span>Owner-by-owner rows bundled</span><b>{enrichment.portalDirectory?.individualOwnerRowsBundled ?? 0}</b></div><div><span>Government aggregate land-owner count</span><b>{number(enrichment.ownerAggregates?.aggregateLandOwnerCount)}</b></div></div>
      <div className="table-wrap"><table><thead><tr><th>State / UT</th><th>Portal / authority</th><th>Access status</th><th>Bulk API</th><th>Official portal</th></tr></thead><tbody>{portalRows.map((r)=><tr key={r.stateCode}><td><b>{r.state}</b><small>{r.type} · {r.stateCode}</small></td><td>{r.portalName || 'Authority reference'}<small>{r.authority}</small></td><td>{titleCase(r.portalStatus || 'Not listed')}</td><td>Not verified</td><td>{r.portalUrl ? <a href={r.portalUrl} target="_blank" rel="noreferrer">Open portal ↗</a> : 'No public URL captured'}</td></tr>)}</tbody></table></div>
      <div className="info-note"><b>Limited/non-uniform coverage notes:</b>{(enrichment.portalDirectory?.limitedScopePortals || []).map((r)=><p key={r.stateCode}><b>{r.state}:</b> {r.scope}</p>)}Owner identities imported from lawful records remain restricted personal data and are not bundled here.</div>
      {['authority','admin'].includes(user.role) && <div className="form-grid" style={{marginTop:16}}><label>Import authorised parcel evidence CSV/JSON<input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e)=>importSourceFile('/parcel-evidence/import',e)}/></label><p className="muted">Authority/admin only. Each row must include a State, district, village/mouza, parcel ID, official record ID, government source URL and access basis (PUBLIC_RECORD, AUTHORITY_EXPORT or CONSENTED_SUBMISSION). Owner names are access-restricted.</p></div>}
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">DILRMP / MAP DIGITIZATION</p><h2>Cadastral map, land parcel and ULPIN progress</h2></div><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><a href="https://www.dilrmp.gov.in/physicalProgressReports/map/state-level" target="_blank" rel="noreferrer">Open current MIS 4.0 report ↗</a>{['authority','admin'].includes(user.role) && <button className="secondary" onClick={refreshMap}>↻ Refresh MIS 4.0</button>}</div></div>
      <p className="muted">Current MIS 4.0 page schema covers cadastral maps/FMBs/Tippans, digitisation, geo-referencing, land parcels, map-to-RoR links and ULPIN. The current State/UT raw-row refresh is separate from the historical MIS 3.0 snapshot.</p>
      <div className="source-meta"><div><span>Current MIS 4.0 capture</span><b>{enrichment.mapDigitization?.currentSnapshot?.coverage?.stateRows ? `${enrichment.mapDigitization.currentSnapshot.coverage.stateRows}/36 rows` : 'Not yet captured locally'}</b></div><div><span>Legacy MIS 3.0 national land parcels</span><b>{number(enrichment.mapDigitization?.legacySnapshot?.publishedGrandTotal?.landParcelsTotal)}</b></div><div><span>Legacy ULPIN assigned</span><b>{number(enrichment.mapDigitization?.legacySnapshot?.publishedGrandTotal?.ulpinImplemented)}</b></div><div><span>Legacy geo-referenced parcels</span><b>{number(enrichment.mapDigitization?.legacySnapshot?.publishedGrandTotal?.landParcelsGeoReferenced)}</b></div></div>
      <p className="info-note">Legacy MIS 3.0 values are historical and the captured page does not expose a reliable data-as-of date. Do not combine these numbers with current MIS 4.0 progress. These are map digitisation/administrative parcel indicators, not individual title or owner records.</p>
      {enrichment.mapDigitization?.legacySnapshot?.districtSnapshots?.filter((r)=>r.grandTotal).map((r)=><p className="info-note" key={r.stateCode}>{r.state} legacy district snapshot ({r.districtRows} districts): {number(r.grandTotal.landParcelsTotal)} land parcels, {number(r.grandTotal.ulpinImplemented)} ULPIN assigned. <a href={r.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a></p>)}
    </section>
    <section className="stats-grid">
      <Stat label="State / UT coverage" value={`${safeStates.length}/36`} help={`28 States · 8 Union Territories`} icon="▤" tone="mint"/>
      <Stat label="Reported RoR" value={number(national.rorTotal)} help="Aggregate from DILRMP CLR State/UT table" icon="▦" tone="blue"/>
      <Stat label="RoR computerised" value={`${national.rorComputerizedPercent ?? '—'}%`} help={`${number(national.rorComputerized)} records as reported`} icon="✓" tone="gold"/>
      <Stat label="Villages with CLR complete" value={`${national.villagesClrCompletedPercent ?? '—'}%`} help={`${number(national.villagesClrCompleted)} of ${number(national.villages)} villages`} icon="⌂" tone="rose"/>
    </section>
    <section className="panel">
      <div className="panel-head"><div><p className="eyebrow">DILRMP / DEPARTMENT OF LAND RESOURCES</p><h2>All-India CLR State / UT indicators</h2></div><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><span className="count-chip">{safeStates.length} jurisdictions</span>{['authority','admin'].includes(user.role) && <button className="secondary" onClick={async()=>{try{const r=await request('/real-data/state-level/refresh',{token,method:'POST'});setStateData(r);alert(`DILRMP refresh completed: ${r.coverage?.recordsWithMetrics || 0}/36 State/UT rows.`);}catch(e){alert(e.message)}}}>↻ Refresh official data</button>}</div></div>
      <p className="muted">Snapshot retrieved 14-Nov-2026 from the current Government of India CLR State/UT-wise table. “Total land owners” is a published aggregate count only; no individual owner identities or parcel-level titles are exposed here.</p><p className="info-note">The directory combines the dated DoLR RoR list with later official State/UT portal references checked on 14-Nov-2026. A link does not guarantee current portal uptime, bulk-download permission, or a public parcel-ownership API.</p>
      <label className="search-field">Find State / UT<input type="search" value={stateQuery} onChange={(e)=>setStateQuery(e.target.value)} placeholder="Search jurisdiction or LGD code"/></label>
      <div className="table-wrap"><table><thead><tr><th>State / UT</th><th>LGD code</th><th>Districts</th><th>Tehsils</th><th>Villages</th><th>RoR total</th><th>Computerised</th><th>CLR complete</th><th>Reported land-owner aggregate</th><th>Gender owners (M/F)</th><th>Online RoR</th><th>Signed RoR</th><th>Portal</th></tr></thead><tbody>{filteredStates.map(r => <tr key={r.stateCode}><td><b>{r.state}</b><small>{r.type}</small></td><td>{r.lgdCode}</td><td>{number(r.totalDistricts)}</td><td>{number(r.totalTehsils)}</td><td>{number(r.totalVillages)}</td><td>{number(r.totalRor)}</td><td>{r.rorComputerizedPercent == null ? '—' : `${r.rorComputerizedPercent}%`}</td><td>{r.villagesClrCompletedPercent == null ? '—' : `${r.villagesClrCompletedPercent}%`}</td><td>{number(r.totalLandOwners)}</td><td>{number(r.genderBasedOwnership?.male)} / {number(r.genderBasedOwnership?.female)}</td><td>{r.capabilities?.onlineRoRDownload == null ? '—' : r.capabilities.onlineRoRDownload ? 'Yes' : 'No'}</td><td>{r.capabilities?.digitallySignedRoROnline == null ? '—' : r.capabilities.digitallySignedRoROnline ? 'Yes' : 'No'}</td><td>{r.rorDirectory?.url ? <a href={r.rorDirectory.url} target="_blank" rel="noreferrer">{r.rorDirectory.portalName || 'Open portal'} ↗</a> : 'Not listed'}</td></tr>)}</tbody></table></div>
      <p className="info-note">National total: {number(national.districts)} districts, {number(national.tehsils)} tehsils, {number(national.villages)} villages; {number(national.totalLandOwners)} aggregate landholder count. Individual names and legal rights are not included.</p>
    </section>
    <section className="dashboard-grid">
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">SURVEY OF INDIA / ABDB</p><h2>Administrative hierarchy index</h2></div><span className="count-chip">{abdb.hierarchyIndexed ? 'Indexed' : 'Not indexed'}</span></div>
        <p className="muted">Official State, District and Sub-District geometry archive; not a cadastral parcel or land-title database.</p>
        <div className="source-meta"><div><span>State/UT boundaries</span><b>{abdb.coverage?.stateBoundaryFeatures ?? '—'} / 36</b></div><div><span>District features</span><b>{number(abdb.coverage?.assignedDistrictBoundaryFeatures)}</b></div><div><span>Sub-District rows</span><b>{number(abdb.coverage?.indexedSubDistrictFeatures)}</b></div><div><span>Disputed district features excluded</span><b>{number(abdb.coverage?.disputedOrUnassignedDistrictFeatures)}</b></div><div><span>Incomplete sub-district features</span><b>{number(abdb.coverage?.subDistrictFeaturesMissingRequiredAttributes)}</b></div><div><span>States with no indexed sub-district rows</span><b>{(abdb.coverage?.statesWithoutIndexedSubDistricts || []).join(', ') || 'None'}</b></div><div><span>Archive size</span><b>{number(abdb.archiveBytes)} bytes</b></div><div><span>Archive SHA-256</span><b><code>{abdb.archiveSha256 || '—'}</code></b></div></div>
        <p className="info-note">ABDB coverage gaps are retained as metadata. It is not appropriate to convert disputed boundaries or missing codes into invented districts.</p>
      </section>
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">NGDRS / REGISTRATION ACTIVITY</p><h2>Registration reporting snapshot</h2></div></div>
        <div className="source-meta"><div><span>Reporting jurisdictions</span><b>{stateData.ngdrsCoverage?.rowsReported ?? '—'} / 36</b></div><div><span>Documents registered</span><b>{number(stateData.ngdrsNationalTotals?.documentsRegistered)}</b></div><div><span>SRO offices</span><b>{number(stateData.ngdrsNationalTotals?.sroOffices)}</b></div><div><span>Revenue (INR lakh)</span><b>{number(stateData.ngdrsNationalTotals?.revenueCollectionLakh)}</b></div></div>
        <p className="info-note">NGDRS registration statistics are aggregate document counts for the published dashboard period, not ownership/title datasets. Non-reported jurisdictions remain null.</p>
      </section>
    </section>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">NGDRS / SEPARATE MANUAL DATA-ENTRY FEED</p><h2>Historical manual registration rows</h2></div><span className="count-chip">{stateData.ngdrsDataEntry?.records?.length || 0} rows</span></div>
      <p className="muted">These five rows come from a separate NGDRS manual data-entry table snapshot dated 10-Aug-2026. Their row-level last-updated dates range from 2023 to 2026. They are deliberately not merged with the 26 live State IGR rows or national live-feed totals.</p>
      <div className="table-wrap"><table><thead><tr><th>State</th><th>System</th><th>SRO offices</th><th>Submitted</th><th>Appointments</th><th>Registered</th><th>Revenue (₹ lakh)</th><th>Last updated</th></tr></thead><tbody>{(stateData.ngdrsDataEntry?.records || []).map((r)=><tr key={r.stateCode}><td><b>{r.state}</b></td><td>{r.system}</td><td>{number(r.sroOffices)}</td><td>{number(r.documentsSubmitted)}</td><td>{number(r.appointments)}</td><td>{number(r.documentsRegistered)}</td><td>{number(r.revenueCollectionLakh)}</td><td>{r.lastUpdated}</td></tr>)}</tbody></table></div>
      <p className="info-note">Manual-feed data is historical and separately sourced. It is not counted as part of the current 26-State live IGR totals.</p>
    </section>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">HISTORICAL SOURCE SUBSET</p><h2>Village-level DILRMP rows</h2></div><span className="count-chip">{safeRecords.length} source rows</span></div>
      <p className="muted">The bundled village-level rows are a historical extract from Karnataka and West Bengal only, with source status dates in July/August 2024. They are not a 36-State village census and are not individual owner or parcel records.</p>
      <div className="table-wrap"><table><thead><tr><th>State</th><th>District</th><th>Tehsil</th><th>Village</th><th>RoR</th><th>Holders (aggregate)</th><th>Digitally signed RoR</th><th>Source date</th></tr></thead><tbody>{safeRecords.map((r,i)=><tr key={`${r.state}-${r.village}-${i}`}><td>{r.state}</td><td>{r.district}</td><td>{r.tehsil}</td><td>{r.village}</td><td>{number(r.totalRor)}</td><td>{number(r.landOwnersHolders)}</td><td>{number(r.digitallySignedRor)}</td><td>{r.statusEntryDate || '—'}</td></tr>)}</tbody></table></div>
      <div className="source-meta"><div><span>Authority</span><b>{source.authority || 'Department of Land Resources, Government of India'}</b></div><div><span>Historical extract scope</span><b>{(source.states || []).join(' · ') || '—'}</b></div><div><span>Field mapping</span><b>{Object.keys(data.source.fieldMapping || {}).length} fields</b></div></div>
    </section>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">SOURCE / LEGAL BOUNDARY</p><h2>Owner-level and parcel-level verification</h2></div></div><p className="info-note">DILRMP provides State/UT aggregate land-owner counts, but not a nationwide person-name-to-parcel register. The State RoR directory links to official lookup portals; for a specific parcel, use the issuing State portal (for West Bengal: <a href="https://banglarbhumi.gov.in/" target="_blank" rel="noreferrer">BanglarBhumi ↗</a>). OTP/CAPTCHA/login access controls must not be bypassed. No private bulk owner list is scraped or fabricated.</p><p className="info-note">Parcel-level records imported into this prototype must carry State, district, mouza/village, plot/khasra/dag or khatian reference, official source URL, retrieval time, lawful access basis and verification status. A portal result initially remains SOURCE_CAPTURED_UNVERIFIED until competent-authority verification.</p><p className="info-note">No parcel-specific acquisition status is inferred from project-level hectares. The app preserves UNKNOWN until an official acquisition order/award/possession/release record can be matched by a source-supported parcel identifier. Missing rows never mean “not acquired”.</p><p className="info-note">A submitted claimant name is self-reported; application workflow approval is not statutory title mutation. SHA-256 detects a later file change; it does not prove the original document was genuine.</p></section>
  </>;
}

function Research({ token }) {
  const [evaluation, setEvaluation] = useState(null); const [fabric, setFabric] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let active = true; Promise.all([request('/research/evaluation', { token }), request('/fabric/status', { token })]).then(([e, f]) => active && (setEvaluation(e), setFabric(f))).catch((e) => active && setError(e.message)); return () => { active = false; }; }, [token]);
  if (error) return <section className="panel"><div className="form-error">{error}</div></section>;
  if (!evaluation) return <section className="panel"><div className="empty"><strong>Loading research evaluation…</strong></div></section>;
  const w = evaluation.controlledWorkflowEvaluation; const fr = evaluation.fraudRiskEvaluation;
  return <>
    <section className="page-heading compact"><div><p className="eyebrow">RESEARCH &amp; EVALUATION</p><h1>Evidence, methodology and results</h1><p>Official public land-administration data is kept separate from controlled transaction experiments.</p></div><span className={`status-pill ${fabric?.connected ? 'ok' : 'warn'}`}>{fabric?.connected ? 'Fabric connected' : 'Fabric not connected'}</span></section>
    <section className="stats-grid"><Stat label="Official records" value={evaluation.officialDataset.records} help={`${evaluation.officialDataset.states.join(' · ')} · schema validated`} icon="▤" tone="mint"/><Stat label="Test scenarios" value={w.cases} help="Controlled workflow evaluation" icon="◇" tone="blue"/><Stat label="Precision" value={`${(w.precision * 100).toFixed(0)}%`} help="Conflict/workflow classification" icon="✓" tone="gold"/><Stat label="F1 score" value={`${(w.f1 * 100).toFixed(0)}%`} help="Controlled workflow evaluation" icon="↗" tone="rose"/><Stat label="Fraud-risk F1" value={`${(fr.f1 * 100).toFixed(0)}%`} help="Synthetic controlled cases only" icon="!" tone="blue"/></section>
    <section className="dashboard-grid research-grid"><section className="panel"><div className="panel-head"><div><p className="eyebrow">METHODOLOGY</p><h2>Two-layer validation</h2></div></div><div className="method-flow"><div><b>01</b><span>Official public data</span><small>DILRMP CLR snapshot provides real land-administration context and provenance.</small></div><div><b>02</b><span>Normalization</span><small>Common fields are normalized for schema validation and analysis.</small></div><div><b>03</b><span>Controlled experiments</span><small>Valid transfers, duplicate parcels, conflicting claimant claims and rejection paths are tested.</small></div><div><b>04</b><span>Blockchain audit</span><small>Approved events can be persisted through Hyperledger Fabric when Fabric mode is enabled.</small></div></div></section><section className="panel"><div className="panel-head"><div><p className="eyebrow">FABRIC STATUS</p><h2>Ledger backend</h2></div></div><div className="fabric-card"><div><span>Mode</span><b>{fabric?.mode || '—'}</b></div><div><span>Connection</span><b>{fabric?.connected ? 'Connected' : 'Not connected'}</b></div><div><span>Channel</span><b>{fabric?.channel || 'landchannel'}</b></div><div><span>Chaincode</span><b>{fabric?.chaincode || 'landrecords'}</b></div></div><p className="info-note">Run the supplied Fabric bootstrap script and set <code>FABRIC_MODE=fabric</code> before claiming live blockchain transaction results.</p></section></section>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">CONTROLLED RESULTS</p><h2>Classification matrix</h2></div><span className="count-chip">Ground truth known</span></div><div className="table-wrap"><table><thead><tr><th>Metric</th><th>Result</th><th>Interpretation</th></tr></thead><tbody><tr><td>True positives</td><td>{w.truePositives}</td><td>Expected conflict/workflow cases correctly detected</td></tr><tr><td>True negatives</td><td>{w.trueNegatives}</td><td>Expected clean cases correctly accepted</td></tr><tr><td>False positives</td><td>{w.falsePositives}</td><td>Clean cases incorrectly flagged</td></tr><tr><td>False negatives</td><td>{w.falseNegatives}</td><td>Expected problem cases missed</td></tr><tr><td>Recall</td><td>{(w.recall * 100).toFixed(0)}%</td><td>Controlled experiment only</td></tr></tbody></table></div><p className="info-note">{evaluation.note}</p></section>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">DOCUMENT INTELLIGENCE</p><h2>Pre-ledger validation</h2></div><span className="count-chip">Tesseract OCR · PDF text extraction · pattern-based field checks</span></div><p className="info-note">Supported PDFs/images are processed using embedded PDF text extraction and Tesseract OCR when installed; parcel/name/area candidates are extracted using deterministic patterns, not a trained NER model. A review flag is a screening signal, not proof of fraud, and requires human review.</p><div className="table-wrap"><table><thead><tr><th>Signal</th><th>Meaning</th></tr></thead><tbody><tr><td>OCR / PDF text extraction</td><td>Uses pdftotext for embedded PDF text; Tesseract OCR for scans/images when the binary is installed.</td></tr><tr><td>Pattern extraction</td><td>Regular-expression rules locate parcel/survey number, claimant-name, area and address candidates; this is not machine-learning NER.</td></tr><tr><td>Anomaly rules</td><td>Flags suspicious terms, missing fields and parcel mismatches.</td></tr><tr><td>ML risk</td><td>Logistic-regression risk signal combines duplicate, mismatch, document and workflow features.</td></tr></tbody></table></div></section>
    <section className="panel"><div className="panel-head"><div><p className="eyebrow">RESEARCH CLAIM</p><h2>What the system actually contributes</h2></div></div><ul className="research-list"><li><b>Document integrity:</b> SHA-256 fingerprints provide tamper-evident document references.</li><li><b>Authority-in-the-loop:</b> claimant-reference changes are recorded only after the configured workflow review; statutory title remains outside this prototype.</li><li><b>Pre-ledger screening:</b> Tesseract/PDF text extraction, deterministic pattern matching, cross-field consistency checks and explainable risk signals run before ledger commitment; this is not trained NER or proof of document authenticity.</li><li><b>Conflict screening:</b> duplicate parcel references, multiple active owners and repeated document hashes are surfaced for review.</li><li><b>Auditability:</b> ledger events provide a traceable history; a Fabric Gateway/chaincode path is supplied, but requires separate credentials, live deployment and reconciliation before production use.</li><li><b>Security evidence:</b> the repository includes automated control checks plus a threat model; these are not a penetration-test certificate.</li></ul></section>
  </>;
}

function App() {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem('landledger-session') || 'null'); } catch { return null; } });
  const [page, setPage] = useState('overview'); const [properties, setProperties] = useState([]); const [transfers, setTransfers] = useState([]); const [analytics, setAnalytics] = useState(null); const [selected, setSelected] = useState(null); const [registering, setRegistering] = useState(false); const [notice, setNotice] = useState(null); const [loading, setLoading] = useState(false);
  const user = session?.user; const authority = ['authority', 'admin'].includes(user?.role);
  const toast = (message, kind = '') => { setNotice({ message, kind }); window.setTimeout(() => setNotice(null), 5000); };
  const refresh = async () => { if (!session?.token) return; setLoading(true); try { const [props, txns, stats] = await Promise.all([request('/properties', { token: session.token }), request('/transfers', { token: session.token }), authority ? request('/analytics/overview', { token: session.token }) : Promise.resolve(null)]); setProperties(props.properties); setTransfers(txns.transfers); setAnalytics(stats); } catch (error) { if (/session|Sign in|token/i.test(error.message)) logout(); else toast(error.message, 'error'); } finally { setLoading(false); } };
  useEffect(() => { refresh(); }, [session?.token]);
  function login(data) { localStorage.setItem('landledger-session', JSON.stringify(data)); setSession(data); }
  function logout() { localStorage.removeItem('landledger-session'); setSession(null); setProperties([]); setTransfers([]); setAnalytics(null); }
  const nav = useMemo(() => [{ id: 'overview', label: 'Overview', icon: '⌂' }, { id: 'properties', label: 'Properties', icon: '▦' }, { id: 'transfers', label: 'Transfers', icon: '⇄' }, ...(authority ? [{ id: 'authority', label: 'Authority portal', icon: '◇' }] : []), { id: 'data', label: 'Official data', icon: '◫' }, { id: 'research', label: 'Research & results', icon: '◎' }], [authority]);
  if (!session) return <Login onLogin={login}/>;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">▦</div><span>LandLedger</span></div><div className="sidebar-label">WORKSPACE</div><nav>{nav.map((item) => <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => setPage(item.id)}><i>{item.icon}</i>{item.label}</button>)}</nav><div className="sidebar-spacer"></div><div className="prototype-note"><span>◒</span><p><b>Hybrid evaluation mode</b>Official public data linked<br/>Transactions remain controlled tests</p></div><button className="profile" onClick={logout}><span>{user.name.slice(0, 1)}</span><div><b>{user.name}</b><small>{titleCase(user.role)}</small></div><i>↗</i></button></aside><main className="main"><header className="topbar"><div className="mobile-brand">▦ LandLedger</div><div className="prototype-banner">Academic prototype · official aggregate data + user-submitted claims</div><button className="notification" onClick={() => toast('Notifications are represented by the activity ledger in this prototype.')}>◌<em>{authority ? properties.filter((p) => p.status === 'PENDING').length : transfers.filter((t) => t.status === 'PROPOSED' && t.buyerId === user.id).length}</em></button></header><div className="content">{loading && <div className="loading-line"></div>}{page === 'overview' && <Dashboard user={user} properties={properties} transfers={transfers} analytics={analytics} onSelect={setSelected} onRegister={() => setRegistering(true)}/>} {page === 'properties' && <><section className="page-heading compact"><div><p className="eyebrow">PROPERTY MANAGEMENT</p><h1>Land records</h1><p>Submitted property claims, review state, document fingerprints, and event history.</p></div>{['owner','seller','authority','admin'].includes(user.role) && <button className="primary" onClick={() => setRegistering(true)}>+ Register property</button>}</section><PropertyTable properties={properties} onSelect={setSelected}/></>} {page === 'transfers' && <Transfers token={session.token} user={user} transfers={transfers} properties={properties} refresh={refresh} toast={toast}/>} {page === 'authority' && authority && <Authority token={session.token} properties={properties} analytics={analytics} refresh={refresh} toast={toast} onSelect={setSelected}/>} {page === 'data' && <DataSources token={session.token} user={user}/>} {page === 'research' && <Research token={session.token}/>} </div></main>{selected && <PropertyDetail property={selected} token={session.token} user={user} onClose={() => setSelected(null)} refresh={refresh} toast={toast}/>} {registering && <RegisterModal token={session.token} close={() => setRegistering(false)} refresh={refresh} toast={toast}/>}<Toast {...notice} onClose={() => setNotice(null)}/></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
