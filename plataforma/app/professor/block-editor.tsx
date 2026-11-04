"use client";

import { ArrowDown, ArrowUp, FileText, GripVertical, Image as ImageIcon, PlayCircle, Plus, Trash2, Type, X, CircleHelp } from "lucide-react";
import { DndContext, pointerWithin, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useState, type ReactNode } from "react";
import { reorderBlocks, type ContentBlock, type Question } from "@/lib/learning";

type BlockType = ContentBlock["type"];
const labels: Record<BlockType, string> = { text: "Texto", image: "Imagem", video: "Videoaula", material: "Material", question: "Questão" };

function SortableBlock({ block, index, pending, onMove, children }: { block: ContentBlock; index: number; pending: boolean; onMove: (direction: -1 | 1) => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return <fieldset ref={setNodeRef} className={`block-card${pending ? " block-card-pending" : ""}${isDragging ? " block-card-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <legend>{String(index + 1).padStart(2, "0")} · {labels[block.type]}</legend>
    <button ref={setActivatorNodeRef} type="button" className="block-drag" {...attributes} {...listeners} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1); } }} title="Segure por 3 segundos para arrastar" aria-label={`Arrastar ${labels[block.type]} ${index + 1}`}><GripVertical size={18} /></button>
    {children}
  </fieldset>;
}

export default function BlockEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void }) {
  const questionCount = blocks.filter((block) => block.type === "question").length;
  const dragContextId = useId();
  const [announcement, setAnnouncement] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 3000, tolerance: 8 } }));

  function add(type: BlockType) {
    const id = crypto.randomUUID();
    let block: ContentBlock;
    if (type === "text") block = { id, type, text: "" };
    else if (type === "image") block = { id, type, url: "", alt: "" };
    else if (type === "question") block = { id, type, question: { prompt: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" } };
    else block = { id, type, url: "" };
    onChange([...blocks, block]);
  }

  function update(id: string, next: ContentBlock) {
    onChange(blocks.map((block) => block.id === id ? next : block));
  }

  function move(index: number, destination: number) {
    const reordered = reorderBlocks(blocks, index, destination);
    if (reordered !== blocks) {
      onChange(reordered);
      setAnnouncement(`${labels[blocks[index].type]} movido para a posição ${destination + 1}.`);
    }
  }

  function dragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const source = blocks.findIndex((block) => block.id === event.active.id);
    const destination = blocks.findIndex((block) => block.id === event.over?.id);
    move(source, destination);
  }

  function updateQuestion(block: Extract<ContentBlock, { type: "question" }>, patch: Partial<Question>) {
    update(block.id, { ...block, question: { ...block.question, ...patch } });
  }

  return <section className="block-editor" aria-labelledby="blocks-heading">
    <div className="questions-heading"><div><strong id="blocks-heading">Conteúdo do módulo</strong><span>{blocks.length} de 100 blocos · {questionCount} de 25 questões</span></div></div>
    <div className="block-toolbar" role="group" aria-label="Adicionar conteúdo">
      <button type="button" disabled={blocks.length >= 100} onClick={() => add("text")}><Type size={15} /> Texto</button>
      <button type="button" disabled={blocks.length >= 100} onClick={() => add("image")}><ImageIcon size={15} /> Imagem</button>
      <button type="button" disabled={blocks.length >= 100} onClick={() => add("video")}><PlayCircle size={15} /> Vídeo</button>
      <button type="button" disabled={blocks.length >= 100} onClick={() => add("material")}><FileText size={15} /> Material</button>
      <button type="button" disabled={blocks.length >= 100 || questionCount >= 25} onClick={() => add("question")}><Plus size={15} /> Questão</button>
    </div>
    {!blocks.length && <div className="block-empty">Adicione o primeiro conteúdo do módulo.</div>}
    <DndContext id={dragContextId} sensors={sensors} collisionDetection={pointerWithin} onDragPending={({ id }) => setPendingId(String(id))} onDragAbort={() => setPendingId(null)} onDragStart={() => setPendingId(null)} onDragCancel={() => setPendingId(null)} onDragEnd={(event) => { setPendingId(null); dragEnd(event); }} accessibility={{ screenReaderInstructions: { draggable: "Use as setas para cima ou para baixo para mover o bloco." }, announcements: { onDragStart: () => "Bloco selecionado.", onDragOver: ({ over }) => over ? `Movendo para a posição ${blocks.findIndex((block) => block.id === over.id) + 1}.` : "Fora da lista.", onDragEnd: ({ over }) => over ? `Bloco movido para a posição ${blocks.findIndex((block) => block.id === over.id) + 1}.` : "Movimentação cancelada.", onDragCancel: () => "Movimentação cancelada." } }}><SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}><div className="block-list">{blocks.map((block, index) => <SortableBlock block={block} index={index} pending={pendingId === block.id} onMove={(direction) => move(index, index + direction)} key={block.id}>
      <div className="block-actions"><label htmlFor={`position-${block.id}`}>Posição<select id={`position-${block.id}`} aria-label={`Posição de ${labels[block.type]} ${index + 1}`} value={index + 1} disabled={blocks.length < 2} onChange={(event) => move(index, Number(event.target.value) - 1)}>{blocks.map((position, positionIndex) => <option key={position.id} value={positionIndex + 1}>{positionIndex + 1}</option>)}</select></label><button type="button" title="Mover para cima" aria-label={`Mover ${labels[block.type]} ${index + 1} para cima`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={16} /></button><button type="button" title="Mover para baixo" aria-label={`Mover ${labels[block.type]} ${index + 1} para baixo`} disabled={index === blocks.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={16} /></button><button type="button" title="Excluir bloco" aria-label={`Excluir ${labels[block.type]} ${index + 1}`} onClick={() => { if (window.confirm(`Excluir este bloco de ${labels[block.type].toLowerCase()}?`)) onChange(blocks.filter((current) => current.id !== block.id)); }}><Trash2 size={16} /></button></div>
      {block.type === "text" && <label>Texto e exemplos<textarea required rows={5} maxLength={10000} value={block.text} onChange={(event) => update(block.id, { ...block, text: event.target.value })} placeholder="Escreva o conteúdo da aula." /></label>}
      {block.type === "image" && <><label>Link da imagem<input required type="url" pattern="https://.*" value={block.url} onChange={(event) => update(block.id, { ...block, url: event.target.value })} placeholder="https://..." /></label><label>Descrição da imagem<input maxLength={200} value={block.alt} onChange={(event) => update(block.id, { ...block, alt: event.target.value })} placeholder="Descreva a imagem para acessibilidade" /></label></>}
      {(block.type === "video" || block.type === "material") && <label>{block.type === "video" ? "Link da videoaula" : "Link do material"}<input required type="url" pattern="https://.*" value={block.url} onChange={(event) => update(block.id, { ...block, url: event.target.value })} placeholder="https://..." /></label>}
      {block.type === "question" && <><label>Pergunta<textarea required rows={2} maxLength={1000} value={block.question.prompt} onChange={(event) => updateQuestion(block, { prompt: event.target.value })} /></label><span className="answer-label">Alternativas · selecione a correta</span>{block.question.options.map((option, optionIndex) => <div className="option-editor" key={optionIndex}><input type="radio" name={`correct-${block.id}`} aria-label={`Alternativa correta ${optionIndex + 1}`} checked={block.question.correctIndex === optionIndex} onChange={() => updateQuestion(block, { correctIndex: optionIndex })} /><input type="text" required maxLength={500} aria-label={`Alternativa ${optionIndex + 1} da questão ${index + 1}`} value={option} onChange={(event) => updateQuestion(block, { options: block.question.options.map((current, currentIndex) => currentIndex === optionIndex ? event.target.value : current) })} /><button type="button" title="Remover alternativa" aria-label={`Remover alternativa ${optionIndex + 1}`} disabled={block.question.options.length <= 2} onClick={() => updateQuestion(block, { options: block.question.options.filter((_, currentIndex) => currentIndex !== optionIndex), correctIndex: block.question.correctIndex === optionIndex ? 0 : block.question.correctIndex > optionIndex ? block.question.correctIndex - 1 : block.question.correctIndex })}><X size={15} /></button></div>)}<button type="button" className="teacher-link add-option" disabled={block.question.options.length >= 6} onClick={() => updateQuestion(block, { options: [...block.question.options, ""] })}><Plus size={14} /> Alternativa</button><label>Explicação da resposta<textarea rows={2} maxLength={1000} value={block.question.explanation} onChange={(event) => updateQuestion(block, { explanation: event.target.value })} placeholder="Explique o gabarito para o aluno." /></label></>}
    </SortableBlock>)}</div></SortableContext></DndContext>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    <span className="block-hint"><CircleHelp size={14} /> As questões são corrigidas juntas ao final do módulo.</span>
  </section>;
}