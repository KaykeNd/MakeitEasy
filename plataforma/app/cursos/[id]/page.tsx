import { Suspense } from "react";
import CourseStudy from "./study";
import "./study.css";

async function CourseContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseStudy courseId={id} />;
}

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="study-state">Carregando curso...</main>}><CourseContent params={params} /></Suspense>;
}