"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { privateJson } from "../../lib/private-api";
import { pendingIdeaFields, validateIdea, type IdeaInput } from "../../lib/idea-drafts";
import styles from "./short-card.module.css";

type ServerDraft = {
  id: string;
  question: string;
  intention: string;
  next_test: string;
  name: string;
  visibility: "private";
  updated_at: string;
};
const blank = (): IdeaInput => ({ question: "", intention: "", nextTest: "", name: "" });
const toFields = (draft: ServerDraft): IdeaInput => ({
  question: draft.question, intention: draft.intention,
  nextTest: draft.next_test, name: draft.name,
});
export function ConnectedIdeaDrafts() {
  const [drafts, setDrafts] = useState<ServerDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<IdeaInput>(blank);
  const [snapshot, setSnapshot] = useState(JSON.stringify(blank()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(fields) !== snapshot;

  useEffect(() => {
    let active = true;
    privateJson<ServerDraft[]>("idea-drafts")
      .then((rows) => { if (active) setDrafts(rows); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "No es poden recuperar les idees."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function choose(draft: ServerDraft | null) {
    if (dirty && !window.confirm("Hi ha canvis sense desar. Vols descartar-los?")) return;
    const next = draft ? toFields(draft) : blank();
    setFields(next);
    setSnapshot(JSON.stringify(next));
    setSelectedId(draft?.id ?? null);
    setError("");
    setMessage("");
  }
  function update(key: keyof IdeaInput, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setMessage("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || saving) return;
    const invalid = validateIdea(fields);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setMessage("");
    try {
      const path = selectedId ? `idea-drafts/${selectedId}` : "idea-drafts";
      const result = await privateJson<ServerDraft>(path, {
        question: fields.question, intention: fields.intention,
        next_test: fields.nextTest, name: fields.name,
      });
      setDrafts((current) => [result, ...current.filter((draft) => draft.id !== result.id)]);
      setSelectedId(result.id);
      setSnapshot(JSON.stringify(fields));
      setError("");
      setMessage("Esborrany desat al teu compte privat. No s'ha publicat ni compartit.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut desar. Els camps es conserven.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/campus" className={styles.back}>← Campus</Link>
        <span className={styles.kicker}>INCFORSTARTUP · IDEES PRIVADES</span>
        <h1>Una idea comença amb una pregunta.</h1>
        <p>Desa la teva idea al teu compte. Sense equip, finançament ni primera prova obligatòria.</p>
      </header>
      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <h2>Els teus esborranys</h2>
          <p>Privats al teu compte. No són visibles per altres usuaris ni espais Campus.</p>
          <button type="button" className={styles.secondary} onClick={() => choose(null)}>+ Nova idea</button>
          {loading && <p role="status">Carregant esborranys...</p>}
          {!loading && drafts.length === 0 && !error && <p>No hi ha esborranys encara.</p>}
          {drafts.map((draft) => <button
            key={draft.id} type="button"
            className={draft.id === selectedId ? styles.chosen : styles.draft}
            onClick={() => choose(draft)}>
            <strong>{draft.name || draft.question}</strong>
            <small>{pendingIdeaFields(toFields(draft)).length ? "Esborrany · pendent" : "Esborrany · fitxa completa"}</small>
          </button>)}
        </aside>
        <form className={styles.card} onSubmit={save}>
          <div className={styles.cardHeading}>
            <div><span className={styles.kicker}>FITXA CURTA</span><h2>{selectedId ? "Edita la teva idea" : "Nova idea"}</h2></div>
            <span className={styles.private}>Privat · compte</span>
          </div>
          <label>Pregunta o necessitat *
            <textarea required maxLength={2000} rows={3} value={fields.question}
              onChange={(event) => update("question", event.target.value)}
              placeholder="Quin problema vols entendre o resoldre?" />
          </label>
          <label>Intenció <small>opcional de moment</small>
            <textarea maxLength={3000} rows={3} value={fields.intention}
              onChange={(event) => update("intention", event.target.value)}
              placeholder="Què voldries aconseguir?" />
          </label>
          <label>Propera prova <small>opcional</small>
            <textarea maxLength={3000} rows={3} value={fields.nextTest}
              onChange={(event) => update("nextTest", event.target.value)}
              placeholder="Quina prova petita podries fer?" />
          </label>
          <label>Nom provisional <small>opcional</small>
            <input maxLength={120} value={fields.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="No cal posar-hi nom encara" />
          </label>
          <section className={styles.pending}>
            <strong>Esborrany {pendingIdeaFields(fields).length ? "amb pendents" : "amb fitxa completa"}</strong>
            <p>{pendingIdeaFields(fields).length ?
              "Pendent: " + pendingIdeaFields(fields).join(" · ") :
              "La fitxa és completa, però no s'ha publicat."}</p>
          </section>
          {dirty && <p className={styles.unsaved}>Tens canvis sense desar.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {message && <p role="status" className={styles.notice}>{message}</p>}
          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={loading || saving}>
              {saving ? "Desant..." : "Desa al compte privat"}
            </button>
            <span>La visibilitat es manté privada.</span>
          </div>
        </form>
      </section>
    </main>
  );
}
