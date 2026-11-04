"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, LogOut, Pencil, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import "./admin.css";

type Course = { id: string; title: string; description: string; level: string; imageUrl: string; videoUrl: string; materialUrl: string; published: boolean };
type Account = { uid: string; name: string; email: string; disabled: boolean; admin: boolean; protected: boolean; createdAt: string };
type CourseForm = Omit<Course, "id">;
const emptyCourse: CourseForm = { title: "", description: "", level: "A1", imageUrl: "", videoUrl: "", materialUrl: "", published: false };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(auth));
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [tab, setTab] = useState<"courses" | "users">("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<Account[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (account) => { setUser(account); setAccess("checking"); setChecking(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function checkAccess() {
      try {
        const token = await user!.getIdToken();
        const response = await fetch("/api/admin?resource=access", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível verificar o acesso.");
        if (active) { setAccess("allowed"); setError(""); }
      } catch (caught) { if (active) { setError(caught instanceof Error ? caught.message : "Não foi possível verificar o acesso."); setAccess("denied"); } }
    }
    checkAccess();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || access !== "allowed") return;
    let active = true;
    async function load() {
      try {
        const token = await user!.getIdToken();
        const response = await fetch(`/api/admin?resource=${tab}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar os dados.");
        if (active) { if (tab === "courses") setCourses(data.courses); else { setUsers(data.users); setNextPage(data.nextPageToken); } setError(""); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados."); }
    }
    load();
    return () => { active = false; };
  }, [user, tab, access]);

  async function request(method: string, body?: unknown, resource = tab, pageToken?: string) {
    if (!user) throw new Error("Faça login para continuar.");
    const token = await user.getIdToken();
    const query = new URLSearchParams({ resource });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`/api/admin?${query}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
    return data;
  }

  async function refresh(resource: "courses" | "users" = tab) {
    const data = await request("GET", undefined, resource);
    if (resource === "courses") setCourses(data.courses);
    else { setUsers(data.users); setNextPage(data.nextPageToken); }
  }

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError(""); setNotice("");
    try { await request("POST", { course: form, ...(editing ? { id: editing } : {}) }); await refresh("courses"); setForm(null); setEditing(null); setNotice("Curso salvo com sucesso."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o curso."); }
    finally { setBusy(false); }
  }

  async function removeCourse(course: Course) {
    if (!window.confirm(`Excluir o curso “${course.title}” e todos os seus módulos? O histórico de avaliações será mantido.`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await request("DELETE", { id: course.id }); await refresh("courses"); setNotice("Curso excluído."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível excluir o curso."); }
    finally { setBusy(false); }
  }

  async function toggleUser(account: Account) {
    const action = account.disabled ? "reativar" : "desativar";
    if (!window.confirm(`Deseja ${action} a conta de ${account.email || account.uid}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try { await request("PATCH", { uid: account.uid, disabled: !account.disabled }); await refresh("users"); setNotice("Conta atualizada."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a conta."); }
    finally { setBusy(false); }
  }

  async function loadMoreUsers() {
    if (!nextPage) return;
    setBusy(true); setError("");
    try { const data = await request("GET", undefined, "users", nextPage); setUsers((current) => [...current, ...data.users]); setNextPage(data.nextPageToken); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar as contas."); }
    finally { setBusy(false); }
  }

  if (checking) return <main className="admin-state">Verificando acesso...</main>;
  if (!user) return <main className="admin-state"><div><GraduationCap size={30} /><h1>Área administrativa</h1><p>Entre com uma conta administradora para continuar.</p><Link className="button" href="/">Voltar ao início <ArrowLeft size={16} /></Link></div></main>;
  if (access === "checking") return <main className="admin-state">Verificando acesso...</main>;
  if (access === "denied") return <main className="admin-state"><div><GraduationCap size={30} /><h1>Acesso indisponível</h1><p role="alert">{error}</p><Link className="button" href="/">Voltar ao início <ArrowLeft size={16} /></Link></div></main>;

  return <div className="admin-layout">
    <aside className="admin-sidebar"><Link className="logo" href="/">make it <span>easy.</span></Link><span className="admin-sidebar-label">ADMINISTRAÇÃO</span><nav aria-label="Menu administrativo"><button className={tab === "courses" ? "selected" : ""} onClick={() => { setTab("courses"); setError(""); setNotice(""); setForm(null); }}><BookOpen size={18} /> Cursos</button><button className={tab === "users" ? "selected" : ""} onClick={() => { setTab("users"); setError(""); setNotice(""); setForm(null); }}><Users size={18} /> Contas</button></nav><div className="admin-sidebar-bottom"><Link href="/"><ArrowLeft size={16} /> Voltar ao site</Link><button onClick={() => auth && signOut(auth)}><LogOut size={16} /> Sair</button></div></aside>
    <main className="admin-main"><div className="admin-top"><div><span className="admin-kicker">PAINEL ADMINISTRATIVO</span><h1>{tab === "courses" ? "Cursos" : "Contas"}</h1><p>{tab === "courses" ? "Organize e publique o conteúdo da plataforma." : "Acompanhe e gerencie os acessos dos alunos."}</p></div><div className="admin-identity"><span>{user.email}</span><div className="avatar">{(user.email || "A").charAt(0).toUpperCase()}</div></div></div>
      {error && <div className="admin-alert" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status"><CheckCircle2 size={16} /> {notice}</div>}
      {tab === "courses" ? <><div className="admin-toolbar"><div><strong>Todos os cursos</strong><span>{courses.length} {courses.length === 1 ? "curso" : "cursos"}</span></div><button className="button button-small" onClick={() => { setForm({ ...emptyCourse }); setEditing(null); setError(""); }}><Plus size={16} /> Novo curso</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CURSO</th><th>NÍVEL</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id}><td><div className="table-title">{course.title}</div><div className="table-subtitle">{course.description}</div></td><td>{course.level}</td><td><span className={`status ${course.published ? "status-live" : ""}`}>{course.published ? "Publicado" : "Rascunho"}</span></td><td><div className="table-actions"><button title="Editar curso" aria-label={`Editar ${course.title}`} onClick={() => { const { id, ...values } = course; setEditing(id); setForm(values); setError(""); }}><Pencil size={16} /></button><button title="Excluir curso" aria-label={`Excluir ${course.title}`} disabled={busy} onClick={() => removeCourse(course)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>{courses.length === 0 && <div className="admin-empty"><BookOpen size={24} /><strong>Nenhum curso cadastrado</strong><span>Os cursos criados aparecerão aqui.</span></div>}</div></> : <><div className="admin-toolbar"><div><strong>Contas cadastradas</strong><span>{users.length} exibidas</span></div><button className="admin-refresh" title="Atualizar contas" aria-label="Atualizar contas" disabled={busy} onClick={() => { setError(""); refresh("users").catch((caught) => setError(caught.message)); }}><RefreshCw size={17} /></button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CONTA</th><th>TIPO</th><th>STATUS</th><th>AÇÃO</th></tr></thead><tbody>{users.map((account) => <tr key={account.uid}><td><div className="table-title">{account.name || account.email || "Sem nome"}</div><div className="table-subtitle">{account.email || account.uid}</div></td><td>{account.admin ? "Administrador" : "Aluno"}</td><td><span className={`status ${account.disabled ? "" : "status-live"}`}>{account.disabled ? "Desativada" : "Ativa"}</span></td><td>{!account.protected && account.uid !== user.uid ? <button className="account-action" disabled={busy} onClick={() => toggleUser(account)}>{account.disabled ? "Reativar" : "Desativar"}</button> : <span className="table-subtitle">Protegida</span>}</td></tr>)}</tbody></table>{users.length === 0 && <div className="admin-empty"><Users size={24} /><strong>Nenhuma conta encontrada</strong></div>}</div>{nextPage && <button className="load-more" disabled={busy} onClick={loadMoreUsers}>Carregar mais contas</button>}</>}
    </main>
    {form && <div className="admin-modal-backdrop" onClick={() => setForm(null)}><div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="course-form-title" onClick={(event) => event.stopPropagation()}><div className="admin-modal-head"><div><span className="admin-kicker">CONTEÚDO</span><h2 id="course-form-title">{editing ? "Editar curso" : "Novo curso"}</h2></div><button className="admin-icon" aria-label="Fechar" onClick={() => setForm(null)}><X size={20} /></button></div><form onSubmit={saveCourse} className="course-form"><label>Nome do curso<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Verb To Be" /></label><label>Descrição<textarea required maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="O que o aluno vai aprender?" /></label><label>Nível<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>{["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => <option key={level}>{level}</option>)}</select></label><label>URL da imagem<input type="url" pattern="https://.*" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." /></label><label>URL da videoaula<input type="url" pattern="https://.*" value={form.videoUrl} onChange={(event) => setForm({ ...form, videoUrl: event.target.value })} placeholder="https://..." /></label><label>URL do material<input type="url" pattern="https://.*" value={form.materialUrl} onChange={(event) => setForm({ ...form, materialUrl: event.target.value })} placeholder="https://..." /></label><label className="publish-check"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Publicar no catálogo</label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="admin-cancel" onClick={() => setForm(null)}>Cancelar</button><button className="button button-small" disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar curso"}</button></div></form></div></div>}
  </div>;
}