export type Question = { prompt: string; options: string[]; correctIndex: number; explanation: string };
export type ModuleData = { courseId: string; title: string; content: string; videoUrl: string; materialUrl: string; position: number; questions: Question[]; blocks: ContentBlock[] };
export type ContentBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "video"; url: string }
  | { id: string; type: "material"; url: string }
  | { id: string; type: "question"; question: Question };
export type PublicBlock = Exclude<ContentBlock, { type: "question" }> | { id: string; type: "question"; question: Pick<Question, "prompt" | "options"> };

export function reorderBlocks(blocks: ContentBlock[], source: number, destination: number): ContentBlock[] {
  if (!Number.isInteger(source) || !Number.isInteger(destination) || source < 0 || destination < 0 || source >= blocks.length || destination >= blocks.length || source === destination) return blocks;
  const reordered = [...blocks];
  const [block] = reordered.splice(source, 1);
  reordered.splice(destination, 0, block);
  return reordered;
}

export function validDocumentId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function httpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function parseModule(value: unknown): ModuleData | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!validDocumentId(input.courseId) || typeof input.title !== "string" || !input.title.trim() || input.title.length > 120 || !Number.isInteger(input.position) || (input.position as number) < 1 || (input.position as number) > 999) return null;
  if (input.blocks !== undefined) {
    const blocks = parseBlocks(input.blocks);
    if (!blocks) return null;
    const text = blocks.filter((block) => block.type === "text").map((block) => block.text).join("\n\n");
    const video = blocks.find((block) => block.type === "video");
    const material = blocks.find((block) => block.type === "material");
    const questions = blocks.flatMap((block) => block.type === "question" ? [block.question] : []);
    return { courseId: input.courseId, title: input.title.trim(), content: text, videoUrl: video?.url || "", materialUrl: material?.url || "", position: input.position as number, questions, blocks };
  }
  if (typeof input.content !== "string" || input.content.length > 10000 || !httpsUrl(input.videoUrl) || !httpsUrl(input.materialUrl) || !Array.isArray(input.questions) || input.questions.length > 25) return null;
  const questions: Question[] = [];
  for (const item of input.questions) {
    if (!item || typeof item !== "object") return null;
    const question = item as Record<string, unknown>;
    if (typeof question.prompt !== "string" || !question.prompt.trim() || question.prompt.length > 1000 || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6 || !question.options.every((option) => typeof option === "string" && option.trim().length > 0 && option.length <= 500) || !Number.isInteger(question.correctIndex) || (question.correctIndex as number) < 0 || (question.correctIndex as number) >= question.options.length || typeof question.explanation !== "string" || question.explanation.length > 1000) return null;
    const options = question.options.map((option: string) => option.trim());
    if (new Set(options.map((option: string) => option.toLocaleLowerCase())).size !== options.length) return null;
    questions.push({ prompt: question.prompt.trim(), options, correctIndex: question.correctIndex as number, explanation: question.explanation.trim() });
  }
  const blocks: ContentBlock[] = [];
  if (input.videoUrl) blocks.push({ id: "legacy-video", type: "video", url: input.videoUrl });
  if (input.content.trim()) blocks.push({ id: "legacy-text", type: "text", text: input.content.trim() });
  if (input.materialUrl) blocks.push({ id: "legacy-material", type: "material", url: input.materialUrl });
  questions.forEach((question, index) => blocks.push({ id: `legacy-question-${index}`, type: "question", question }));
  return { courseId: input.courseId, title: input.title.trim(), content: input.content.trim(), videoUrl: input.videoUrl, materialUrl: input.materialUrl, position: input.position as number, questions, blocks };
}

export function publicModule(module: ModuleData) {
  return { title: module.title, content: module.content, videoUrl: module.videoUrl, materialUrl: module.materialUrl, position: module.position, questions: module.questions.map(({ prompt, options }) => ({ prompt, options })), blocks: publicBlocks(module.blocks) };
}

export function gradeQuestions(questions: Question[], answers: unknown) {
  if (!questions.length || !Array.isArray(answers) || answers.length !== questions.length || !answers.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < questions[index].options.length)) return null;
  const feedback = questions.map((question, index) => ({ correct: answers[index] === question.correctIndex, correctIndex: question.correctIndex, explanation: question.explanation }));
  const correct = feedback.filter((answer) => answer.correct).length;
  return { correct, total: questions.length, score: Math.round(correct * 100 / questions.length), feedback };
}

export function parseBlocks(value: unknown): ContentBlock[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const blocks: ContentBlock[] = [];
  const ids = new Set<string>();
  let questionCount = 0;
  let contentLength = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const block = item as Record<string, unknown>;
    if (!validDocumentId(block.id) || ids.has(block.id)) return null;
    ids.add(block.id);
    if (block.type === "text") {
      if (typeof block.text !== "string" || !block.text.trim() || block.text.length > 10000) return null;
      contentLength += block.text.length;
      blocks.push({ id: block.id, type: "text", text: block.text.trim() });
    } else if (block.type === "image") {
      if (!httpsUrl(block.url) || !block.url || typeof block.alt !== "string" || block.alt.length > 200) return null;
      contentLength += block.url.length + block.alt.length;
      blocks.push({ id: block.id, type: "image", url: block.url, alt: block.alt.trim() });
    } else if (block.type === "video" || block.type === "material") {
      if (!httpsUrl(block.url) || !block.url) return null;
      contentLength += block.url.length;
      blocks.push({ id: block.id, type: block.type, url: block.url });
    } else if (block.type === "question") {
      if (!block.question || typeof block.question !== "object" || ++questionCount > 25) return null;
      const question = block.question as Record<string, unknown>;
      if (typeof question.prompt !== "string" || !question.prompt.trim() || question.prompt.length > 1000 || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6 || !question.options.every((option) => typeof option === "string" && option.trim().length > 0 && option.length <= 500) || !Number.isInteger(question.correctIndex) || (question.correctIndex as number) < 0 || (question.correctIndex as number) >= question.options.length || typeof question.explanation !== "string" || question.explanation.length > 1000) return null;
      const options = question.options.map((option: string) => option.trim());
      if (new Set(options.map((option: string) => option.toLocaleLowerCase())).size !== options.length) return null;
      contentLength += question.prompt.length + question.explanation.length + options.reduce((total: number, option: string) => total + option.length, 0);
      blocks.push({ id: block.id, type: "question", question: { prompt: question.prompt.trim(), options, correctIndex: question.correctIndex as number, explanation: question.explanation.trim() } });
    } else return null;
  }
  return contentLength <= 200000 ? blocks : null;
}

export function publicBlocks(blocks: ContentBlock[]): PublicBlock[] {
  return blocks.map((block) => block.type === "question" ? { id: block.id, type: block.type, question: { prompt: block.question.prompt, options: block.question.options } } : block);
}