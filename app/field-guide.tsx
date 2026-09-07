"use client";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  Clock,
  Search,
} from "lucide-react";
import lessons from "../data/learning-content.json";
import { objectInput, useAgentTools } from "./webmcp";
type Progress = { completed: string[]; bookmarks: string[]; last: string };
const empty: Progress = { completed: [], bookmarks: [], last: "" };
const validIds = new Set(lessons.map((l) => l.id));
function NumbersLab({ id }: { id: string }) {
  const [a, setA] = useState(
      id === "ground-mounting" ? 30 : id === "battery-backup" ? 500 : 400,
    ),
    [b, setB] = useState(
      id === "ground-mounting" ? 20 : id === "battery-backup" ? 8 : 10,
    );
  const ground = id === "ground-mounting",
    battery = id === "battery-backup";
  if (!["ground-mounting", "battery-backup", "panels-and-strings"].includes(id))
    return null;
  const result = ground
    ? (1.722 * Math.sin((a * Math.PI) / 180)) / Math.tan((b * Math.PI) / 180)
    : battery
      ? (a * b) / 1000 / 0.8 / 0.92
      : (a * b) / 1000;
  return (
    <section className="s4-numbers-lab">
      <div className="s4-kicker">TRY THE NUMBERS</div>
      <h3>
        {ground
          ? "How much room does the shadow need?"
          : battery
            ? "How much nominal storage?"
            : "How large is your array?"}
      </h3>
      <div className="s4-form-grid">
        <label>
          {ground
            ? "Panel tilt (°)"
            : battery
              ? "Average load (W)"
              : "Module rating (W)"}
          <input
            type="range"
            min={ground ? 0 : battery ? 50 : 100}
            max={ground ? 60 : battery ? 2000 : 700}
            step={ground ? 1 : 50}
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
          />
          <b>{a}</b>
        </label>
        <label>
          {ground
            ? "Design sun altitude (°)"
            : battery
              ? "Backup duration (hours)"
              : "Number of modules"}
          <input
            type="range"
            min={ground ? 5 : 1}
            max={ground ? 60 : battery ? 24 : 40}
            value={b}
            onChange={(e) => setB(Number(e.target.value))}
          />
          <b>{b}</b>
        </label>
      </div>
      <output>
        {result.toFixed(2)}{" "}
        <small>
          {ground
            ? "m clear row gap"
            : battery
              ? "kWh nominal battery capacity"
              : "kW DC nameplate"}
        </small>
      </output>
      <p className="s4-fine">
        {ground
          ? "For a 1.722 m module: rise ÷ tan(sun altitude). This simplified section assumes level ground and sun perpendicular to the rows; it does not guarantee year-round shade clearance."
          : battery
            ? "Average load × hours ÷ 1,000 ÷ 0.80 usable fraction ÷ 0.92 efficiency. Starting surge and inverter power need separate checks."
            : "Module watts × module count ÷ 1,000. Nameplate power is not a prediction of continuous output or annual energy."}
      </p>
    </section>
  );
}
export default function FieldGuide() {
  const [active, setActive] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [progress, setProgress] = useState<Progress>(empty),
    [saveStatus, setSaveStatus] = useState("Progress saves on this device"),
    [answer, setAnswer] = useState<number | null>(null),
    [feedback, setFeedback] = useState(""),
    [savedOnly, setSavedOnly] = useState(false);
  const lesson = lessons.find((l) => l.id === active);
  const index = lessons.findIndex((l) => l.id === active);
  function persist(next: Progress) {
    setProgress(next);
    try {
      localStorage.setItem("solar4u-learning-v2", JSON.stringify(next));
      setSaveStatus("Progress saved on this device");
    } catch {
      setSaveStatus("Progress is temporary: browser storage is unavailable");
    }
  }
  function open(id: string) {
    if (!validIds.has(id)) return;
    setActive(id);
    setAnswer(null);
    setFeedback("");
    persist({ ...progress, last: id });
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const p = JSON.parse(
          localStorage.getItem("solar4u-learning-v2") ?? "null",
        );
        if (p && Array.isArray(p.completed) && Array.isArray(p.bookmarks))
          setProgress({
            completed: [
              ...new Set<string>(
                p.completed.filter(
                  (id: unknown) => typeof id === "string" && validIds.has(id),
                ),
              ),
            ],
            bookmarks: p.bookmarks.filter(
              (id: unknown) => typeof id === "string" && validIds.has(id),
            ),
            last: validIds.has(p.last) ? p.last : "",
          });
      } catch {
        setSaveStatus("Progress is temporary: browser storage is unavailable");
      }
      const hash = location.hash.slice(1);
      if (validIds.has(hash)) setActive(hash);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function check(choice = answer) {
    if (!lesson || choice === null) return;
    setAnswer(choice);
    const correct = choice === lesson.quiz.answer;
    setFeedback(
      `${correct ? "That’s right." : "Take another look."} ${lesson.quiz.explanation}`,
    );
    if (correct)
      persist({
        ...progress,
        completed: [...new Set([...progress.completed, lesson.id])],
      });
    return {
      correct,
      explanation: lesson.quiz.explanation,
      completed: correct || progress.completed.includes(lesson.id),
    };
  }
  function bookmark(id: string) {
    persist({
      ...progress,
      bookmarks: progress.bookmarks.includes(id)
        ? progress.bookmarks.filter((x) => x !== id)
        : [...progress.bookmarks, id],
    });
  }
  const filtered = lessons.filter(
    (l) =>
      (category === "All" || l.category === category) &&
      (!savedOnly || progress.bookmarks.includes(l.id)) &&
      JSON.stringify(l).toLowerCase().includes(query.toLowerCase()),
  );
  useAgentTools([
    {
      name: "solar4u_search_lessons",
      description:
        "Find original Solar4U lessons and their source references by topic. Returns article summaries, not completion claims.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", maxLength: 200 } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: (i) => {
        const v = objectInput(i);
        if (v.query !== undefined && typeof v.query !== "string")
          throw new Error("query must be text");
        return lessons
          .filter((l) =>
            JSON.stringify(l)
              .toLowerCase()
              .includes(
                String(v.query ?? "")
                  .slice(0, 200)
                  .toLowerCase(),
              ),
          )
          .map((l) => ({
            id: l.id,
            title: l.title,
            summary: l.summary,
            minutes: l.minutes,
            sources: l.sources,
          }));
      },
    },
    {
      name: "solar4u_open_lesson",
      description:
        "Open a lesson in the learning reader and save the resume position on this device. Does not mark the lesson complete.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", enum: lessons.map((l) => l.id) } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (i) => {
        const v = objectInput(i);
        if (typeof v.id !== "string" || !validIds.has(v.id))
          throw new Error("Unknown lesson");
        flushSync(() => open(v.id as string));
        return { id: v.id, status: "lesson_opened" };
      },
    },
    {
      name: "solar4u_read_lesson",
      description:
        "Read the currently open lesson, worked example, sources and knowledge-check prompt.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: (i) => {
        objectInput(i);
        return lesson
          ? {
              ...lesson,
              quiz: {
                question: lesson.quiz.question,
                options: lesson.quiz.options,
              },
              completed: progress.completed.includes(lesson.id),
            }
          : { status: "Choose a lesson first" };
      },
    },
  ]);
  return (
    <main className={`s4-page s4-learning ${lesson ? "s4-reading" : ""}`}>
      {!lesson ? (
        <>
          <div className="s4-learn-hero">
            <div>
              <div className="s4-kicker">
                <BookOpen size={15} /> THE SOLAR FIELD GUIDE
              </div>
              <h1>
                A little curiosity.
                <br />
                <em>A lot more clarity.</em>
              </h1>
              <p className="s4-lead">
                Twelve useful lessons to help you plan your own energy. Clear
                explanations, worked examples, and one practical next step at a
                time.
              </p>
              <button
                className="s4-button s4-dark"
                onClick={() => open(progress.last || lessons[0].id)}
              >
                {progress.last ? "Continue learning" : "Start with the basics"}
                <ArrowRight size={17} />
              </button>
              <p className="s4-fine">
                {progress.completed.length} of 12 knowledge checks complete ·{" "}
                {saveStatus}
              </p>
              <progress
                value={progress.completed.length}
                max={12}
                aria-label="Course completion"
              />
            </div>
            <figure>
              <Image
                src="/learning-system-components.png"
                width={768}
                height={512}
                alt="Conceptual solar module, inverter and battery arranged to show the main system components"
                unoptimized
                priority
              />
              <figcaption>
                A system is easier to understand when every component has a
                purpose.
              </figcaption>
            </figure>
          </div>
          <div className="s4-learning-library">
            <div className="s4-title-row">
              <h2>Make your way through.</h2>
              <span className="s4-fine">
                About 2 hours · Go at your own pace
              </span>
            </div>
            <div className="s4-filter-bar">
              <label className="s4-search">
                <Search size={17} />
                <input
                  aria-label="Search lessons"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a topic or question"
                />
              </label>
              <label>
                Topic
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["All", ...new Set(lessons.map((l) => l.category))].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <button
                className="s4-button s4-light"
                aria-pressed={savedOnly}
                onClick={() => setSavedOnly(!savedOnly)}
              >
                <Bookmark size={15} />
                {savedOnly ? "Showing saved lessons" : "Saved lessons"}
              </button>
            </div>
            <div className="s4-lesson-grid">
              {filtered.map((l) => (
                <article className="s4-lesson-card" key={l.id}>
                  <div className="s4-title-row">
                    <span className="s4-lesson-number">{l.number}</span>
                    <button
                      className="s4-icon-button"
                      aria-label={`${progress.bookmarks.includes(l.id) ? "Unsave" : "Save"} lesson ${l.number}`}
                      aria-pressed={progress.bookmarks.includes(l.id)}
                      onClick={() => bookmark(l.id)}
                    >
                      <Bookmark
                        size={16}
                        fill={
                          progress.bookmarks.includes(l.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                  </div>
                  <span className="s4-kicker">{l.category}</span>
                  <h3>
                    <button onClick={() => open(l.id)}>{l.title}</button>
                  </h3>
                  <p>{l.summary}</p>
                  <div className="s4-lesson-card-bottom">
                    <span>
                      <Clock size={12} /> {l.minutes} min
                    </span>
                    <button onClick={() => open(l.id)}>
                      {progress.completed.includes(l.id) ? (
                        <>
                          <Check size={14} /> Revisit lesson
                        </>
                      ) : (
                        <>
                          Open lesson <ArrowUpRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <div className="s4-empty">
                <h3>No matching lessons</h3>
                <p>Try a broader topic or turn off the saved filter.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="s4-title-row s4-reader-bar">
            <button
              className="s4-text-link"
              onClick={() => {
                setActive("");
                history.replaceState(null, "", location.pathname);
              }}
            >
              <ArrowLeft size={15} /> All lessons
            </button>
            <span role="status">{saveStatus}</span>
            <button
              className="s4-button s4-light"
              onClick={() => bookmark(lesson.id)}
              aria-pressed={progress.bookmarks.includes(lesson.id)}
            >
              <Bookmark size={14} />
              {progress.bookmarks.includes(lesson.id)
                ? "Saved lesson"
                : "Save for later"}
            </button>
          </div>
          <div className="s4-reader-layout">
            <aside className="s4-course-nav">
              <h2>Your learning path</h2>
              <progress
                value={progress.completed.length}
                max={12}
                aria-label="Course completion"
              />
              <p>{progress.completed.length} / 12 complete</p>
              <nav aria-label="Course lessons">
                {lessons.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => open(l.id)}
                    aria-current={l.id === active ? "step" : undefined}
                  >
                    <small>
                      {progress.completed.includes(l.id) ? (
                        <Check size={12} />
                      ) : (
                        l.number
                      )}
                    </small>
                    <span>{l.title}</span>
                  </button>
                ))}
              </nav>
            </aside>
            <article className="s4-article">
              <div className="s4-kicker">
                LESSON {lesson.number} / {lesson.category} · {lesson.minutes}{" "}
                MIN
              </div>
              <h1>{lesson.title}</h1>
              <p className="s4-article-intro">{lesson.summary}</p>
              <div className="s4-outcome">
                <BookOpen size={19} />
                <p>
                  <strong>By the end of this lesson</strong>
                  {lesson.outcome}
                </p>
              </div>
              <figure className="s4-article-image">
                <Image
                  src={lesson.image}
                  width={900}
                  height={600}
                  alt={
                    lesson.image.includes("roof-mounting")
                      ? "Conceptual exploded view of a panel, mounting rails, roof covering and timber structure"
                      : lesson.image.includes("components")
                        ? "Conceptual solar module, inverter and battery"
                        : "Conceptual home with rooftop and ground-mounted solar arrays"
                  }
                  unoptimized
                />
                <figcaption>
                  Conceptual illustration. Component locations and mounting
                  details are not installation drawings.
                </figcaption>
              </figure>
              {lesson.sections.map((s, i) => (
                <section key={i}>
                  <h2>{s.title}</h2>
                  {s.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                  {s.bullets && (
                    <ul>
                      {s.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
              <section className="s4-worked-example">
                <div className="s4-kicker">A WORKED EXAMPLE</div>
                <h2>{lesson.example.title}</h2>
                <p>{lesson.example.body}</p>
                <code>{lesson.example.formula}</code>
              </section>
              <NumbersLab key={lesson.id} id={lesson.id} />
              <section className="s4-checklist">
                <h2>Take this into your plan</h2>
                {lesson.checklist.map((t) => (
                  <p key={t}>
                    <Check size={16} />
                    {t}
                  </p>
                ))}
              </section>
              <section className="s4-knowledge">
                <div className="s4-kicker">CHECK YOUR UNDERSTANDING</div>
                <h2>{lesson.quiz.question}</h2>
                <fieldset>
                  <legend className="s4-sr-only">Choose one answer</legend>
                  {lesson.quiz.options.map((o, i) => (
                    <label
                      key={o}
                      className={answer === i ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="knowledge-check"
                        checked={answer === i}
                        onChange={() => {
                          setAnswer(i);
                          setFeedback("");
                        }}
                      />
                      <span>{o}</span>
                    </label>
                  ))}
                </fieldset>
                <button
                  className="s4-button s4-dark"
                  disabled={answer === null}
                  onClick={() => check()}
                >
                  Check my answer <ArrowRight size={15} />
                </button>
                {feedback && (
                  <p role="status" className="s4-feedback">
                    {feedback}
                    {progress.completed.includes(lesson.id) && (
                      <strong> Lesson complete.</strong>
                    )}
                  </p>
                )}
              </section>
              <section className="s4-lesson-sources">
                <h2>Go to the source</h2>
                <p>
                  References reviewed {lesson.reviewed}. Check current local
                  rules and the exact equipment manual for your project.
                </p>
                {lesson.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
              </section>
              <div className="s4-reader-next">
                <a className="s4-button s4-light" href={lesson.nextTool.href}>
                  {lesson.nextTool.label}
                  <ArrowUpRight size={15} />
                </a>
                {index < lessons.length - 1 && (
                  <button
                    className="s4-button s4-dark"
                    onClick={() => open(lessons[index + 1].id)}
                  >
                    Next lesson <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </article>
          </div>
        </>
      )}
    </main>
  );
}
