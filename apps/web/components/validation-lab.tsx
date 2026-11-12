"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FlaskConical, Upload } from "lucide-react";
import {
  canvasFields,
  emptyCanvas,
  MAX_CANVAS_FILE,
  nextValidationStep,
  readCanvas,
} from "../lib/validation-canvas";

export function ValidationLab() {
  const [canvas, setCanvas] = useState(emptyCanvas);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ReturnType<typeof emptyCanvas> | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  function download() {
    const blob = new Blob([JSON.stringify(canvas, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "incforstartup-validacio.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Exportació preparada. Conserva el fitxer per recuperar aquest esborrany.",
    );
  }
  return (
    <main className="validation-lab">
      <nav aria-label="Navegació del laboratori">
        <Link className="text-button" href="/campus">
          <ArrowLeft size={16} /> Campus compartit
        </Link>
        <Link className="text-button" href="/demo">
          Demostració
        </Link>
      </nav>
      <header className="page-heading">
        <div>
          <span className="eyebrow">INCFORSTARTUP · LABORATORI</span>
          <h1>De la idea a l’evidència.</h1>
          <p>Una prova petita, un aprenentatge i un pas endavant.</p>
        </div>
        <FlaskConical size={36} aria-hidden="true" />
      </header>
      <p className="notice">
        Esborrany temporal: exporta’l abans de sortir. No es desa al teu compte
        ni s’envia a una IA. Pots recuperar-lo important el fitxer exportat.
      </p>
      <section
        className="panel validation-guidance"
        aria-label="Orientació del següent pas"
      >
        <span className="eyebrow">QUÈ POTS FER ARA</span>
        <p role="status">{nextValidationStep(canvas)}</p>
      </section>
      <div className="validation-toolbar">
        <button className="button primary" onClick={download}>
          <Download size={16} /> Exporta l’esborrany
        </button>
        <button
          className="button secondary"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={16} /> Importa un esborrany
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Fitxer d’esborrany"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setError("");
            setNotice("");
            setPending(null);
            try {
              if (file.size > MAX_CANVAS_FILE)
                throw new Error("El fitxer supera els 100 KB.");
              setPending(readCanvas(await file.text()));
            } catch {
              setError(
                "No hem pogut importar el fitxer. Tria un esborrany compatible de fins a 100 KB; el treball actual es conserva.",
              );
            }
          }}
        />
      </div>
      {pending && (
        <section className="panel" aria-label="Confirma la importació">
          <h2>Substituir l’esborrany actual?</h2>
          <p>
            Fitxer: {pending.fields.name || "Sense nom"}. Exporta el treball
            actual si el vols conservar.
          </p>
          <div className="validation-toolbar">
            <button
              className="button primary"
              onClick={() => {
                setCanvas(pending);
                setPending(null);
                setNotice("Esborrany importat.");
              }}
            >
              Substitueix l’esborrany
            </button>
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Cancel·la la importació
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="validation-grid">
        {canvasFields.map(({ key, label, help }, index) => (
          <section className="panel" key={key}>
            <span className="eyebrow">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2>
              <label htmlFor={`canvas-${key}`}>{label}</label>
            </h2>
            <p id={`help-${key}`}>{help}</p>
            <textarea
              id={`canvas-${key}`}
              aria-label={label}
              aria-describedby={`help-${key}`}
              rows={key === "name" ? 2 : 4}
              maxLength={4000}
              value={canvas.fields[key]}
              onChange={(event) => {
                const value = event.target.value;
                setCanvas((current) => ({
                  ...current,
                  fields: { ...current.fields, [key]: value },
                }));
                setNotice("");
              }}
            />
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Un projecte pot continuar després de l’aula</h2>
        <p>
          Contrastar una necessitat ajuda a decidir si continuar, canviar de
          direcció o aturar una idea. La publicació, l’acompanyament i l’ús d’IA
          s’hauran d’activar expressament quan estiguin disponibles.
        </p>
      </section>
    </main>
  );
}
