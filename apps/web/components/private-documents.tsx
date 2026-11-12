"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sprout,
  Upload,
} from "lucide-react";
import { logoutAction, privateLoginAction } from "../app/actions";
import {
  PrivateError,
  privateJson,
  privateRequest,
  type Vault,
  type PrivateDocument,
} from "../lib/private-api";
import { MAX_DOCUMENT_BYTES } from "../lib/private-policy";
const roles = {
  owner: "Propietari",
  contributor: "Col·laborador",
  reader: "Lector",
};
const states = {
  uploading: "Carregant",
  quarantined: "En anàlisi",
  released: "Disponible",
  blocked: "Bloquejat",
  failed: "Càrrega fallida",
};
export function PrivateDocuments({
  userName,
  stepUpConfigured,
}: {
  userName: string;
  stepUpConfigured: boolean;
}) {
  const [access, setAccess] = useState<{
    policy_enforced: boolean;
    documents_available: boolean;
  } | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selected, setSelected] = useState<Vault | null>(null);
  const [documents, setDocuments] = useState<PrivateDocument[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stepUp, setStepUp] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  function fail(error: unknown) {
    if (
      error instanceof PrivateError &&
      (error.status === 401 || error.status === 403)
    ) {
      setDocuments([]);
      setAccess(null);
      setSelected(null);
      setVaults([]);
      setFile(null);
    }
    setStepUp(
      error instanceof PrivateError && error.code === "step_up_required",
    );
    setNeedsLogin(
      error instanceof PrivateError &&
        error.status === 401 &&
        error.code !== "step_up_required",
    );
    setError(
      error instanceof Error
        ? error.message
        : "No hem pogut completar l’operació.",
    );
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const gate = await privateJson<{
          policy_enforced: boolean;
          documents_available: boolean;
        }>("private-access");
        const rows = await privateJson<Vault[]>("vaults?limit=100");
        if (!cancelled) {
          setAccess(gate);
          setVaults(rows);
          setSelected((current) =>
            current
              ? (rows.find((row) => row.id === current.id) ?? null)
              : null,
          );
          setError("");
          setStepUp(false);
        }
      } catch (e) {
        if (!cancelled) fail(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [revision]);
  useEffect(() => {
    let cancelled = false;
    if (!selected || !access) return;
    async function load() {
      try {
        const rows = await privateJson<PrivateDocument[]>(
          `vaults/${selected!.id}/documents?limit=100`,
        );
        if (!cancelled) setDocuments(rows);
      } catch (e) {
        if (!cancelled) {
          setDocuments([]);
          fail(e);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selected, access, revision]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const vault = await privateJson<Vault>("vaults", { name });
      setSelected(vault);
      setDocuments([]);
      setName("");
      setFile(null);
      setRevision((n) => n + 1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !selected) return;
    if (
      !file.size ||
      file.size > MAX_DOCUMENT_BYTES ||
      !/\.(pdf|txt)$/i.test(file.name)
    ) {
      setError("Selecciona un PDF o TXT no buit de fins a 10 MiB.");
      return;
    }
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await privateRequest(`vaults/${selected.id}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": /\.pdf$/i.test(file.name)
            ? "application/pdf"
            : "text/plain",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      form.reset();
      setFile(null);
      setNotice(
        "Document rebut en quarantena. Actualitza l’estat per consultar el resultat de l’anàlisi.",
      );
      setRevision((n) => n + 1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function download(doc: PrivateDocument) {
    setBusy(true);
    setError("");
    try {
      const response = await privateRequest(
        `vaults/${doc.vault_id}/documents/${doc.id}/content`,
      );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      fail(e);
      setRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="private-page">
      <header className="private-header">
        <Link className="brand" href="/campus">
          <Sprout size={24} /> IncForStartUp
        </Link>
        <nav aria-label="Navegació privada">
          <Link href="/campus">Campus</Link>
          <span>{userName}</span>
          <form action={logoutAction}>
            <button className="text-button">Tanca la sessió</button>
          </form>
        </nav>
      </header>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROJECTES · DOCUMENTS PRIVATS</span>
          <h1>Un espai propi per a cada projecte.</h1>
          <p>
            Consulta els teus documents i l’estat de l’anàlisi abans de
            descarregar-los.
          </p>
        </div>
        <LockKeyhole size={34} aria-hidden="true" />
      </div>
      {loading && <p role="status">Comprovant l’accés…</p>}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {stepUp && (
        <section className="panel private-gate">
          <ShieldCheck size={28} />
          <h2>Reforça l’accés al teu espai</h2>
          <p>
            Continua amb el teu proveïdor d’identitat per completar la
            verificació requerida.
          </p>
          {stepUpConfigured ? (
            <form action={privateLoginAction}>
              <button className="button primary">Reforça l’accés</button>
            </form>
          ) : (
            <p>L’accés reforçat està pendent d’activació.</p>
          )}
        </section>
      )}
      {!access && !stepUp && !loading && needsLogin && (
        <Link className="button secondary" href="/login?next=/private">
          Torna a iniciar sessió
        </Link>
      )}
      {access && (
        <>
          {!access.policy_enforced && (
            <p className="notice">
              Entorn de prova: la política d’accés reforçat encara no està
              configurada.
            </p>
          )}
          {!access.documents_available && (
            <p className="notice">
              La càrrega i descàrrega de documents encara no està activada en
              aquest entorn.
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          <div className="private-grid">
            <aside className="panel">
              <h2>Els teus projectes</h2>
              <p>Només apareixen els projectes on tens accés.</p>
              <div className="private-vaults">
                {vaults.map((v) => (
                  <button
                    key={v.id}
                    className={
                      selected?.id === v.id
                        ? "private-vault selected"
                        : "private-vault"
                    }
                    disabled={busy}
                    aria-pressed={selected?.id === v.id}
                    onClick={() => {
                      setSelected(v);
                      setDocuments([]);
                      setFile(null);
                      setNotice("");
                      setError("");
                    }}
                  >
                    {v.name}
                    <span>{roles[v.role]}</span>
                  </button>
                ))}
              </div>
              {!vaults.length && <p>Encara no tens cap projecte privat.</p>}
              <form className="private-create" onSubmit={create}>
                <label htmlFor="private-name">Nom del nou projecte</label>
                <input
                  id="private-name"
                  maxLength={100}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="button secondary" disabled={busy}>
                  Crea un espai privat
                </button>
              </form>
            </aside>
            <section className="panel private-library">
              {selected ? (
                <>
                  <div className="private-library-heading">
                    <div>
                      <span className="eyebrow">{roles[selected.role]}</span>
                      <h2>{selected.name}</h2>
                    </div>
                    <button
                      className="button secondary"
                      disabled={busy || loading}
                      onClick={() => {
                        setError("");
                        setRevision((n) => n + 1);
                      }}
                    >
                      <RefreshCw size={16} /> Actualitza l’estat
                    </button>
                  </div>
                  <p>
                    PDF o TXT en UTF-8 de fins a 10 MiB. La descàrrega s’activa
                    quan el fitxer supera l’anàlisi de seguretat. L’accés queda
                    limitat als membres autoritzats del projecte.
                  </p>
                  {selected.role !== "reader" && (
                    <form className="private-upload" onSubmit={upload}>
                      <label htmlFor="private-file">
                        Document del projecte
                      </label>
                      <input
                        key={selected.id}
                        id="private-file"
                        type="file"
                        accept=".pdf,.txt,application/pdf,text/plain"
                        disabled={
                          busy ||
                          !access.documents_available ||
                          !access.policy_enforced
                        }
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          !file ||
                          !access.documents_available ||
                          !access.policy_enforced
                        }
                      >
                        <Upload size={16} />{" "}
                        {busy ? "Processant…" : "Puja a quarantena"}
                      </button>
                    </form>
                  )}
                  {selected.role === "reader" && (
                    <p className="notice">
                      Tens accés de lectura. Només el propietari i els
                      col·laboradors poden pujar documents.
                    </p>
                  )}
                  <div
                    className="private-document-list"
                    aria-label="Documents del projecte"
                  >
                    {documents.map((doc) => (
                      <article className="private-document" key={doc.id}>
                        <FileText size={22} aria-hidden="true" />
                        <div>
                          <h3>{doc.filename}</h3>
                          <p>
                            {Math.ceil(doc.size / 1024)} KiB ·{" "}
                            {states[doc.status]}
                          </p>
                        </div>
                        <button
                          className="button secondary"
                          aria-label={`Descarrega ${doc.filename}`}
                          disabled={
                            busy ||
                            doc.status !== "released" ||
                            !access.documents_available
                          }
                          onClick={() => void download(doc)}
                        >
                          <Download size={16} /> Descarrega
                        </button>
                      </article>
                    ))}
                  </div>
                  {!documents.length && (
                    <p>
                      Encara no hi ha documents visibles en aquest projecte.
                    </p>
                  )}
                  <p className="muted">
                    Mostrem fins a 100 documents per projecte. Els permisos es
                    tornen a comprovar a cada descàrrega.
                  </p>
                </>
              ) : (
                <div className="private-empty">
                  <LockKeyhole size={40} />
                  <h2>Tria un projecte</h2>
                  <p>
                    Selecciona un dels teus espais o crea’n un per començar.
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
