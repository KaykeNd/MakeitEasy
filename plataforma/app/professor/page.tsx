"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import type { ContentBlock, ModuleData } from "@/lib/learning";
import BlockEditor from "./block-editor";
import "../admin/admin.css";
import "./teacher.css";

type Course = { id: string; title: string; level: string; published: boolean };
type Module = ModuleData & { id: string };
type Result = {
  id: string;
  email: string;
  courseTitle: string;
  moduleTitle: string;
  score: number;
  correct: number;
  total: number;
  createdAt: number | null;
};

function editorBlocks(form: ModuleData): ContentBlock[] {
  if (form.blocks) return form.blocks;
  const blocks: ContentBlock[] = [];
  if (form.videoUrl) blocks.push({ id: "legacy-video", type: "video", url: form.videoUrl });
  if (form.content) blocks.push({ id: "legacy-text", type: "text", text: form.content });
  if (form.materialUrl) blocks.push({ id: "legacy-material", type: "material", url: form.materialUrl });
  form.questions.forEach((question, index) => blocks.push({ id: `legacy-question-${index}`, type: "question", question }));
  return blocks;
}

export default function TeacherPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(auth));
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">(
    "checking",
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [tab, setTab] = useState<"modules" | "results">("modules");
  const [form, setForm] = useState<ModuleData | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (account) => {
      setUser(account);
      setAccess("checking");
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      try {
        const token = await user!.getIdToken();
        const response = await fetch("/api/admin?resource=courses", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Não foi possível verificar o acesso.");
        if (active) {
          setCourses(data.courses);
          setSelected(data.courses[0]?.id || "");
          setAccess("allowed");
          setError("");
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível verificar o acesso.",
          );
          setAccess("denied");
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || access !== "allowed" || (tab === "modules" && !selected))
      return;
    let active = true;
    async function load() {
      try {
        const token = await user!.getIdToken();
        const path =
          tab === "modules"
            ? `/api/teacher?courseId=${encodeURIComponent(selected)}`
            : "/api/admin?resource=results";
        const response = await fetch(path, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar os dados.");
        if (active) {
          if (tab === "modules") setModules(data.modules);
          else setResults(data.results);
          setError("");
          setLoading(false);
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível carregar os dados.",
          );
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [user, access, selected, tab]);

  async function request(method: string, body?: unknown) {
    if (!user) throw new Error("Faça login para continuar.");
    const token = await user.getIdToken();
    const response = await fetch(
      `/api/teacher?courseId=${encodeURIComponent(selected)}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Não foi possível concluir a operação.");
    return data;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("POST", {
        module: { ...form, blocks: editorBlocks(form) },
        ...(editing ? { id: editing } : {}),
      });
      const data = await request("GET");
      setModules(data.modules);
      setForm(null);
      setEditing(null);
      setNotice("Módulo salvo com sucesso.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar o módulo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(module: Module) {
    if (!window.confirm(`Excluir o módulo “${module.title}” e suas questões?`))
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("DELETE", { id: module.id, courseId: selected });
      const data = await request("GET");
      setModules(data.modules);
      setNotice("Módulo excluído.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível excluir o módulo.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking || (user && access === "checking"))
    return <main className="admin-state">Verificando acesso...</main>;
  if (!user || access === "denied")
    return (
      <main className="admin-state">
        <div>
          <GraduationCap size={30} />
          <h1>Área do professor</h1>
          <p>
            {user ? error : "Entre com uma conta de professor para continuar."}
          </p>
          <Link className="button" href="/">
            Voltar ao início <ArrowLeft size={16} />
          </Link>
        </div>
      </main>
    );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="logo" href="/">
          make it <span>easy.</span>
        </Link>
        <span className="admin-sidebar-label">ÁREA DO PROFESSOR</span>
        <nav aria-label="Menu do professor">
          <button
            className={tab === "modules" ? "selected" : ""}
            onClick={() => {
              if (tab !== "modules") {
                setTab("modules");
                setLoading(Boolean(selected));
                setNotice("");
              }
            }}
          >
            <BookOpen size={18} /> Módulos
          </button>
          <button
            className={tab === "results" ? "selected" : ""}
            onClick={() => {
              if (tab !== "results") {
                setTab("results");
                setLoading(true);
                setNotice("");
              }
            }}
          >
            <BarChart3 size={18} /> Resultados
          </button>
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/admin">
            <ExternalLink size={16} /> Cursos e contas
          </Link>
          <Link href="/">
            <ArrowLeft size={16} /> Voltar ao site
          </Link>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-top">
          <div>
            <span className="admin-kicker">ENSINO</span>
            <h1>{tab === "modules" ? "Área do professor" : "Resultados"}</h1>
            <p>
              {tab === "modules"
                ? "Organize suas aulas e avaliações por módulo."
                : "Acompanhe as avaliações enviadas pelos alunos."}
            </p>
          </div>
          <div className="admin-identity">
            <span>{user.email}</span>
            <div className="avatar">
              {(user.email || "P").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        {error && (
          <div className="admin-alert" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            {notice}
          </div>
        )}
        {tab === "modules" ? (
          <>
            <div className="teacher-select">
              <label htmlFor="course-select">Curso</label>
              <div>
                <select
                  id="course-select"
                  value={selected}
                  onChange={(event) => {
                    setSelected(event.target.value);
                    setModules([]);
                    setLoading(Boolean(event.target.value));
                    setError("");
                    setNotice("");
                  }}
                >
                  {courses.length === 0 && (
                    <option value="">Nenhum curso cadastrado</option>
                  )}
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} · {course.level}
                      {course.published ? "" : " · Rascunho"}
                    </option>
                  ))}
                </select>
                <Link href="/admin" className="teacher-link">
                  Gerenciar cursos <ExternalLink size={14} />
                </Link>
              </div>
            </div>
            <div className="admin-toolbar">
              <div>
                <strong>Módulos</strong>
                <span>
                  {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
                </span>
              </div>
              <button
                className="button button-small"
                disabled={!selected || loading}
                onClick={() => {
                  setEditing(null);
                  setError("");
                  setForm({
                    courseId: selected,
                    title: "",
                    content: "",
                    videoUrl: "",
                    materialUrl: "",
                    position: Math.min(
                      999,
                      Math.max(0, ...modules.map((module) => module.position)) +
                        1,
                    ),
                    questions: [],
                    blocks: [],
                  });
                }}
              >
                <Plus size={16} /> Novo módulo
              </button>
            </div>
            {loading ? (
              <div className="teacher-empty">Carregando módulos...</div>
            ) : modules.length ? (
              <div className="teacher-list">
                {modules.map((module) => (
                  <article className="teacher-row" key={module.id}>
                    <span className="module-number">
                      {String(module.position).padStart(2, "0")}
                    </span>
                    <div className="teacher-row-info">
                      <strong>{module.title}</strong>
                      <span>
                        {module.questions.length}{" "}
                        {module.questions.length === 1 ? "questão" : "questões"}
                        {module.videoUrl ? " · Videoaula" : ""}
                        {module.materialUrl ? " · Material" : ""}
                      </span>
                    </div>
                    <div className="table-actions">
                      <button
                        title="Editar módulo"
                        aria-label={`Editar ${module.title}`}
                        onClick={() => {
                          const { id, ...data } = module;
                          setEditing(id);
                          setForm(data);
                          setError("");
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        title="Excluir módulo"
                        aria-label={`Excluir ${module.title}`}
                        disabled={busy}
                        onClick={() => remove(module)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="teacher-empty">
                <ClipboardList size={25} />
                <strong>
                  {selected
                    ? "Nenhum módulo neste curso"
                    : "Crie um curso para começar"}
                </strong>
                <span>
                  {selected
                    ? "Adicione aulas e questões para seus alunos."
                    : "Os cursos são cadastrados no painel de cursos e contas."}
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="admin-toolbar">
              <div>
                <strong>Avaliações recebidas</strong>
                <span>Últimas {results.length}</span>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ALUNO</th>
                    <th>CURSO / MÓDULO</th>
                    <th>ACERTOS</th>
                    <th>NOTA</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td>
                        <div className="table-title">
                          {result.email || "Aluno"}
                        </div>
                        <div className="table-subtitle">
                          {result.createdAt
                            ? new Date(result.createdAt).toLocaleString("pt-BR")
                            : ""}
                        </div>
                      </td>
                      <td>
                        <div className="table-title">{result.courseTitle}</div>
                        <div className="table-subtitle">
                          {result.moduleTitle}
                        </div>
                      </td>
                      <td>
                        {result.correct}/{result.total}
                      </td>
                      <td>
                        <span className="status status-live">
                          {result.score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!results.length && (
                <div className="admin-empty">
                  <BarChart3 size={24} />
                  <strong>
                    {loading
                      ? "Carregando resultados..."
                      : "Nenhuma avaliação enviada"}
                  </strong>
                </div>
              )}
            </div>
          </>
        )}
      </main>
      {form && (
        <div
          className="admin-modal-backdrop"
          onClick={() => !busy && setForm(null)}
        >
          <div
            className="admin-modal teacher-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="module-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <span className="admin-kicker">CONTEÚDO DO CURSO</span>
                <h2 id="module-title">
                  {editing ? "Editar módulo" : "Novo módulo"}
                </h2>
              </div>
              <button
                className="admin-icon"
                type="button"
                aria-label="Fechar"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form className="course-form" onSubmit={save}>
              <div className="teacher-form-grid">
                <label>
                  Nome do módulo
                  <input
                    required
                    maxLength={120}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="Ex.: Primeiros passos"
                  />
                </label>
                <label>
                  Ordem
                  <input
                    type="number"
                    required
                    min={1}
                    max={999}
                    value={form.position}
                    onChange={(event) =>
                      setForm({ ...form, position: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <BlockEditor blocks={editorBlocks(form)} onChange={(blocks) => setForm({ ...form, blocks })} />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="admin-cancel"
                  disabled={busy}
                  onClick={() => setForm(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button button-small"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Salvando..." : "Salvar módulo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
