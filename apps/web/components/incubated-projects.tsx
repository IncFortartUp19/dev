"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Globe2,
  LockKeyhole,
  Sprout,
} from "lucide-react";
import registry from "../data/incubated-projects.json";

export function IncubatedProjects() {
  const [selected, setSelected] = useState<string | null>(null);
  const project = registry.find((p) => p.id === selected);
  return (
    <section className="incubator-page" aria-label="Projectes incubats">
      {project ? (
        <>
          <button
            className="text-button back"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft size={16} /> Torna als projectes incubats
          </button>
          <div className="page-heading">
            <div>
              <span className="eyebrow">ECOSISTEMA INCFORSTARTUP</span>
              <h1>
                {project.name}
                <span className="title-dot">.</span>
              </h1>
              <p>{project.summary}</p>
            </div>
            <span className="badge green">
              <span />
              {project.stage}
            </span>
          </div>
          <div className="incubator-detail">
            <section className="panel">
              <span className="mini-icon">
                <Sprout size={24} />
              </span>
              <h2>Un projecte amb recorregut propi</h2>
              <p>
                IncForStartUp acompanya projectes que volen créixer. Cada
                projecte conserva la seva identitat, autoria i decisions de
                desenvolupament.
              </p>
              <div className="incubator-facts">
                <div>
                  <span>Projecte</span>
                  <strong>{project.name}</strong>
                </div>
                <div>
                  <span>Domini propi</span>
                  <strong>{project.domain}</strong>
                </div>
                <div>
                  <span>Vinculació</span>
                  <strong>{project.relationship}</strong>
                </div>
                <div>
                  <span>Estat</span>
                  <strong>{project.stage}</strong>
                </div>
              </div>
            </section>
            <aside className="panel">
              <span className="mini-icon">
                <LockKeyhole size={24} />
              </span>
              <h2>La vinculació respecta els límits</h2>
              <p>
                La fitxa presenta el projecte. No dona accés al seu codi,
                comptes d’usuari ni documents interns.
              </p>
              <ul>
                {project.publicHighlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="muted">
                La vinculació no implica compartir dades amb la IA ni cedir la
                propietat del projecte.
              </p>
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">DE L’AULA AL PROJECTE REAL</span>
              <h1>
                Projectes incubats<span className="title-dot">.</span>
              </h1>
              <p>
                Un espai per connectar iniciatives, explicar-ne el recorregut i
                compartir aprenentatges.
              </p>
            </div>
            <span className="count-label">
              {registry.length} projecte vinculat
            </span>
          </div>
          <div className="incubator-intro">
            <Sprout size={28} />
            <p>
              Campus continua sent l’espai docent. Aquí donem lloc als projectes
              independents que formen part de l’ecosistema IncForStartUp.
            </p>
          </div>
          <div className="incubator-grid">
            {registry.map((item) => (
              <article className="panel incubator-card" key={item.id}>
                <div className="incubator-card-top">
                  <span className="project-monogram">BF</span>
                  <span className="badge green">
                    <span />
                    {item.stage}
                  </span>
                </div>
                <span className="eyebrow">{item.relationship}</span>
                <h2>{item.name}</h2>
                <p>{item.summary}</p>
                <div className="incubator-domain">
                  <Globe2 size={16} />
                  <span>{item.domain}</span>
                </div>
                <footer>
                  <span>
                    <LockKeyhole size={14} />
                    Codi privat
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setSelected(item.id)}
                  >
                    Veure fitxa <ArrowUpRight size={16} />
                  </button>
                </footer>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
