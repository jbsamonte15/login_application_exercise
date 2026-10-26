import { useCallback, useEffect, useMemo, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const blankRecord = { firstName: '', lastName: '', email: '', phone: '', status: 'Active', notes: '' };

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await onLogin(email, password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <main className="login-wrap">
    <section className="login-card">
      <div className="brand-mark">RM</div>
      <p className="eyebrow">RECORDS MANAGEMENT</p>
      <h1>Welcome back</h1>
      <p className="muted">Sign in to manage your contact records.</p>
      <form onSubmit={submit} className="stack">
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  </main>;
}

function RecordModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || blankRecord);
  const [error, setError] = useState('');
  function change(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); }
  async function submit(e) {
    e.preventDefault(); setError('');
    try { await onSave(form); } catch (err) { setError(err.message); }
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className="modal">
      <div className="modal-heading"><div><p className="eyebrow">{initial?.id ? 'UPDATE DETAILS' : 'NEW CONTACT'}</p><h2>{initial?.id ? 'Edit record' : 'Add record'}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close">×</button></div>
      <form onSubmit={submit} className="stack">
        <div className="form-grid">
          <label>First name *<input name="firstName" value={form.firstName} onChange={change} maxLength="100" required /></label>
          <label>Last name *<input name="lastName" value={form.lastName} onChange={change} maxLength="100" required /></label>
          <label>Email address *<input type="email" name="email" value={form.email} onChange={change} required /></label>
          <label>Phone<input name="phone" value={form.phone} onChange={change} maxLength="50" /></label>
          <label>Status<select name="status" value={form.status} onChange={change}><option>Active</option><option>Inactive</option></select></label>
          <label className="span-two">Notes<textarea name="notes" value={form.notes} onChange={change} rows="3" /></label>
        </div>
        {error && <div className="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save record'}</button></div>
      </form>
    </section>
  </div>;
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('records_token') || '');
  const [user, setUser] = useState(() => sessionStorage.getItem('records_user') || '');
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRecords = useCallback(async () => {
    if (!token) return;
    setPageError('');
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (status !== 'All statuses') params.set('status', status);
    try {
      const data = await request(`/api/records?${params.toString()}`, { token });
      setRecords(data.records);
    } catch (err) {
      setPageError(err.message);
      if (err.message === 'Unauthorized') logout();
    }
  }, [token, query, status]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function login(email, password) {
    const data = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    sessionStorage.setItem('records_token', data.token);
    sessionStorage.setItem('records_user', data.user.email);
    setToken(data.token); setUser(data.user.email);
  }
  function logout() {
    sessionStorage.removeItem('records_token'); sessionStorage.removeItem('records_user');
    setToken(''); setUser(''); setRecords([]); setModal(null);
  }
  async function saveRecord(form) {
    setBusy(true);
    try {
      if (form.id) await request(`/api/records/${form.id}`, { method: 'PUT', token, body: JSON.stringify(form) });
      else await request('/api/records', { method: 'POST', token, body: JSON.stringify(form) });
      setModal(null); setNotice(form.id ? 'Record updated successfully.' : 'Record added successfully.');
      await loadRecords();
      setTimeout(() => setNotice(''), 3000);
    } finally { setBusy(false); }
  }
  async function deleteRecord(record) {
    if (!window.confirm(`Delete ${record.firstName} ${record.lastName}? This cannot be undone.`)) return;
    try {
      await request(`/api/records/${record.id}`, { method: 'DELETE', token });
      setNotice('Record deleted successfully.'); await loadRecords();
      setTimeout(() => setNotice(''), 3000);
    } catch (err) { setPageError(err.message); }
  }

  const activeCount = useMemo(() => records.filter(r => r.status === 'Active').length, [records]);
  if (!token) return <Login onLogin={login} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark small">RM</div><div><strong>RMS</strong><small>Records Management System Portal</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <div className="nav-item selected"><span>▦</span> Records <span className="nav-count">{records.length}</span></div>
      <div className="sidebar-bottom"><div className="avatar">{(user[0] || 'A').toUpperCase()}</div><div className="user-info"><strong>{user}</strong><small>Administrator</small></div><button className="logout" onClick={logout} title="Logout">↗</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><span className="crumb">Workspace</span><span className="crumb-sep">/</span><strong>Records</strong></div><div className="top-user"><span className="online-dot"></span> Signed in as <strong>{user}</strong></div></header>
      <div className="page">
        <div className="page-heading"><div><p className="eyebrow">DIRECTORY</p><h1>Contact records</h1></div><button className="primary" onClick={() => setModal({ ...blankRecord })}><span className="plus">＋</span> Add record</button></div>
        <div className="stats-row">
          <div className="stat-card"><div className="stat-icon purple">▦</div><div><span>Total records shown</span><strong>{records.length}</strong><small>Based on current filters</small></div></div>
          <div className="stat-card"><div className="stat-icon green">✓</div><div><span>Active records shown</span><strong>{activeCount}</strong><small>Currently active</small></div></div>
        </div>
        <section className="records-panel">
          <div className="panel-heading"><div><h2>All records</h2></div><span className="count-pill">{records.length} {records.length === 1 ? 'record' : 'records'}</span></div>
          <div className="toolbar"><div className="search-wrap"><span>⌕</span><input aria-label="Search records" placeholder="Search name, email, phone or notes…" value={query} onChange={e => setQuery(e.target.value)} /></div><label className="filter-wrap"><span>Filter status</span><select value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option><option>Active</option><option>Inactive</option></select></label></div>
          {pageError && <div className="alert page-alert">{pageError}</div>}
          {notice && <div className="success page-alert">{notice}</div>}
          <div className="table-scroll"><table><thead><tr><th>CONTACT</th><th>EMAIL / PHONE</th><th>STATUS</th><th>NOTES</th><th className="align-right">ACTIONS</th></tr></thead>
            <tbody>{records.map(record => <tr key={record.id}>
              <td><div className="contact-cell"><div className="contact-avatar">{record.firstName[0]}{record.lastName[0]}</div><div><strong>{record.firstName} {record.lastName}</strong><small>Record #{record.id}</small></div></div></td>
              <td><div className="email-cell">{record.email}<small>{record.phone || 'No phone provided'}</small></div></td>
              <td><span className={`status ${record.status.toLowerCase()}`}><i></i>{record.status}</span></td>
              <td className="notes-cell" title={record.notes}>{record.notes || '—'}</td>
              <td><div className="actions"><button className="action-edit" onClick={() => setModal({ ...record })}>Edit</button><button className="action-delete" onClick={() => deleteRecord(record)}>Delete</button></div></td>
            </tr>)}</tbody></table></div>
          {records.length === 0 && <div className="empty-state"><div className="empty-icon">⌕</div><strong>No records found</strong><p>{query || status !== 'All statuses' ? 'Try changing your search or filter.' : 'Add your first contact to get started.'}</p>{!query && status === 'All statuses' && <button className="primary" onClick={() => setModal({ ...blankRecord })}>Add your first record</button>}</div>}
          <div className="table-footer"><span>Showing <strong>{records.length}</strong> {records.length === 1 ? 'record' : 'records'}</span></div>
        </section>
        <footer> Records Management System <span>·</span> Created by Jayson Brian Samonte</footer>
      </div>
    </main>
    {modal && <RecordModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveRecord} saving={busy} />}
  </div>;
}

export default App;
