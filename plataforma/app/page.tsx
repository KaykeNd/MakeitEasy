"use client";

import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { ArrowDown, ArrowRight, BookOpen, Check, LogOut, Play, X } from "lucide-react";
import { auth } from "@/lib/firebase";

const courses = [
  { number: "01", name: "Verb To Be", description: "O ponto de partida para se apresentar e descrever o mundo.", label: "SER E ESTAR", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80" },
  { number: "02", name: "Simple Present", description: "Fale sobre hábitos, rotinas e tudo o que acontece sempre.", label: "ROTINA", image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=800&q=80" },
  { number: "03", name: "Present Continuous", description: "Aprenda a falar sobre o que está acontecendo agora.", label: "AGORA", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80" },
  { number: "04", name: "Simple Past", description: "Conte histórias e compartilhe acontecimentos do passado.", label: "PASSADO", image: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=800&q=80" },
  { number: "05", name: "Present Perfect", description: "Conecte experiências do passado com o presente.", label: "EXPERIÊNCIAS", image: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=800&q=80" },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, setUser);
  }, []);

  function openAuth(nextMode: "login" | "signup") {
    setError("");
    setPassword("");
    setMode(nextMode);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) {
      setError("O acesso ainda não foi configurado. Tente novamente mais tarde.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
      setMode(null);
    } catch (caught) {
      const code = typeof caught === "object" && caught !== null && "code" in caught ? String(caught.code) : "";
      setError(code === "auth/email-already-in-use" ? "Este e-mail já está cadastrado." : code === "auth/weak-password" ? "Escolha uma senha com pelo menos 6 caracteres." : code === "auth/invalid-email" ? "Confira o endereço de e-mail." : "Não foi possível acessar. Confira seus dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="header">
        <div className="shell nav">
          <a className="logo" href="#inicio" aria-label="Make it Easy, início">make it <span>easy.</span></a>
          <nav className="nav-links" aria-label="Navegação principal"><a href="#cursos">Cursos</a><a href="#metodo">Nossa maneira</a></nav>
          <div className="nav-actions">{user ? <><span className="user-email">{user.email}</span><button className="text-button" onClick={() => auth && signOut(auth)}><LogOut size={16} /> Sair</button></> : <><button className="text-button" onClick={() => openAuth("login")}>Entrar</button><button className="button button-small" onClick={() => openAuth("signup")}>Criar conta <ArrowRight size={16} /></button></>}</div>
        </div>
      </header>

      <main id="inicio">
        <section className="intro shell">
          <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-dot" /> MAKE IT EASY</div><h1>Inglês no <em>seu ritmo.</em></h1><p>Um passo de cada vez, uma conquista por aula. Comece pelo básico e descubra o prazer de aprender inglês de verdade.</p><div className="intro-actions"><a className="button" href="#cursos">Explorar cursos <ArrowRight size={18} /></a><a className="secondary-link" href="#metodo">Conheça o método <ArrowDown size={16} /></a></div><div className="intro-note"><span className="check-icon"><Check size={14} /></span> Aprenda de onde estiver <span className="note-divider" /> No seu tempo</div></div>
          <div className="intro-image"><img src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=85" alt="Livros abertos e materiais de estudo sobre uma mesa" /><div className="image-label"><span className="play-circle"><Play size={16} fill="currentColor" /></span><span><strong>Um novo jeito de aprender</strong><small>Pequenos passos, grandes descobertas.</small></span></div><span className="image-stamp">LET&apos;S<br />LEARN!</span></div>
        </section>

        <section className="catalog-section" id="cursos"><div className="shell"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> COMECE POR AQUI</div><h2>Seu próximo passo<br /><em>começa aqui.</em></h2></div><p>Uma base sólida muda tudo. Explore os assuntos essenciais para começar a se expressar em inglês.</p></div><div className="catalog-bar"><div><span className="active-tab">Todos os cursos</span><span className="course-count">05 assuntos</span></div><span className="level-tag">NÍVEL BÁSICO · A1</span></div><div className="course-grid">{courses.map((course) => <article className="course" key={course.number}><div className="course-image"><img src={course.image} alt="" /><span className="course-number">{course.number} / 05</span><span className="course-topic">{course.label}</span></div><div className="course-content"><div className="course-level"><span /> INICIANTE · A1</div><h3>{course.name}</h3><p>{course.description}</p><div className="course-bottom"><span><BookOpen size={15} /> Em preparação</span></div></div></article>)}</div></div></section>

        <section className="method shell" id="metodo"><div><div className="eyebrow"><span className="eyebrow-dot" /> NOSSA MANEIRA</div><h2>Feito para a vida real.<br /><em>Do seu jeito.</em></h2></div><div className="method-copy"><p>Aprender um idioma não precisa ser complicado. Aqui, cada assunto é uma oportunidade de construir confiança, no seu próprio ritmo.</p><div className="method-points"><span><Check size={16} /> Conteúdo por assunto</span><span><Check size={16} /> Aprendizado no seu ritmo</span><span><Check size={16} /> Para estudar onde estiver</span></div></div></section>
      </main>
      <footer><div className="shell footer-inner"><a className="logo" href="#inicio">make it <span>easy.</span></a><p>Inglês para a vida, um passo de cada vez.</p><span>© Make it Easy</span></div></footer>

      {mode && <div className="modal-backdrop" onClick={() => setMode(null)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(event) => event.stopPropagation()}><button className="close-button" aria-label="Fechar" onClick={() => setMode(null)}><X size={20} /></button><div className="eyebrow"><span className="eyebrow-dot" /> MAKE IT EASY</div><h2 id="auth-title">{mode === "login" ? "Que bom ter você de volta." : "Vamos começar?"}</h2><p>{mode === "login" ? "Entre na sua conta para continuar." : "Crie sua conta e comece sua jornada."}</p><form onSubmit={submit}><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />{error && <p className="form-error" role="alert">{error}</p>}<button className="button form-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"} <ArrowRight size={17} /></button></form><p className="auth-switch">{mode === "login" ? "Ainda não tem conta?" : "Já tem uma conta?"} <button onClick={() => openAuth(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Cadastre-se" : "Entre"}</button></p></div></div>}
    </>
  );
}
