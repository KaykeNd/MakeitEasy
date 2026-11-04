"use client";

import { FileText, PlayCircle } from "lucide-react";
import type { PublicBlock } from "@/lib/learning";

type Feedback = { correct: boolean; correctIndex: number; explanation: string };

function embedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/")[1] || "";
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) id = url.searchParams.get("v") || (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : "") || "";
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const videoId = url.pathname.split("/").filter(Boolean).pop();
      if (videoId && /^\d+$/.test(videoId)) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch { return ""; }
  return "";
}

export function StudyVideo({ url, title }: { url: string; title: string }) {
  const embed = embedUrl(url);
  return <div className="study-block-video">{embed && <div className="study-video"><iframe src={embed} title={`Videoaula ${title}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>}<a className="study-resource" href={url} target="_blank" rel="noopener noreferrer"><PlayCircle size={18} /> Abrir videoaula</a></div>;
}

export default function StudyBlocks({ blocks, title, answers, feedback, busy, onAnswer }: { blocks: PublicBlock[]; title: string; answers: number[]; feedback?: Feedback[]; busy: boolean; onAnswer: (questionIndex: number, optionIndex: number) => void }) {
  const questions = blocks.filter((block) => block.type === "question");
  return <div className="study-blocks">{blocks.map((block) => {
    if (block.type === "text") return <div className="study-content study-block-text" key={block.id}>{block.text}</div>;
    if (block.type === "image") return <figure className="study-image" key={block.id}><img src={block.url} alt={block.alt} loading="lazy" /></figure>;
    if (block.type === "video") return <StudyVideo key={block.id} url={block.url} title={title} />;
    if (block.type === "material") return <a className="study-resource study-block-material" key={block.id} href={block.url} target="_blank" rel="noopener noreferrer"><FileText size={18} /> Abrir material complementar</a>;
    const questionIndex = questions.findIndex((question) => question.id === block.id);
    const correction = feedback?.[questionIndex];
    return <fieldset className="quiz-question" key={block.id}><legend><span>{String(questionIndex + 1).padStart(2, "0")}</span> {block.question.prompt}</legend>{block.question.options.map((option, optionIndex) => <label className={`quiz-option ${correction && correction.correctIndex === optionIndex ? "correct" : ""}`} key={optionIndex}><input type="radio" required name={`question-${block.id}`} value={optionIndex} disabled={Boolean(feedback) || busy} checked={answers[questionIndex] === optionIndex} onChange={() => onAnswer(questionIndex, optionIndex)} />{option}</label>)}{correction && <div className={`quiz-feedback ${correction.correct ? "is-correct" : ""}`}><strong>{correction.correct ? "Resposta correta" : `Resposta correta: ${block.question.options[correction.correctIndex]}`}</strong>{correction.explanation && <p>{correction.explanation}</p>}</div>}</fieldset>;
  })}</div>;
}