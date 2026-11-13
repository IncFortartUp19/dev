"use client";
import { ProjectDomain } from "./project-domain";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  FolderOpen,
  GraduationCap,
  LogOut,
  Plus,
  RefreshCw,
  Sprout,
  Users,
  X,
} from "lucide-react";
import { logoutAction } from "../app/actions";
import {
  campusApi,
  CampusError,
  type ApiUser,
  type ApiSpace,
  type ApiProject,
  type ApiTeam,
  type ApiSubmission,
  type ApiInvitation,
} from "../lib/campus-api";
import { rubric, score } from "../lib/model";

type FormName = "space" | "team" | "project" | "submission" | null;
type Member = ApiUser & { role: string };
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="connected-dialog-title"
    >
      <div className="dialog-header">
        <h2 id="connected-dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Tanca el formulari"
          onClick={close}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ConnectedCampus() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [spaces, setSpaces] = useState<ApiSpace[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projectId, setProjectId] = useState("");
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [submissionId, setSubmissionId] = useState("");
  const [teamMembers, setTeamMembers] = useState<ApiUser[]>([]);
  const [form, setForm] = useState<FormName>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [revision, setRevision] = useState(0);
  const [invitation, setInvitation] = useState<
    (ApiInvitation & { url: string }) | null
  >(null);
  const space = spaces.find((s) => s.id === spaceId);
  const project = projects.find((p) => p.id === projectId);
  const submission =
    submissions.find((s) => s.id === submissionId) ?? submissions.at(-1);
  const teacher = space?.role === "teacher";
  const [query, setQuery] = useState("");
  const [scores, setScores] = useState(["", "", "", ""]);
  const [feedback, setFeedback] = useState("");
  const allScored = scores.every(
    (v) => v !== "" && Number(v) >= 0 && Number(v) <= 10,
  );
  function fail(value: unknown) {
    setError(
      value instanceof Error
        ? value.message
        : "No s’ha pogut completar l’acció.",
    );
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      campusApi<ApiUser>("/me"),
      campusApi<ApiSpace[]>("/spaces?limit=100"),
    ])
      .then(([profile, rows]) => {
        if (active) {
          setUser(profile);
          setSpaces(rows);
          setSpaceId(rows[0]?.id ?? "");
        }
      })
      .catch((e) => {
        if (active) fail(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!spaceId || !space) return;
    let active = true;
    setLoadingDetail(true);
    Promise.all([
      campusApi<ApiProject[]>(`/spaces/${spaceId}/projects?limit=100`),
      campusApi<ApiTeam[]>(`/spaces/${spaceId}/teams?limit=100`),
      space.role === "teacher"
        ? campusApi<Member[]>(`/spaces/${spaceId}/members?limit=100`)
        : Promise.resolve([]),
    ])
      .then(([rows, groups, roster]) => {
        if (active) {
          setProjects(rows);
          setTeams(groups);
          setMembers(roster);
        }
      })
      .catch((e) => {
        if (active) fail(e);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [spaceId, space?.role, revision]);
  useEffect(() => {
    setSubmissions([]);
    setTeamMembers([]);
    setScores(["", "", "", ""]);
    setFeedback("");
    if (!projectId || !project?.team_id) return;
    let active = true;
    setLoadingDetail(true);
    Promise.all([
      campusApi<ApiSubmission[]>(
        `/projects/${projectId}/submissions?limit=100`,
      ),
      campusApi<ApiUser[]>(`/teams/${project.team_id}/members?limit=100`),
    ])
      .then(([rows, people]) => {
        if (active) {
          setSubmissions(rows);
          setTeamMembers(people);
        }
      })
      .catch((e) => {
        if (active) fail(e);
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, project?.team_id, revision]);
  useEffect(() => {
    setScores(["", "", "", ""]);
    setFeedback("");
  }, [submission?.id]);

  function changeSpace(id: string) {
    setSpaceId(id);
    setProjectId("");
    setSubmissionId("");
    setProjects([]);
    setTeams([]);
    setMembers([]);
    setInvitation(null);
    setError("");
    setMessage("");
    setQuery("");
  }
  async function mutate(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function handleForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate(async () => {
      if (form === "space") {
        const created = await campusApi<ApiSpace>("/spaces", "POST", {
          title: String(data.get("title")).trim(),
          subject: String(data.get("subject")).trim(),
          due_at: data.get("due") || null,
        });
        setSpaces((rows) => [...rows, created]);
        changeSpace(created.id);
        setMessage("Espai docent creat. Ja pots convidar els alumnes.");
      } else if (form === "team") {
        const created = await campusApi<ApiTeam>(
          `/spaces/${spaceId}/teams`,
          "POST",
          { name: String(data.get("name")).trim() },
        );
        setTeams((rows) => [...rows, created]);
        setRevision((n) => n + 1);
        setMessage("Equip creat amb el teu compte com a membre.");
      } else if (form === "project") {
        const created = await campusApi<ApiProject>(
          `/teams/${data.get("team")}/projects`,
          "POST",
          {
            title: String(data.get("title")).trim(),
            description: String(data.get("description")).trim(),
            category: String(data.get("category")).trim(),
          },
        );
        setProjects((rows) => [...rows, created]);
        setProjectId(created.id);
        setSubmissionId("");
        setRevision((n) => n + 1);
        setMessage("Projecte creat al teu equip.");
      } else if (form === "submission") {
        const created = await campusApi<ApiSubmission>(
          `/projects/${projectId}/submissions`,
          "POST",
          { note: String(data.get("note")).trim() },
        );
        setSubmissions((rows) => [...rows, created]);
        setSubmissionId(created.id);
        setRevision((n) => n + 1);
        setMessage(
          `Versió ${created.version_number} presentada. El professor ja la pot consultar.`,
        );
      }
      setForm(null);
    });
  }
  async function invite(teamId?: string) {
    await mutate(async () => {
      const created = await campusApi<ApiInvitation>(
        teamId
          ? `/teams/${teamId}/invitations`
          : `/spaces/${spaceId}/invitations`,
        "POST",
        {},
      );
      const url = new URL("/campus/join", window.location.origin);
      url.hash = new URLSearchParams({ token: created.token }).toString();
      setInvitation({ ...created, url: url.href });
      setMessage(
        "Invitació creada. Comparteix l’enllaç només amb la persona convidada.",
      );
    });
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission || !allScored) return;
    await mutate(async () => {
      const review = await campusApi<ApiSubmission["review"]>(
        `/submissions/${submission.id}/reviews`,
        "POST",
        { scores: scores.map(Number), feedback: feedback.trim() },
      );
      setSubmissions((rows) =>
        rows.map((row) =>
          row.id === submission.id ? { ...row, review } : row,
        ),
      );
      setRevision((n) => n + 1);
      setMessage(
        "Avaluació publicada. L’alumne ja pot llegir-la des del seu compte.",
      );
    });
  }

  return (
    <div className="shell connected-shell">
      <aside className="sidebar">
        <Link className="brand" href="/campus">
          <span className="brand-icon">
            <Sprout size={25} />
          </span>
          <span>
            IncForStartUp<small>CAMPUS</small>
          </span>
        </Link>
        <div className="workspace-label">ELS TEUS ESPAIS</div>
        <nav aria-label="Espais del teu compte">
          <Link className="text-button" href="/private">
            Documents privats
          </Link>
          {spaces.map((s) => (
            <button
              className={`nav-item ${spaceId === s.id ? "active" : ""}`}
              key={s.id}
              onClick={() => changeSpace(s.id)}
              aria-label={s.title}
            >
              <BookOpen size={18} />
              <span>{s.title}</span>
            </button>
          ))}
        </nav>
        <button
          className="nav-item"
          onClick={() => {
            setError("");
            setForm("space");
          }}
          aria-label="Crea un espai docent"
        >
          <Plus size={18} />
          <span>Crea un espai docent</span>
        </button>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="profile-avatar">
              <Users size={18} />
            </span>
            <div>
              <strong>{user?.display_name ?? "El teu compte"}</strong>
              <small>Els permisos depenen de l’espai</small>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="nav-item" aria-label="Tanca la sessió">
              <LogOut size={17} />
              <span>Tanca la sessió</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="breadcrumb">
            Campus compartit <span>/</span>
            {space?.title ?? "Els teus espais"}
          </span>
          <div className="topbar-actions">
            <Link className="text-button" href="/lab">
              Laboratori
            </Link>
            <span className="demo-pill">
              <span />
              Compte connectat
            </span>
            <button
              className="icon-button"
              aria-label="Actualitza les dades"
              onClick={() => {
                setRevision((n) => n + 1);
                setError("");
              }}
            >
              <RefreshCw size={17} />
            </button>
            <form action={logoutAction} className="mobile-signout">
              <button className="icon-button" aria-label="Tanca la sessió">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <main>
          {error && !form && (
            <div className="notice error" role="alert">
              {error}
              <Link href="/login" className="text-button">
                Revisa l’accés
              </Link>
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}
          {loading ? (
            <div className="empty">
              <Sprout size={30} />
              <p>Carregant els espais del teu compte…</p>
            </div>
          ) : !space ? (
            <div className="panel empty">
              <BookOpen size={32} />
              <h1>Hola, {user?.display_name ?? "benvingut"}.</h1>
              <p>
                Si ets professor, crea un espai. Si ets alumne, obre la
                invitació que t’ha compartit el professor.
              </p>
              <button
                className="button primary"
                disabled={!user}
                onClick={() => setForm("space")}
              >
                <Plus size={17} />
                Crea el primer espai docent
              </button>
              <Link className="text-button" href="/campus/join">
                Tens una invitació? <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <>
              <div className="space-switcher">
                <label>
                  Espai docent
                  <select
                    aria-label="Espai docent actiu"
                    value={spaceId}
                    onChange={(e) => changeSpace(e.target.value)}
                  >
                    {spaces.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="badge green">
                  <span />
                  {teacher
                    ? "Professor d’aquest espai"
                    : "Alumne d’aquest espai"}
                </span>
              </div>
              {project ? (
                <>
                  <button
                    className="text-button back"
                    onClick={() => {
                      setProjectId("");
                      setSubmissionId("");
                    }}
                  >
                    <ArrowLeft size={16} />
                    Torna als projectes
                  </button>
                  <div className="page-heading project-heading">
                    <div>
                      <span className="eyebrow">
                        {space.title} / {project.category}
                      </span>
                      <h1>
                        {project.title}
                        <span className="title-dot">.</span>
                      </h1>
                      <p>{project.description}</p>
                      <div className="connected-members">
                        <Users size={16} />
                        {teamMembers.map((m) => m.display_name).join(", ")}
                      </div>
                    </div>
                    {!teacher && (
                      <div className="action-row">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => invite(project.team_id)}
                        >
                          Invita un company d’equip
                        </button>
                        <button
                          className="button primary"
                          onClick={() => {
                            setError("");
                            setForm("submission");
                          }}
                        >
                          <Plus size={17} />
                          Nova entrega
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="project-layout">
                    <section className="panel delivery-panel">
                      <div className="section-heading">
                        <h2>Entregues del projecte</h2>
                        <span className="count-label">
                          {submissions.length} versions
                        </span>
                      </div>
                      {loadingDetail ? (
                        <p className="muted">Carregant les entregues…</p>
                      ) : !submission ? (
                        <div className="empty">
                          <FileText size={30} />
                          <h3>Encara no hi ha entregues</h3>
                          <p>
                            L’equip pot presentar la primera versió del
                            projecte.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div
                            className="version-tabs"
                            aria-label="Versions del servidor"
                          >
                            {submissions.map((s) => (
                              <button
                                key={s.id}
                                className={
                                  s.id === submission.id ? "selected" : ""
                                }
                                aria-pressed={s.id === submission.id}
                                onClick={() => setSubmissionId(s.id)}
                              >
                                Versió {s.version_number}
                                {s.review && <Check size={13} />}
                              </button>
                            ))}
                          </div>
                          <h3>Versió {submission.version_number}</h3>
                          <p className="delivery-note">{submission.note}</p>
                          {submission.review ? (
                            <div className="feedback">
                              <span className="eyebrow">
                                AVALUACIÓ PUBLICADA
                              </span>
                              <p>{submission.review.feedback}</p>
                              <strong>
                                {submission.review.total.toLocaleString(
                                  "ca-ES",
                                )}{" "}
                                / 10
                              </strong>
                              <ul>
                                {submission.review.rubric_snapshot.map(
                                  (criterion, i) => (
                                    <li key={criterion.id}>
                                      {criterion.label}:{" "}
                                      {submission.review!.scores[i]} / 10 ·{" "}
                                      {criterion.weight}%
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          ) : (
                            <div className="waiting">
                              <FileText size={18} />
                              Pendent d’avaluació del professor.
                            </div>
                          )}
                        </>
                      )}
                    </section>
                    <aside className="detail-aside">
                      {teacher &&
                      submission &&
                      !submission.review &&
                      !loadingDetail ? (
                        <form className="panel review-form" onSubmit={publish}>
                          <div className="section-heading">
                            <h3>Avalua aquesta versió</h3>
                            <GraduationCap size={23} />
                          </div>
                          <p className="muted">
                            La valoració és teva. Un cop publicada, aquesta
                            revisió queda preservada a l’historial.
                          </p>
                          {rubric.map((criterion, i) => (
                            <label className="rubric-row" key={criterion.label}>
                              <span>
                                {criterion.label}
                                <small>{criterion.weight}%</small>
                              </span>
                              <span className="number-wrap">
                                <input
                                  aria-label={criterion.label}
                                  required
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  value={scores[i]}
                                  onChange={(e) =>
                                    setScores((rows) =>
                                      rows.map((n, j) =>
                                        j === i ? e.target.value : n,
                                      ),
                                    )
                                  }
                                />
                                <span>/ 10</span>
                              </span>
                            </label>
                          ))}
                          <div className="weighted">
                            <span>Proposta ponderada</span>
                            <strong>
                              {allScored
                                ? score(scores.map(Number)).toLocaleString(
                                    "ca-ES",
                                  )
                                : "—"}{" "}
                              / 10
                            </strong>
                          </div>
                          <label>
                            Comentari per a l’equip
                            <textarea
                              required
                              minLength={5}
                              maxLength={5000}
                              rows={4}
                              value={feedback}
                              onChange={(e) => setFeedback(e.target.value)}
                            />
                          </label>
                          <button
                            className="button primary"
                            disabled={busy || !allScored}
                          >
                            {busy ? "Publicant…" : "Publica l’avaluació"}
                          </button>
                        </form>
                      ) : (
                        <section className="panel next-steps">
                          <span className="mini-icon">
                            <Sprout size={24} />
                          </span>
                          <h3>La millora continua</h3>
                          <p>
                            Una entrega nova conserva les versions i les
                            avaluacions anteriors. Concreta què ha canviat i què
                            voleu validar.
                          </p>
                        </section>
                      )}
                    </aside>
                  </div>
                </>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">{space.subject}</span>
                      <h1>
                        {space.title}
                        <span className="title-dot">.</span>
                      </h1>
                      <p>
                        {teacher
                          ? "Convida els alumnes i acompanya els projectes del teu espai."
                          : "Aquest espai mostra només els projectes dels teus equips."}
                      </p>
                    </div>
                    <div className="action-row">
                      {teacher ? (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() => invite()}
                        >
                          <Plus size={17} />
                          Invita un alumne
                        </button>
                      ) : (
                        <>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setError("");
                              setForm("team");
                            }}
                          >
                            <Users size={17} />
                            Crea un equip
                          </button>
                          <button
                            className="button primary"
                            disabled={!teams.length}
                            onClick={() => {
                              setError("");
                              setForm("project");
                            }}
                          >
                            <Plus size={17} />
                            Nou projecte
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="filters">
                    <label className="search">
                      <FolderOpen size={17} />
                      <input
                        aria-label="Cerca projectes del teu compte"
                        placeholder="Cerca per nom, àmbit o descripció…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  {loadingDetail ? (
                    <p className="muted">Actualitzant els projectes…</p>
                  ) : (
                    <div className="project-grid">
                      {projects
                        .filter((p) =>
                          `${p.title} ${p.description} ${p.category}`
                            .toLocaleLowerCase()
                            .includes(query.toLocaleLowerCase()),
                        )
                        .map((p) => (
                          <button
                            className="project-card"
                            key={p.id}
                            onClick={() => {
                              setProjectId(p.id);
                              setSubmissionId("");
                              setMessage("");
                            }}
                          >
                            <div className="project-cover sage">
                              <span>{p.category}</span>
                              <Sprout size={65} strokeWidth={1.2} />
                            </div>
                            <div className="card-body">
                              <div className="card-space">
                                {teams.find((t) => t.id === p.team_id)?.name}
                              </div>
                              <h3>{p.title}</h3>
                              <p>{p.description}</p>
                              <footer className="card-footer">
                                <span>Obre el projecte i les entregues</span>
                                <ArrowRight size={16} />
                              </footer>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                  {!loadingDetail && !projects.length && (
                    <section className="panel empty">
                      <FolderOpen size={30} />
                      <h3>El primer projecte comença aquí</h3>
                      <p>
                        {teacher
                          ? "Els projectes apareixeran quan els alumnes els creïn amb el seu compte."
                          : teams.length
                            ? "Ja tens equip. Crea el vostre primer projecte."
                            : "Crea un equip per preparar el vostre primer projecte."}
                      </p>
                    </section>
                  )}
                  {teacher && (
                    <section className="panel roster">
                      <div className="section-heading">
                        <h2>Participants de l’espai</h2>
                        <span className="count-label">
                          {members.length} participants
                        </span>
                      </div>
                      {members.map((member) => (
                        <div key={member.id}>
                          <span>{member.display_name}</span>
                          <span className="badge gray">
                            {member.role === "teacher" ? "Professor" : "Alumne"}
                          </span>
                        </div>
                      ))}
                    </section>
                  )}
                  <p className="muted collection-limit">
                    Es mostren fins a 100 projectes, equips i participants per
                    espai.
                  </p>
                </>
              )}
            </>
          )}
          {invitation && (
            <section className="panel invitation-box">
              <div className="section-heading">
                <h2>Invitació d’un sol ús</h2>
                <CheckCircle2 size={20} />
              </div>
              <p>
                Comparteix-la amb la persona convidada. Caduca al cap de 24
                hores i no es pot reutilitzar.
              </p>
              <label>
                Enllaç d’invitació
                <input
                  aria-label="Enllaç d’invitació"
                  readOnly
                  value={invitation.url}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <div className="action-row">
                <button
                  className="button primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(invitation.url);
                      setMessage("Enllaç copiat.");
                    } catch {
                      setMessage(
                        "Selecciona i copia l’enllaç del camp de text.",
                      );
                    }
                  }}
                >
                  <Copy size={16} />
                  Copia l’enllaç
                </button>
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    mutate(async () => {
                      await campusApi(
                        `/invitations/${invitation.id}`,
                        "DELETE",
                      );
                      setInvitation(null);
                      setMessage("Invitació revocada.");
                    })
                  }
                >
                  Revoca la invitació
                </button>
                <button
                  className="text-button"
                  onClick={() => setInvitation(null)}
                >
                  Amaga l’enllaç
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
      {form && (
        <Dialog
          title={
            form === "space"
              ? "Crea un espai docent"
              : form === "team"
                ? "Crea el teu equip"
                : form === "project"
                  ? "Dona forma a una idea"
                  : "Presenta una nova versió"
          }
          close={() => {
            if (!busy) setForm(null);
          }}
        >
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={handleForm}>
            {form === "space" && (
              <>
                <label>
                  Nom de l’espai
                  <input name="title" required maxLength={100} />
                </label>
                <label>
                  Assignatura o àmbit
                  <input name="subject" required maxLength={150} />
                </label>
                <label>
                  Data orientativa d’entrega
                  <input name="due" type="date" />
                </label>
              </>
            )}
            {form === "team" && (
              <>
                <p className="muted">
                  El teu compte s’afegirà a l’equip. Després podràs convidar
                  companys que ja siguin alumnes d’aquest espai.
                </p>
                <label>
                  Nom de l’equip
                  <input name="name" required maxLength={100} />
                </label>
              </>
            )}
            {form === "project" && (
              <>
                <label>
                  Nom del projecte
                  <input name="title" required maxLength={100} />
                </label>
                <label>
                  Equip
                  <select name="team" aria-label="Equip del projecte">
                    {teams.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quin problema voleu resoldre?
                  <textarea
                    name="description"
                    required
                    minLength={20}
                    maxLength={5000}
                    rows={4}
                  />
                </label>
<ProjectDomain />
              </>
            )}
            {form === "submission" && (
              <>
                <p className="muted">
                  Aquesta entrega de text quedarà desada al projecte i
                  disponible per al professor.
                </p>
                <label>
                  Què heu treballat?
                  <textarea
                    name="note"
                    required
                    minLength={10}
                    maxLength={10000}
                    rows={6}
                  />
                </label>
              </>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Cancel·la
              </button>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Desant…"
                  : form === "submission"
                    ? "Presenta l’entrega"
                    : form === "space"
                      ? "Crea l’espai"
                      : form === "team"
                        ? "Crea l’equip"
                        : "Crea el projecte"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
