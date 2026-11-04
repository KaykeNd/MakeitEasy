"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { PublicBlock } from "@/lib/learning";
import StudyBlocks, { StudyVideo } from "./study-blocks";

type Course = {
  title: string;
  description: string;
  level: string;
  videoUrl: string;
  materialUrl: string;
};
type StudyModule = {
  id: string;
  revision: string;
  title: string;
  content: string;
  videoUrl: string;
  materialUrl: string;
  position: number;
  questions: { prompt: string; options: string[] }[];
  blocks: PublicBlock[];
};
type Result = {
  score: number;
  correct: number;
  total: number;
  feedback: { correct: boolean; correctIndex: number; explanation: string }[];
};
type Attempt = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  score: number;
  correct: number;
  total: number;
  createdAt: number | null;
};

export default function CourseStudy({ courseId }: { courseId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<StudyModule[]>([]);
  const [selected, setSelected] = useState("");
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [results, setResults] = useState<Record<string, Result>>({});
  const [history, setHistory] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (account) => {
      setUser(account);
      setHistory([]);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning?courseId=${encodeURIComponent(courseId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar o curso.");
        setCourse(data.course);
        setModules(data.modules);
        setSelected(data.modules[0]?.id || "");
        setLoading(false);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível carregar o curso.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [courseId]);

  useEffect(() => {
    if (!user || !course) return;
    let active = true;
    user
      .getIdToken()
      .then((token) =>
        fetch(
          `/api/learning?courseId=${encodeURIComponent(courseId)}&history=1`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        ),
      )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Não foi possível carregar o histórico.",
          );
        if (active) {
          setHistory(data.attempts);
          setHistoryError("");
        }
      })
      .catch(() => {
        if (active)
          setHistoryError(
            "Não foi possível carregar o histórico de avaliações.",
          );
      });
    return () => {
      active = false;
    };
  }, [user, course, courseId]);

  const activeModule = modules.find((module) => module.id === selected);
  const result = activeModule ? results[activeModule.id] : undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !activeModule) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          moduleId: activeModule.id,
          revision: activeModule.revision,
          answers: answers[activeModule.id] || [],
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível enviar a avaliação.");
      setResults((current) => ({ ...current, [activeModule.id]: data.result }));
      const historyResponse = await fetch(
        `/api/learning?courseId=${encodeURIComponent(courseId)}&history=1`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (historyResponse.ok) {
        const data = await historyResponse.json();
        setHistory(data.attempts);
        setHistoryError("");
      } else
        setHistoryError(
          "Não foi possível atualizar o histórico de avaliações.",
        );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível enviar a avaliação.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="study-state">Carregando curso...</main>;
  if (!course)
    return (
      <main className="study-state">
        <div>
          <h1>Curso indisponível</h1>
          <p>{error}</p>
          <Link href="/" className="study-back">
            <ArrowLeft size={16} /> Voltar aos cursos
          </Link>
        </div>
      </main>
    );
  const video = !modules.length ? course.videoUrl : "";
  const material = !modules.length ? course.materialUrl : "";

  return (
    <div className="study-app">
      <header className="study-header">
        <Link className="logo" href="/">
          make it <span>easy.</span>
        </Link>
        <Link className="study-back" href="/#cursos">
          <ArrowLeft size={16} /> Todos os cursos
        </Link>
        <span className="study-header-user">{user?.email || "Visitante"}</span>
      </header>
      <div className="study-layout">
        <aside className="study-sidebar">
          <span className="study-kicker">NÍVEL {course.level}</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="study-sidebar-title">
            MÓDULOS <span>{modules.length}</span>
          </div>
          <nav aria-label="Módulos do curso">
            {modules.map((module, index) => (
              <button
                key={module.id}
                className={selected === module.id ? "active" : ""}
                onClick={() => {
                  setSelected(module.id);
                  setError("");
                }}
              >
                <span className="study-step">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  {module.title}
                  <small>
                    {module.questions.length
                      ? `${module.questions.length} questões`
                      : "Aula"}
                  </small>
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <main className="study-main">
          {activeModule ? (
            <>
              <div className="study-breadcrumb">
                {course.title} <span>/</span> Módulo {activeModule.position}
              </div>
              <h2>{activeModule.title}</h2>
              <div className="study-subtitle">
                {activeModule.questions.length
                  ? `${activeModule.questions.length} questões na avaliação`
                  : "Conteúdo do módulo"}
              </div>
            </>
          ) : (
            <>
              <div className="study-breadcrumb">{course.title}</div>
              <h2>Conteúdo do curso</h2>
            </>
          )}
          {video && <StudyVideo url={video} title={course.title} />}
          {material && (
            <a
              className="study-resource"
              href={material}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText size={18} /> Abrir material complementar
            </a>
          )}
          {!activeModule && !video && !material && (
            <p className="study-empty">
              Os módulos deste curso ainda estão em preparação.
            </p>
          )}
          {activeModule && (
            <section className="study-sequence">
              {!activeModule.blocks.length && <p className="study-empty">O conteúdo deste módulo ainda está em preparação.</p>}
              <form onSubmit={submit} className="quiz-form">
                <StudyBlocks blocks={activeModule.blocks} title={activeModule.title} answers={answers[activeModule.id] || []} feedback={result?.feedback} busy={busy} onAnswer={(questionIndex, optionIndex) => setAnswers((current) => { const next = Array.from({ length: activeModule.questions.length }, (_, index) => current[activeModule.id]?.[index] ?? -1); next[questionIndex] = optionIndex; return { ...current, [activeModule.id]: next }; })} />
                {result && <div className="study-score" role="status"><CheckCircle2 size={21} /><div><strong>Resultado: {result.score}%</strong><span>{result.correct} de {result.total} respostas corretas</span></div></div>}
                {error && (
                  <p className="study-error" role="alert">
                    {error}
                  </p>
                )}
                {activeModule.questions.length > 0 && (result ? (
                  <button
                    className="study-outline"
                    type="button"
                    onClick={() => {
                      setResults((current) => {
                        const next = { ...current };
                        delete next[activeModule.id];
                        return next;
                      });
                      setAnswers((current) => ({
                        ...current,
                        [activeModule.id]: [],
                      }));
                    }}
                  >
                    Tentar novamente
                  </button>
                ) : user ? (
                  <button className="button" type="submit" disabled={busy}>
                    {busy ? "Enviando..." : "Enviar respostas"}
                  </button>
                ) : (
                  <Link className="button" href="/">
                    Entre para responder
                  </Link>
                ))}
              </form>
            </section>
          )}
          {user && (
            <section className="study-section">
              <div className="study-section-heading">
                <div>
                  <span className="study-kicker">SEU APRENDIZADO</span>
                  <h3>Histórico de avaliações</h3>
                </div>
              </div>
              {historyError && (
                <p className="study-error" role="alert">
                  {historyError}
                </p>
              )}
              {history.length ? (
                <div className="study-history">
                  {history.map((attempt) => (
                    <div key={attempt.id}>
                      <span>
                        <strong>{attempt.moduleTitle}</strong>
                        <small>
                          {attempt.createdAt
                            ? new Date(attempt.createdAt).toLocaleString(
                                "pt-BR",
                              )
                            : ""}{" "}
                          · {attempt.correct}/{attempt.total} acertos
                        </small>
                      </span>
                      <b>{attempt.score}%</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="study-empty">
                  Você ainda não enviou avaliações neste curso.
                </p>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
