"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "./planner.module.css";

const phases = ["Iniciació", "Planificació", "Implementació", "Tancament"] as const;
const statuses = ["Pendent", "En curs", "Feta"] as const;
type Status = (typeof statuses)[number];
type Phase = (typeof phases)[number];
type Method = "predictiu" | "adaptatiu";
type Task = { title: string; phase: Phase; status: Status };

const methods = {
  predictiu: {
    name: "Predictiu",
    description: "Fixa el pla inicial. Avalua cada canvi d’abast amb el seu impacte sobre el calendari i els recursos abans d’aprovar-lo.",
    tasks: ["Validar el brief", "Aprovar calendari i pressupost", "Revisar l’execució en cada fita", "Acceptar els lliurables"],
  },
  adaptatiu: {
    name: "Adaptatiu",
    description: "Prioritza el backlog i treballa per iteracions. Revisa cada increment amb les persones usuàries i actualitza les prioritats segons l’evidència.",
    tasks: ["Definir el problema i la hipòtesi", "Prioritzar el backlog inicial", "Provar un increment amb usuaris", "Registrar l’aprenentatge i decidir el següent pas"],
  },
} satisfies Record<Method, { name: string; description: string; tasks: string[] }>;

const directions = {
  modern: {name: "Modern", palette: ["#DAD7CC", "#8B8982", "#51463D", "#A8AEB0"], materials: "Acer raspallat, fusta natural i acabats mats.", approach: "Formes netes, recorreguts clars i una base de grisos equilibrada amb tons càlids."},
  bohemi: {name: "Bohemi", palette: ["#EEE2C5", "#AB4B35", "#C88D41", "#54654B"], materials: "Lli, fibres naturals, ceràmica i mobiliari vintage.", approach: "Combina patrons i textures sobre una base càlida amb accents de terracota i verd."},
  classic: {name: "Clàssic", palette: ["#F1E8D9", "#AF9D7B", "#5D4031", "#5A6659"], materials: "Fusta massissa, llautó, pedra i teixits refinats.", approach: "Simetria, proporcions equilibrades i peces de mobiliari de línies tradicionals."},
};

function initialTasks(method: Method): Task[] {
  return phases.map((phase, index) => ({ phase, title: methods[method].tasks[index], status: "Pendent" }));
}

export function ProjectPlanner() {
  const [method, setMethod] = useState<Method>("predictiu");
  const [direction, setDirection] = useState<keyof typeof directions>("modern");
  const [tasks, setTasks] = useState<Record<Method, Task[]>>(() => ({
    predictiu: initialTasks("predictiu"),
    adaptatiu: initialTasks("adaptatiu"),
  }));
  const [notice, setNotice] = useState("");
  const design = directions[direction];
  const complete = tasks[method].filter((task) => task.status === "Feta").length;

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title")).trim();
    const phase = phases.find((item) => item === data.get("phase"));
    if (!title || !phase) {
      setNotice("Introdueix un títol per a la tasca.");
      return;
    }
    setTasks((current) => ({
      ...current,
      [method]: [...current[method], { title, phase, status: "Pendent" }],
    }));
    form.reset();
    setNotice("Tasca afegida.");
  }

  function updateStatus(index: number, status: Status) {
    setTasks((current) => ({
      ...current,
      [method]: current[method].map((task, position) =>
        position === index ? { ...task, status } : task,
      ),
    }));
  }

  function exportPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      schemaVersion: 1,
      kind: "incforstartup.project-plan",
      brief: {
        title: String(data.get("project")).trim(),
        scope: String(data.get("scope")).trim(),
        timeline: String(data.get("timeline")).trim(),
        resources: String(data.get("resources")).trim(),
      },
      methodology: method,
      designDirection: direction,
      tasks: tasks[method],
    };
    if (!Object.values(payload.brief).every(Boolean)) {
      setNotice("Completa els quatre camps del pla.");
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const download = document.createElement("a");
    download.href = url;
    download.download = "incforstartup-pla-projecte.json";
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Pla exportat.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/demo" className={styles.back}>← Campus</Link>
        <h1>Direcció de projectes</h1>
        <p>Defineix el pla de treball i la línia visual del teu projecte.</p>
      </header>

      <section className={styles.panel} aria-labelledby="management-title">
        <div className={styles.sectionHeading}>
          <h2 id="management-title">Metodologia i tasques</h2>
          <span>{complete} de {tasks[method].length} fetes</span>
        </div>
        <label className={styles.field}>Enfocament
          <select value={method} onChange={(event) => setMethod(event.target.value as Method)}>
            {Object.entries(methods).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
          </select>
        </label>
        <p>{methods[method].description}</p>
        <div className={styles.phases}>
          {phases.map((phase) => (
            <section key={phase} className={styles.phase}>
              <h3>{phase}</h3>
              {tasks[method].map((task, index) => task.phase === phase && (
                <label key={index} className={styles.field}>
                  {task.title}
                  <select value={task.status} onChange={(event) => updateStatus(index, event.target.value as Status)}>
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
              ))}
            </section>
          ))}
        </div>
        <form onSubmit={addTask} className={styles.addTask}>
          <label className={styles.field}>Nova tasca<input name="title" maxLength={120} required /></label>
          <div className={styles.field}>
            <label htmlFor="new-task-phase">Fase</label>
            <select id="new-task-phase" name="phase">
              {phases.map((phase) => <option key={phase}>{phase}</option>)}
            </select>
          </div>
          <button className={styles.secondary}>Afegeix</button>
        </form>
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="design-title">
          <h2 id="design-title">Direcció visual</h2>
          <label className={styles.field}>Estil
            <select value={direction} onChange={(event) => setDirection(event.target.value as keyof typeof directions)}>
              {Object.entries(directions).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
            </select>
          </label>
          <p>{design.approach}</p>
          <p>{design.materials}</p>
          <ul className={styles.palette} aria-label="Paleta de colors">
            {design.palette.map((color) => <li key={color}><span aria-hidden="true" style={{backgroundColor: color}} />{color}</li>)}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby="brief-title">
          <h2 id="brief-title">Abast, temps i recursos</h2>
          <form onSubmit={exportPlan} className={styles.brief}>
            <label className={styles.field}>Nom del projecte<input name="project" maxLength={120} required /></label>
            <label className={styles.field}>Abast i lliurables<textarea name="scope" rows={2} maxLength={800} required /></label>
            <label className={styles.field}>Calendari<input name="timeline" maxLength={200} required /></label>
            <label className={styles.field}>Equip i pressupost<input name="resources" maxLength={200} required /></label>
            <p>Esborrany temporal. Exporta’l abans de tancar la pàgina.</p>
            <button className={styles.primary}>Exporta el pla</button>
          </form>
        </section>
      </div>
      <p role="status" className={styles.status}>{notice}</p>
    </main>
  );
}
