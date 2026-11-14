"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  IDEA_STORAGE_KEY, MAX_IDEA_DRAFTS, parseIdeaDrafts,
  pendingIdeaFields, validateIdea, type IdeaDraft, type IdeaInput,
} from "../../lib/idea-drafts";
import styles from "./short-card.module.css";

const blank = (): IdeaInput => ({ question: "", intention: "", nextTest: "", name: "" });

export function IdeaDraftEditor() {
  const [drafts, setDrafts] = useState<IdeaDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<IdeaInput>(blank);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(blank()));
  const [ready, setReady] = useState(false);
  const [storageHealthy, setStorageHealthy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(fields) !== savedSnapshot;
  const selected = drafts.find((draft) => draft.id === selectedId);
  const pending = pendingIdeaFields(fields);

  useEffect(() => {
    try {
      setDrafts(parseIdeaDrafts(window.localStorage.getItem(IDEA_STORAGE_KEY)));
    } catch {
      setError("No es poden llegir els esborranys locals. No se n'ha modificat cap.");
      setStorageHealthy(false);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function choose(draft: IdeaDraft | null) {
    if (dirty && !window.confirm("Hi ha canvis sense desar. Vols descartar-los?")) return;
    const next = draft ? {
      question: draft.question, intention: draft.intention,
      nextTest: draft.nextTest, name: draft.name,
    } : blank();
    setFields(next);
    setSavedSnapshot(JSON.stringify(next));
    setSelectedId(draft?.id ?? null);
    setError("");
    setNotice("");
  }
  function update(key: keyof IdeaInput, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setNotice("");
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storageHealthy) {
      setError("Desat bloquejat: les dades locals existents no es poden llegir."); return;
    }
    const validation = validateIdea(fields);
    if (validation) { setError(validation); return; }
    if (!selectedId && drafts.length >= MAX_IDEA_DRAFTS) {
      setError("Has arribat al límit de fitxes locals. No s'ha descartat cap canvi."); return;
    }
    const id = selectedId ?? crypto.randomUUID();
    const next: IdeaDraft = {
      ...fields, id, scope: "personal-local", updatedAt: new Date().toISOString(),
    };
    const updated = [next, ...drafts.filter((draft) => draft.id !== id)];
    try {
      window.localStorage.setItem(IDEA_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      setError("No s'ha pogut desar al navegador. Els camps continuen oberts per tornar-ho a provar.");
      return;
    }
    setDrafts(updated);
    setSelectedId(id);
    setSavedSnapshot(JSON.stringify(fields));
    setError("");
    setNotice("Esborrany desat en aquest navegador. Pots reobrir-lo i editar-lo.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/demo" className={styles.back}>← Campus</Link>
        <span className={styles.kicker}>INCFORSTARTUP · PRIMER PAS</span>
        <h1>Una idea comença amb una pregunta.</h1>
        <p>No necessites un equip, un pressupost ni una prova definida per començar.</p>
      </header>
      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <h2>Els teus esborranys</h2>
          <p>Guardats només en aquest navegador, no al teu compte ni al servidor.</p>
          <button type="button" className={styles.secondary} onClick={() => choose(null)}>+ Nova idea</button>
          {ready && drafts.length === 0 && <p>Encara no has desat cap idea.</p>}
          {drafts.map((draft) => (
            <button key={draft.id} type="button"
              className={draft.id === selectedId ? styles.chosen : styles.draft}
              onClick={() => choose(draft)}>
              <strong>{draft.name || draft.question}</strong>
              <small>{pendingIdeaFields(draft).length ? "Esborrany · pendent" : "Esborrany · fitxa completa"}</small>
            </button>
          ))}
        </aside>
        <form className={styles.card} onSubmit={save}>
          <div className={styles.cardHeading}>
            <div><span className={styles.kicker}>FITXA CURTA</span><h2>{selected ? "Edita la teva idea" : "Comença des de zero"}</h2></div>
            <span className={styles.private}>Personal · local</span>
          </div>
          <label>Pregunta o necessitat <span aria-hidden="true">*</span>
            <textarea required maxLength={2000} rows={3} value={fields.question}
              onChange={(event) => update("question", event.target.value)}
              placeholder="Quin problema vols entendre o resoldre?" />
          </label>
          <label>Intenció <small>opcional de moment</small>
            <textarea maxLength={3000} rows={3} value={fields.intention}
              onChange={(event) => update("intention", event.target.value)}
              placeholder="Què voldries aconseguir amb aquesta idea?" />
          </label>
          <label>Propera prova <small>la pots definir més endavant</small>
            <textarea maxLength={3000} rows={3} value={fields.nextTest}
              onChange={(event) => update("nextTest", event.target.value)}
              placeholder="Quina acció petita t'ajudaria a aprendre alguna cosa?" />
          </label>
          <label>Nom provisional <small>opcional</small>
            <input maxLength={120} value={fields.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="No cal tenir un nom encara" />
          </label>
          <section className={styles.pending} aria-label="Estat de preparació">
            <strong>Estat: esborrany {pending.length ? "amb pendents" : "amb fitxa completa"}</strong>
            <p>{pending.length ? "Pots completar més endavant: " + pending.join(" · ") : "Ja tens els camps inicials preparats. Encara no s'ha publicat res."}</p>
          </section>
          {dirty && <p className={styles.unsaved}>Tens canvis sense desar.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={!ready || !storageHealthy}>Desa l'esborrany</button>
            <span>Desar no publica ni comparteix la idea.</span>
          </div>
        </form>
      </section>
    </main>
  );
}
