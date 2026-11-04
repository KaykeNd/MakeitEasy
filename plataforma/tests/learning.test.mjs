import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestions, parseBlocks, parseModule, publicBlocks, publicModule, reorderBlocks } from "../lib/learning.ts";

const question = { prompt: "I ___ happy.", options: ["am", "is", "are"], correctIndex: 0, explanation: "Use am with I." };
const lessonModule = { courseId: "course1", title: "Introdução", content: "Conteúdo", videoUrl: "", materialUrl: "https://example.com/material.pdf", position: 1, questions: [question] };

test("valida o módulo e remove o gabarito da versão pública", () => {
  const parsed = parseModule(lessonModule);
  assert.ok(parsed);
  assert.deepEqual(publicModule(parsed).questions, [{ prompt: question.prompt, options: question.options }]);
  assert.deepEqual(parsed.blocks.map((block) => block.type), ["text", "material", "question"]);
  const withVideo = parseModule({ ...lessonModule, videoUrl: "https://example.com/video" });
  assert.deepEqual(withVideo.blocks.map((block) => block.type), ["video", "text", "material", "question"]);
  assert.equal(withVideo.blocks[0].url, "https://example.com/video");
  assert.equal(withVideo.blocks[1].text, lessonModule.content);
  assert.equal(withVideo.blocks[2].url, lessonModule.materialUrl);
  assert.deepEqual(withVideo.blocks[3].question, question);
  assert.equal(parseModule({ ...lessonModule, videoUrl: "javascript:alert(1)" }), null);
  assert.equal(parseModule({ ...lessonModule, questions: [{ ...question, correctIndex: 8 }] }), null);
  assert.equal(parseModule({ ...lessonModule, questions: [{ ...question, options: ["am", "AM"] }] }), null);
});

test("corrige respostas e recusa avaliações incompletas", () => {
  assert.equal(gradeQuestions([question], [0]).score, 100);
  const wrong = gradeQuestions([question], [1]);
  assert.equal(wrong.score, 0);
  assert.equal(wrong.feedback[0].correctIndex, 0);
  assert.equal(wrong.feedback[0].explanation, question.explanation);
  assert.equal(gradeQuestions([question], []), null);
  assert.equal(gradeQuestions([question], [3]), null);
});

test("valida blocos na ordem escolhida sem expor o gabarito", () => {
  const blocks = parseBlocks([{ id: "image1", type: "image", url: "https://example.com/image.jpg", alt: "Uma imagem" }, { id: "q1", type: "question", question }, { id: "video1", type: "video", url: "https://youtube.com/watch?v=example" }, { id: "q2", type: "question", question }]);
  assert.ok(blocks);
  assert.deepEqual(blocks.map((block) => block.type), ["image", "question", "video", "question"]);
  assert.deepEqual(publicBlocks(blocks)[1], { id: "q1", type: "question", question: { prompt: question.prompt, options: question.options } });
  const parsed = parseModule({ courseId: "course1", title: "Aula", position: 1, blocks });
  assert.deepEqual(parsed.blocks.map((block) => block.type), ["image", "question", "video", "question"]);
  assert.deepEqual(parsed.questions, [question, question]);
  assert.equal(parseBlocks([{ id: "x", type: "image", url: "javascript:alert(1)", alt: "" }]), null);
  assert.equal(parseBlocks([{ id: "x", type: "text", text: "a" }, { id: "x", type: "text", text: "b" }]), null);
});

test("reordena blocos sem perder conteúdo ou modificar a sequência original", () => {
  const blocks = [{ id: "one", type: "text", text: "Primeiro" }, { id: "two", type: "question", question }, { id: "three", type: "video", url: "https://example.com/video" }];
  const moved = reorderBlocks(blocks, 2, 0);
  assert.deepEqual(moved.map((block) => block.id), ["three", "one", "two"]);
  assert.deepEqual(blocks.map((block) => block.id), ["one", "two", "three"]);
  assert.deepEqual(reorderBlocks(moved, 0, 2).map((block) => block.id), ["one", "two", "three"]);
  assert.equal(reorderBlocks(blocks, 0, 3), blocks);
  assert.equal(reorderBlocks(blocks, -1, 0), blocks);
});