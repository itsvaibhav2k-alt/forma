import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { App } from '../app/App';
import { projectRepository, type Project, type SaveProject } from './repository';
import type { Backend } from './client';
import { workspaceSignature, type Workspace } from './workspace';
import './projects.css';

export const AUTOSAVE_DELAY_MS = 1500;

export function AccountForm({ client, recovery, onRecovered }: { client: SupabaseClient; recovery: boolean; onRecovered: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = recovery ? await client.auth.updateUser({ password }) : mode === 'signin'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (result.error) throw new Error(recovery ? 'Could not update the password. Request a new recovery email and try again.' : mode === 'signin' ? 'Sign-in failed. Check your email and password, or reset your password.' : 'Could not create the account. Check your details and try again.');
      setPassword('');
      if (recovery) { setMessage('Password updated.'); onRecovered(); }
      else if (mode === 'signup' && 'session' in result.data && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    } catch (err) { setError(err instanceof Error ? err.message : 'The account service could not be reached.'); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!email.trim()) { setError('Enter your email first.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error: failure } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (failure) throw new Error('Could not request recovery. Try again shortly.');
      setMessage('If this account exists, a recovery email has been sent.');
    } catch { setError('Could not request recovery. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <form className="account-form" onSubmit={submit}>
    <h3>{recovery ? 'Choose a new password' : mode === 'signin' ? 'Sign in to your projects' : 'Create your account'}</h3>
    {!recovery && <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
    <label>{recovery ? 'New password' : 'Password'}<input type="password" autoComplete={recovery || mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' || recovery ? 10 : 1} required value={password} onChange={e => setPassword(e.target.value)} /></label>
    {(mode === 'signup' || recovery) && <p>Use at least 10 characters.</p>}
    <div className="project-buttons"><button className="primary-button" disabled={busy}>{busy ? 'Working…' : recovery ? 'Update password' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      {!recovery && <><button className="outline-button" type="button" disabled={busy} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setPassword(''); }}>{mode === 'signin' ? 'Create an account' : 'Back to sign in'}</button><button className="text-button" type="button" disabled={busy} onClick={reset}>Forgot password?</button></>}
    </div>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </form>;
}

export function ProjectApp({ backend, recoveryLink = false }: { backend: Backend; recoveryLink?: boolean }) {
  if (backend.status !== 'ready') return <App projectPanel={<section className="project-bar" aria-label="Projects"><strong>Unsaved workspace</strong><p>{backend.status === 'error' ? backend.message : 'Project storage is not connected. You can experiment here; reloading clears this workspace.'}</p></section>} />;
  return <ConnectedWorkspace client={backend.client} recoveryLink={recoveryLink} />;
}

export function ConnectedWorkspace({ client, recoveryLink = false }: { client: SupabaseClient; recoveryLink?: boolean }) {
  const repository = useMemo(() => projectRepository(client), [client]);
  const [session, setSession] = useState<Session | null>(null), [authReady, setAuthReady] = useState(false);
  const [recovery, setRecovery] = useState(recoveryLink), [expanded, setExpanded] = useState(recoveryLink);
  const [projects, setProjects] = useState<Project[]>([]), [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState(''), [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [initial, setInitial] = useState<Workspace | undefined>(), [workspaceKey, setWorkspaceKey] = useState(0);
  const [busy, setBusy] = useState(false), [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false), [savePaused, setSavePaused] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pending, setPending] = useState<null | { label: string; action: () => void }>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const baseline = useRef<string | null>(null), epoch = useRef(0), lock = useRef(false), userId = useRef<string | null>(null);
  const listRequest = useRef(0), pendingSave = useRef<SaveProject | null>(null);
  const live = useRef(true);
  const onChange = useCallback((value: Workspace) => {
    if (baseline.current === null) baseline.current = workspaceSignature(value);
    setWorkspace(value);
  }, []);
  const fingerprint = useMemo(() => workspace ? workspaceSignature(workspace) : '', [workspace]);
  const dirty = !!workspace && (fingerprint !== baseline.current || name !== (project?.name ?? ''));
  const clearWorkspace = useCallback(() => {
    epoch.current++; lock.current = false; pendingSave.current = null; baseline.current = null;
    setWorkspace(null); setInitial(undefined); setWorkspaceKey(key => key + 1); setProject(null); setName(''); setBusy(false); setSaving(false); setSavePaused(false); setPending(null); setError(''); setNotice('');
  }, []);
  useEffect(() => {
    live.current = true;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!live.current) return;
      if (userId.current && userId.current !== next?.user.id) { clearWorkspace(); setProjects([]); }
      userId.current = next?.user.id ?? null;
      setSession(next); setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setExpanded(true); }
      if (!next) setRecovery(false);
    });
    return () => { live.current = false; epoch.current++; data.subscription.unsubscribe(); };
  }, [client, clearWorkspace]);
  const refresh = useCallback(async () => {
    const request = ++listRequest.current, account = userId.current;
    if (!account) return;
    setLoadingList(true);
    try { const rows = await repository.list(); if (live.current && account === userId.current && request === listRequest.current) setProjects(rows); }
    catch (err) { if (live.current && account === userId.current && request === listRequest.current) setError(err instanceof Error ? err.message : 'Could not load projects.'); }
    finally { if (live.current && account === userId.current && request === listRequest.current) setLoadingList(false); }
  }, [repository]);
  useEffect(() => { if (session?.user.id) void refresh(); }, [session?.user.id, refresh]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);
  useEffect(() => { if (pending) confirmation.current?.focus(); }, [pending]);

  const run = useCallback(async (task: (currentEpoch: number) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const current = epoch.current;
    try { await task(current); }
    catch (err) { if (live.current && current === epoch.current) setError(err instanceof Error ? err.message : 'The operation failed. Your workspace is unchanged.'); }
    finally { if (live.current && current === epoch.current) { lock.current = false; setBusy(false); } }
  }, []);
  const save = useCallback((copy: boolean) => {
    if (!workspace || !userId.current) return;
    const captured = workspace;
    void run(async current => {
      setSaving(true);
      try {
        const prior = pendingSave.current;
        const request: SaveProject = prior && prior.name === name && workspaceSignature(prior.workspace) === fingerprint && (copy ? prior.expectedVersion === null : prior.id === project?.id || !project)
          ? prior : { id: copy || !project ? crypto.randomUUID() : project.id, name, workspace: captured, expectedVersion: copy ? null : project?.version ?? null, writeId: crypto.randomUUID() };
        pendingSave.current = request;
        const saved = await repository.save(request);
        if (!live.current || current !== epoch.current) return;
        pendingSave.current = null; baseline.current = workspaceSignature(captured);
        setSavePaused(false); setProject(saved); setName(saved.name); setNotice(`Saved “${saved.name}”.`);
        setProjects(rows => [saved, ...rows.filter(row => row.id !== saved.id)]);
      } catch (failure) {
        // Never retry indefinitely or overwrite a newer revision after a conflict.
        if (live.current && current === epoch.current) setSavePaused(true);
        throw failure;
      } finally {
        if (live.current && current === epoch.current) setSaving(false);
      }
    });
  }, [workspace, name, fingerprint, project, repository, run]);
  useEffect(() => {
    // New workspaces require an explicit first save. Suspend while switching,
    // recovering an account, or waiting for the user to resolve a failed save.
    if (!project || !session || !dirty || busy || pending || recovery || savePaused || !name.trim()) return;
    const scheduledEpoch = epoch.current;
    const timer = window.setTimeout(() => {
      if (live.current && epoch.current === scheduledEpoch) save(false);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [project, session?.user.id, dirty, busy, pending, recovery, savePaused, name, save]);
  function open(id: string) {
    void run(async current => {
      const loaded = await repository.open(id);
      if (!live.current || current !== epoch.current) return;
      pendingSave.current = null; setSavePaused(false); baseline.current = workspaceSignature(loaded.workspace);
      setInitial(loaded.workspace); setWorkspace(loaded.workspace); setWorkspaceKey(key => key + 1);
      setProject(loaded.project); setName(loaded.project.name); setNotice(`Opened “${loaded.project.name}”.`);
    });
  }
  function guard(label: string, action: () => void) { if (dirty) setPending({ label, action }); else action(); }
  function signOut() {
    void run(async () => { const { error: failure } = await client.auth.signOut({ scope: 'local' }); if (failure) throw new Error('Sign out failed. Try again.'); });
  }
  const panel = <section className="project-bar" aria-label="Projects">
    <div className="project-summary"><div><strong>{project?.name ?? 'Unsaved workspace'}</strong><span className="save-state" role="status" aria-live="polite">{saving ? 'Saving…' : savePaused ? 'Save failed — autosave paused' : dirty ? project ? !name.trim() ? 'Enter a project name to save' : pending || recovery ? 'Unsaved changes · autosave paused' : 'Unsaved changes · autosave pending' : 'Unsaved changes' : project ? 'Saved' : 'Save a project to keep your work'}</span></div><button className="outline-button" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Close projects' : 'Projects & account'}</button></div>
    {expanded && <div className="project-panel">
      {!authReady ? <p role="status">Checking your account…</p> : !session || recovery ? <AccountForm client={client} recovery={recovery} onRecovered={() => setRecovery(false)} /> : <>
        <div className="project-account"><p>Signed in as <strong>{session.user.email}</strong></p><button className="text-button" type="button" disabled={busy} onClick={() => guard('sign out', signOut)}>Sign out</button></div>
        <label className="project-name">Project name<input value={name} maxLength={120} disabled={busy} onChange={e => setName(e.target.value)} placeholder="e.g. Bridge lab — first prototype" /></label>
        <div className="project-buttons"><button className="primary-button" type="button" disabled={busy || !workspace || !name.trim()} onClick={() => save(false)}>{busy ? 'Working…' : 'Save project'}</button>{project && <button className="outline-button" type="button" disabled={busy || !name.trim()} onClick={() => save(true)}>Save a copy</button>}<button className="outline-button" type="button" disabled={busy} onClick={() => guard('start a new workspace', clearWorkspace)}>New workspace</button></div>
        <p className="project-help">Save keeps trials, quote inputs, measurement drafts and observations, plus captured reports and patterns. Create the project with Save project once; further edits autosave after a short pause. You can still save immediately. If a save fails, autosave pauses until you retry, open the latest version or save a copy.</p>
        <div className="project-list-heading"><h3>Your projects</h3><button className="text-button" type="button" disabled={loadingList || busy} onClick={() => void refresh()}>Refresh projects</button></div>
        {loadingList ? <p role="status">Loading projects…</p> : projects.length === 0 ? <p>No saved projects yet.</p> : <ul className="project-list">{projects.map(item => <li key={item.id}><div><strong>{item.name}</strong><span>Saved {new Date(item.updated_at).toLocaleString()}</span></div><button className="outline-button" type="button" disabled={busy} onClick={() => guard(`open “${item.name}”`, () => open(item.id))}>Open {item.name}</button></li>)}</ul>}
        {projects.length === 100 && <p>Showing the 100 most recently updated projects.</p>}
      </>}
    </div>}
    {error && <p className="project-error" role="alert">{error}</p>}{savePaused && session && <button className="outline-button" type="button" disabled={busy || !name.trim()} onClick={() => save(false)}>Retry save</button>}{notice && !dirty && !saving && !savePaused && <p>{notice}</p>}
    {pending && <div ref={confirmation} tabIndex={-1} className="project-confirm" role="alertdialog" aria-label="Unsaved changes" aria-describedby="discard-project-description" onKeyDown={event => { if (event.key === 'Escape') setPending(null); }}><p id="discard-project-description">You have unsaved changes. Discard them and {pending.label}?</p><div className="project-buttons"><button className="outline-button" type="button" onClick={() => setPending(null)}>Keep editing</button><button className="primary-button" type="button" onClick={() => { const action = pending.action; setPending(null); action(); }}>Discard changes and continue</button></div></div>}
  </section>;
  return <App key={workspaceKey} {...(initial ? { initialWorkspace: initial } : {})} onWorkspaceChange={onChange} projectPanel={panel} />;
}
