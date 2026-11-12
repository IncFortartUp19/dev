"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Leaf,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Sprout,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  readStore,
  rubric,
  score,
  seed,
  status,
  type Delivery,
  type Project,
  type Role,
  type Space,
  type Store,
} from "../lib/model";
import { downloadFile, saveFiles } from "../lib/files";
import { IncubatedProjects } from "./incubated-projects";

const KEY = "incforstartup-campus-v1";
type View =
  | "Resum"
  | "Projectes"
  | "Espais docents"
  | "Entregues"
  | "Projectes incubats";
type ModalName = "space" | "project" | "delivery" | "join" | "help" | null;
const uid = () => crypto.randomUUID();
const date = (value: string) =>
  new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

function Badge({ project }: { project: Project }) {
  const value = status(project);
  return (
    <span
      className={`badge ${value === "Avaluat" ? "green" : value === "Esborrany" ? "gray" : "amber"}`}
    >
      <span />
      {value}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="modal-title">
      <div className="dialog-header">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Tanca" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Team({ names }: { names: string[] }) {
  return (
    <div className="team">
      <span className="avatars">
        {names.slice(0, 3).map((name, i) => (
          <span
            title={name}
            key={name + i}
            style={{ background: ["#d9e7d9", "#eddcd1", "#deddf0"][i % 3] }}
          >
            {initials(name)}
          </span>
        ))}
      </span>
      <span>{names.length} membres</span>
    </div>
  );
}
function ReviewForm({
  delivery,
  onSave,
}: {
  delivery: Delivery;
  onSave: (scores: number[], feedback: string) => void;
}) {
  const [values, setValues] = useState<string[]>(
    delivery.review?.scores.map(String) ?? ["", "", "", ""],
  );
  const [feedback, setFeedback] = useState(delivery.review?.feedback ?? "");
  const ready = values.every(
    (v) => v !== "" && Number(v) >= 0 && Number(v) <= 10,
  );
  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSave(values.map(Number), feedback.trim());
      }}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">AVALUACIÓ DOCENT</span>
          <h3>Una orientació per avançar</h3>
        </div>
        <GraduationCap size={23} />
      </div>
      <p className="muted">
        Valora aquesta versió. La nota és una proposta del professor, sense
        avaluació automàtica.
      </p>
      {rubric.map((criterion, i) => (
        <label className="rubric-row" key={criterion.label}>
          <span>
            {criterion.label}
            <small>{criterion.weight}% de la valoració</small>
          </span>
          <span className="number-wrap">
            <input
              aria-label={criterion.label}
              type="number"
              min="0"
              max="10"
              step="0.1"
              required
              value={values[i]}
              onChange={(e) =>
                setValues(values.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
            <span>/ 10</span>
          </span>
        </label>
      ))}
      <div className="weighted">
        <span>Valoració ponderada</span>
        <strong>
          {ready ? score(values.map(Number)).toLocaleString("ca-ES") : "—"}{" "}
          <small>/ 10</small>
        </strong>
      </div>
      <label>
        Comentari per a l’equip
        <textarea
          required
          minLength={5}
          maxLength={4000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Què funciona bé? Quin és el següent pas?"
          rows={4}
        />
      </label>
      <button className="button primary" type="submit">
        <Check size={17} />
        {delivery.review ? "Desa els canvis" : "Publica el feedback"}
      </button>
    </form>
  );
}

export default function Campus() {
  const [store, setStore] = useState<Store>(seed);
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState<Role>("teacher");
  const [view, setView] = useState<View>("Resum");
  const [spaceId, setSpaceId] = useState("all");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      setStore(readStore(localStorage.getItem(KEY)));
    } catch {
      setError(
        "No podem llegir les dades locals. Pots restablir la demostració des d’Ajuda.",
      );
    }
    setLoaded(true);
  }, []);
  function commit(next: Store): boolean {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setStore(next);
      setError("");
      return true;
    } catch {
      setError(
        "No s’han pogut desar els canvis al navegador. Exporta les dades abans de continuar.",
      );
      return false;
    }
  }
  function notify(text: string) {
    setMessage(text);
  }
  function navigate(next: View, selectedSpace = "all") {
    setView(next);
    setProjectId(null);
    setDeliveryId(null);
    setSpaceId(selectedSpace);
    setQuery("");
  }
  const own = store.projects.filter(
    (p) => role === "teacher" || p.team.includes("Laia Ferrer"),
  );
  const scoped = own.filter((p) => spaceId === "all" || p.spaceId === spaceId);
  const filtered = scoped.filter((p) =>
    `${p.title} ${p.description} ${p.category} ${p.team.join(" ")}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const visible =
    view === "Entregues"
      ? filtered.filter((p) => p.deliveries.length)
      : filtered;
  const project = own.find((p) => p.id === projectId);
  const space = store.spaces.find((s) => s.id === spaceId);
  const currentSpace = project
    ? store.spaces.find((s) => s.id === project.spaceId)
    : space;
  const delivery =
    project?.deliveries.find((d) => d.id === deliveryId) ??
    project?.deliveries.at(-1);
  const pending = scoped.filter((p) => status(p) === "Pendent de revisió");
  const totalDeliveries = scoped.reduce((n, p) => n + p.deliveries.length, 0);
  function patchProject(next: Project): boolean {
    return commit({
      ...store,
      projects: store.projects.map((p) => (p.id === next.id ? next : p)),
    });
  }
  function createSpace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Space = {
      id: uid(),
      title: String(data.get("title")).trim(),
      subject: String(data.get("subject")).trim(),
      due: String(data.get("due")),
      code: `DEMO-${uid().slice(0, 6).toUpperCase()}`,
    };
    if (!next.title || !next.subject) return;
    if (commit({ ...store, spaces: [...store.spaces, next] })) {
      setModal(null);
      navigate("Projectes", next.id);
      notify("Espai creat en aquesta demostració.");
    }
  }
  function createProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Project = {
      id: uid(),
      title: String(data.get("title")).trim(),
      description: String(data.get("description")).trim(),
      spaceId: String(data.get("space")),
      category: String(data.get("category")),
      color: "sage",
      team: [
        "Laia Ferrer",
        ...String(data.get("team") ?? "")
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n && n !== "Laia Ferrer"),
      ].filter((n, i, a) => a.indexOf(n) === i),
      deliveries: [],
    };
    if (
      !next.title ||
      !next.description ||
      !store.spaces.some((s) => s.id === next.spaceId)
    )
      return;
    if (commit({ ...store, projects: [...store.projects, next] })) {
      setModal(null);
      setProjectId(next.id);
      setDeliveryId(null);
      notify("Projecte creat. Ja pots preparar la primera entrega.");
    }
  }
  async function submitDelivery(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!project) return;
    setError("");
    const data = new FormData(e.currentTarget);
    const files = data
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 5 || files.some((f) => f.size > 10 * 1024 * 1024)) {
      setError("Pots afegir fins a 5 fitxers, de 10 MB cadascun.");
      return;
    }
    const note = String(data.get("note")).trim();
    if (!note) return;
    setBusy(true);
    try {
      const uploads = files.map((file) => ({ id: uid(), file }));
      await saveFiles(uploads);
      const next: Delivery = {
        id: uid(),
        note,
        date: new Date().toISOString(),
        files: uploads.map((f) => ({
          id: f.id,
          name: f.file.name,
          size: f.file.size,
        })),
      };
      if (
        patchProject({ ...project, deliveries: [...project.deliveries, next] })
      ) {
        setModal(null);
        setDeliveryId(next.id);
        notify(
          "Entrega desada. Pots provar la revisió canviant a la vista de professor.",
        );
      }
    } catch {
      setError(
        "No s’han pogut guardar els fitxers en aquest navegador. L’entrega no s’ha publicat.",
      );
    } finally {
      setBusy(false);
    }
  }
  function saveReview(scores: number[], feedback: string) {
    if (!project || !delivery) return;
    if (feedback.length < 5) {
      setError("Escriu un comentari de com a mínim 5 caràcters.");
      return;
    }
    const review = { scores, feedback, date: new Date().toISOString() };
    if (
      patchProject({
        ...project,
        deliveries: project.deliveries.map((d) =>
          d.id === delivery.id ? { ...d, review } : d,
        ),
      })
    )
      notify("Feedback publicat per a aquesta versió.");
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "incforstartup-demo.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  if (!loaded)
    return (
      <main className="loading">
        <Sprout size={32} />
        <p>Preparant el teu espai…</p>
      </main>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Resum");
          }}
        >
          <span className="brand-icon">
            <Sprout size={25} />
          </span>
          <span>
            IncForStartUp<small>CAMPUS</small>
          </span>
        </a>
        <div className="workspace-label">EL TEU ESPAI DE TREBALL</div>
        <nav aria-label="Navegació principal">
          {(
            [
              { title: "Resum", Icon: LayoutDashboard },
              { title: "Projectes", Icon: FolderOpen },
              { title: "Espais docents", Icon: BookOpen },
              { title: "Entregues", Icon: FileText },
              { title: "Projectes incubats", Icon: Sprout },
            ] as const
          ).map(({ title, Icon }) => (
            <button
              key={title}
              onClick={() => navigate(title)}
              className={
                view === title && !project ? "nav-item active" : "nav-item"
              }
            >
              <Icon size={19} />
              {title}
              {title === "Entregues" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
          <a className="nav-item" href="/private">
            <LockKeyhole size={19} /> Documents privats
          </a>
        </nav>
        <div className="sidebar-spaces">
          <div className="workspace-label">
            ESPAIS DOCENTS{" "}
            <button
              aria-label={
                role === "teacher"
                  ? "Crea un espai docent"
                  : "Entra amb un codi"
              }
              className="icon-button"
              onClick={() => setModal(role === "teacher" ? "space" : "join")}
            >
              <Plus size={16} />
            </button>
          </div>
          {store.spaces.map((s, i) => (
            <button
              key={s.id}
              className={`space-nav ${spaceId === s.id ? "selected" : ""}`}
              onClick={() => navigate("Projectes", s.id)}
            >
              <span className={`space-dot dot-${i % 3}`} />
              {s.title}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="grow-card">
            <span className="mini-icon">
              <Lightbulb size={20} />
            </span>
            <strong>Les idees necessiten espai.</strong>
            <p>Dona’ls un lloc on créixer, pas a pas i en equip.</p>
            <button onClick={() => setModal("help")}>
              Descobreix el prototip <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setModal("help")}>
            <CircleHelp size={18} />
            Ajuda i dades locals
          </button>
          <div className="profile">
            <span className="profile-avatar">
              {role === "teacher" ? "MS" : "LF"}
            </span>
            <div>
              <strong>
                {role === "teacher" ? "Marta Soler" : "Laia Ferrer"}
              </strong>
              <small>
                {role === "teacher"
                  ? "Professora · compte de mostra"
                  : "Alumna · compte de mostra"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            Campus <span>/</span> {project ? "Projecte" : view}
          </div>
          <div className="topbar-actions">
            <a className="text-button" href="/lab">
              Laboratori
            </a>
            <a href="/campus" className="text-button connected-link">
              Campus compartit <ArrowUpRight size={14} />
            </a>
            <span className="demo-pill">
              <span />
              Prototip local
            </span>
            <button
              className="icon-button topbar-help"
              aria-label="Ajuda del prototip"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={18} />
            </button>
            <label className="role-switch">
              <span>Vista de</span>
              <select
                aria-label="Vista de demostració"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  navigate("Resum");
                }}
              >
                <option value="teacher">Professor</option>
                <option value="student">Alumne</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </header>
        <main>
          {error && !modal && (
            <div className="notice error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Tanca l’avís"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              <CheckCircle2 size={18} />
              {message}
              <button
                className="icon-button"
                aria-label="Tanca el missatge"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {view === "Projectes incubats" ? (
            <IncubatedProjects />
          ) : project ? (
            <>
              <button
                className="text-button back"
                onClick={() => setProjectId(null)}
              >
                <ArrowLeft size={16} />
                Torna als projectes
              </button>
              <div className="page-heading project-heading">
                <div>
                  <span className="eyebrow">
                    {currentSpace?.title} / {project.category}
                  </span>
                  <h1>
                    {project.title}
                    <span className="title-dot">.</span>
                  </h1>
                  <p>{project.description}</p>
                  <div className="project-meta">
                    <Team names={project.team} />
                    <Badge project={project} />
                    <span className="privacy">
                      <LockKeyhole size={13} />
                      Privat
                    </span>
                  </div>
                </div>
                {role === "student" && (
                  <button
                    className="button primary"
                    onClick={() => setModal("delivery")}
                  >
                    <Upload size={17} />
                    Nova entrega
                  </button>
                )}
              </div>
              <div className="project-layout">
                <section className="panel delivery-panel">
                  <div className="section-heading">
                    <h2>Entregues del projecte</h2>
                    <span className="count-label">
                      {project.deliveries.length} versions
                    </span>
                  </div>
                  {!delivery ? (
                    <div className="empty">
                      <Upload size={30} />
                      <h3>El primer pas comença aquí</h3>
                      <p>Encara no s’ha presentat cap entrega.</p>
                      {role === "student" && (
                        <button
                          className="button primary"
                          onClick={() => setModal("delivery")}
                        >
                          Presenta la primera versió
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="version-tabs" aria-label="Versions">
                        {project.deliveries.map((d, i) => (
                          <button
                            aria-pressed={delivery.id === d.id}
                            className={delivery.id === d.id ? "selected" : ""}
                            key={d.id}
                            onClick={() => setDeliveryId(d.id)}
                          >
                            Versió {i + 1}
                            {d.review && <CheckCircle2 size={13} />}
                          </button>
                        ))}
                      </div>
                      <div className="delivery-content">
                        <div className="section-heading">
                          <h3>
                            Versió {project.deliveries.indexOf(delivery) + 1}
                          </h3>
                          <span className="muted">{date(delivery.date)}</span>
                        </div>
                        <p className="delivery-note">{delivery.note}</p>
                        <h4>Documents adjunts</h4>
                        {delivery.files.length ? (
                          delivery.files.map((f) => (
                            <button
                              key={f.id}
                              className="file"
                              onClick={() =>
                                downloadFile(f.id, f.name).catch((err) =>
                                  setError(err.message),
                                )
                              }
                            >
                              <FileText size={20} />
                              <span>
                                {f.name}
                                <small>
                                  {Math.max(1, Math.round(f.size / 1024))} KB ·
                                  fitxer local
                                </small>
                              </span>
                              <ArrowDownToLine size={17} />
                            </button>
                          ))
                        ) : (
                          <p className="muted">
                            Aquesta versió no té fitxers adjunts.
                          </p>
                        )}
                        {delivery.review ? (
                          <div className="feedback">
                            <span className="eyebrow">
                              <MessageSquare size={14} /> FEEDBACK DEL PROFESSOR
                            </span>
                            <p>{delivery.review.feedback}</p>
                            <strong>
                              {score(delivery.review.scores).toLocaleString(
                                "ca-ES",
                              )}{" "}
                              / 10
                            </strong>
                            <small> · {date(delivery.review.date)}</small>
                          </div>
                        ) : (
                          <div className="waiting">
                            <Clock3 size={18} />
                            <span>Aquesta versió està pendent de revisió.</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
                <aside className="detail-aside">
                  {role === "teacher" && delivery ? (
                    <section className="panel">
                      <ReviewForm
                        key={delivery.id + (delivery.review?.date ?? "")}
                        delivery={delivery}
                        onSave={saveReview}
                      />
                    </section>
                  ) : (
                    <section className="panel next-steps">
                      <span className="mini-icon">
                        <Lightbulb size={23} />
                      </span>
                      <h3>El teu següent pas</h3>
                      <p>
                        {delivery?.review
                          ? "Revisa el feedback i prepara una versió que expliqui què ha canviat."
                          : "Explica el problema, aporta evidències i concreta què voleu validar."}
                      </p>
                      <ul>
                        <li>Quina necessitat voleu resoldre?</li>
                        <li>Què heu après de les persones usuàries?</li>
                        <li>Com sabreu si la proposta funciona?</li>
                      </ul>
                      <small>Guia editorial · IA encara no connectada</small>
                    </section>
                  )}
                  <div className="privacy-note">
                    <LockKeyhole size={17} />
                    <p>
                      Projecte privat en aquesta demostració. Els documents es
                      guarden només en aquest navegador.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {space
                      ? space.subject
                      : "EL TALENT D’AVUI, ELS PROJECTES DE DEMÀ"}
                  </span>
                  <h1>
                    {space
                      ? space.title
                      : view === "Resum"
                        ? `Hola, ${role === "teacher" ? "Marta" : "Laia"}`
                        : view}
                    <span className="title-dot">.</span>
                  </h1>
                  <p>
                    {space
                      ? "Un espai per compartir avenços i transformar idees en projectes."
                      : role === "teacher"
                        ? "Acompanya les idees. Fes créixer el talent del teu grup."
                        : "Les teves idees tenen recorregut. Fem el següent pas."}
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    setModal(role === "teacher" ? "space" : "project")
                  }
                >
                  <Plus size={18} />
                  {role === "teacher" ? "Crea un espai" : "Nou projecte"}
                </button>
              </div>
              {view === "Resum" && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-label">
                        <span /> APRENDRE. CREAR. EVOLUCIONAR.
                      </span>
                      <h2>
                        Les bones idees
                        <br />
                        creixen <em>en equip.</em>
                      </h2>
                      <p>
                        Un lloc per donar forma als projectes, compartir avenços
                        i convertir el feedback en el següent pas.
                      </p>
                      <button
                        className="button white"
                        onClick={() => navigate("Projectes")}
                      >
                        Explora els projectes <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit one" />
                      <div className="orbit two" />
                      <div className="art-star">✳</div>
                      <span className="floating-tag tag-one">
                        <Lightbulb size={17} />
                        Una idea
                      </span>
                      <span className="floating-tag tag-two">
                        <Users size={17} />
                        Un equip
                      </span>
                      <div className="art-core">
                        <Sprout size={60} strokeWidth={1.4} />
                      </div>
                      <span className="floating-tag tag-three">
                        <ArrowUpRight size={17} />
                        Moltes possibilitats
                      </span>
                    </div>
                  </section>
                  <div className="stats">
                    <div>
                      <span className="stat-icon sage">
                        <FolderOpen size={20} />
                      </span>
                      <div>
                        <strong>{scoped.length}</strong>
                        <span>Projectes en marxa</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon peach">
                        <Clock3 size={20} />
                      </span>
                      <div>
                        <strong>
                          {pending.length.toString().padStart(2, "0")}
                        </strong>
                        <span>Pendents de revisió</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon lavender">
                        <FileText size={20} />
                      </span>
                      <div>
                        <strong>
                          {totalDeliveries.toString().padStart(2, "0")}
                        </strong>
                        <span>Entregues presentades</span>
                      </div>
                    </div>
                    <div>
                      <span className="stat-icon sand">
                        <BookOpen size={20} />
                      </span>
                      <div>
                        <strong>
                          {store.spaces.length.toString().padStart(2, "0")}
                        </strong>
                        <span>Espais docents</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {view === "Espais docents" ? (
                <div className="spaces-grid">
                  {store.spaces.map((s) => (
                    <button
                      className="panel space-card"
                      key={s.id}
                      onClick={() => navigate("Projectes", s.id)}
                    >
                      <span className="mini-icon">
                        <BookOpen size={23} />
                      </span>
                      <h2>{s.title}</h2>
                      <p>{s.subject}</p>
                      <div>
                        <span>
                          {own.filter((p) => p.spaceId === s.id).length}{" "}
                          projectes
                        </span>
                        <span>Entrega: {date(s.due)}</span>
                      </div>
                      <footer>
                        <span>{s.code} · codi de mostra</span>
                        <ArrowUpRight size={19} />
                      </footer>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="overview-layout">
                  <section className="projects-section">
                    <div className="section-heading">
                      <h2>
                        {view === "Resum"
                          ? "Projectes que prenen forma"
                          : view === "Entregues"
                            ? "Seguiment d’entregues"
                            : "Tots els projectes"}{" "}
                        <span className="inline-count">{visible.length}</span>
                      </h2>
                      {view === "Resum" && (
                        <button
                          className="text-button"
                          onClick={() => navigate("Projectes")}
                        >
                          Veure’ls tots <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                    <div className="filters">
                      <label className="search">
                        <Search size={17} />
                        <input
                          aria-label="Cerca projectes"
                          placeholder="Cerca un projecte, equip o tema…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filtra per espai"
                        value={spaceId}
                        onChange={(e) => setSpaceId(e.target.value)}
                      >
                        <option value="all">Tots els espais</option>
                        {store.spaces.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="project-grid">
                      {visible.map((p) => (
                        <button
                          className="project-card"
                          key={p.id}
                          onClick={() => {
                            setProjectId(p.id);
                            setDeliveryId(null);
                            setMessage("");
                          }}
                        >
                          <div className={`project-cover ${p.color}`}>
                            <span>{p.category}</span>
                            {p.color === "sage" ? (
                              <Leaf size={65} strokeWidth={1.2} />
                            ) : p.color === "peach" ? (
                              <Users size={65} strokeWidth={1.2} />
                            ) : (
                              <Lightbulb size={65} strokeWidth={1.2} />
                            )}
                            <span className="cover-arrow">
                              <ArrowUpRight size={19} />
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="card-space">
                              {
                                store.spaces.find((s) => s.id === p.spaceId)
                                  ?.title
                              }
                            </div>
                            <h3>{p.title}</h3>
                            <p>{p.description}</p>
                            <Badge project={p} />
                            <div className="card-footer">
                              <Team names={p.team} />
                              <span title="Nombre d’entregues">
                                <FileText size={14} />
                                {p.deliveries.length}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {!visible.length && (
                      <div className="empty panel">
                        <FolderOpen size={28} />
                        <h3>
                          {query
                            ? "No hem trobat coincidències"
                            : "Un espai per a la pròxima idea"}
                        </h3>
                        <p>
                          {query
                            ? "Prova un altre tema o canvia el filtre d’espai."
                            : "Encara no hi ha projectes per mostrar amb aquests filtres."}
                        </p>
                        {query && (
                          <button
                            className="text-button"
                            onClick={() => setQuery("")}
                          >
                            Esborra la cerca
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                  <aside className="overview-aside">
                    <section className="panel agenda">
                      <div className="section-heading">
                        <h3>Properes entregues</h3>
                        <BookOpen size={18} />
                      </div>
                      {store.spaces.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => navigate("Projectes", s.id)}
                        >
                          <span className="calendar">
                            <strong>{s.due.slice(-2)}</strong>
                            <small>
                              {new Intl.DateTimeFormat("ca-ES", {
                                month: "short",
                                timeZone: "UTC",
                              })
                                .format(new Date(s.due))
                                .replace(".", "")
                                .toUpperCase()}
                            </small>
                          </span>
                          <span>
                            <strong>{s.title}</strong>
                            <small>{s.subject}</small>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                      <div className="agenda-footer">
                        <Clock3 size={14} />
                        Dates orientatives de demostració
                      </div>
                    </section>
                    <section className="inspiration">
                      <span className="eyebrow">
                        <Sparkles size={15} /> UNA PREGUNTA PER AVANÇAR
                      </span>
                      <blockquote>
                        «Què canviaria si la teva idea sortís de l’aula?»
                      </blockquote>
                      <p>
                        El projecte no s’acaba amb l’entrega. Aquest pot ser
                        només el començament.
                      </p>
                      <span>
                        IncForStartUp Campus <ArrowUpRight size={16} />
                      </span>
                    </section>
                    <div className="local-note">
                      <LockKeyhole size={15} />
                      <p>
                        Dades de mostra i canvis locals. Cap projecte es publica
                        a Internet.
                      </p>
                    </div>
                  </aside>
                </div>
              )}
              <footer className="page-footer">
                <span>
                  IncForStartUp Campus · Fet per donar recorregut a les idees.
                </span>
                <span>Prototip · Català</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal === "space"
              ? "Crea un espai docent"
              : modal === "project"
                ? "Dona forma a una idea"
                : modal === "delivery"
                  ? "Presenta una nova entrega"
                  : modal === "join"
                    ? "Entra en un espai"
                    : "Un primer espai per provar-ho"
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {modal === "space" && (
            <form onSubmit={createSpace}>
              <p className="muted">
                Organitza un grup, una assignatura o un repte. El codi serà de
                demostració, sense invitacions reals.
              </p>
              <label>
                Nom de l’espai
                <input
                  name="title"
                  required
                  maxLength={100}
                  placeholder="Ex. Laboratori de projectes"
                />
              </label>
              <label>
                Assignatura o àmbit
                <input
                  name="subject"
                  required
                  maxLength={120}
                  placeholder="Ex. Emprenedoria i innovació"
                />
              </label>
              <label>
                Data d’entrega
                <input
                  type="date"
                  name="due"
                  required
                  defaultValue="2026-12-18"
                />
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancel·la
                </button>
                <button className="button primary">Crea l’espai</button>
              </div>
            </form>
          )}
          {modal === "project" && (
            <form onSubmit={createProject}>
              <p className="muted">
                Una primera versió és suficient per començar. El projecte serà
                privat en aquesta demostració.
              </p>
              <label>
                Nom del projecte
                <input
                  name="title"
                  maxLength={100}
                  required
                  placeholder="Com es diu la vostra idea?"
                />
              </label>
              <label>
                Espai docent
                <select
                  name="space"
                  defaultValue={
                    spaceId === "all" ? store.spaces[0]?.id : spaceId
                  }
                >
                  {store.spaces.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.title}
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
                  maxLength={2000}
                  rows={4}
                />
              </label>
              <label>
                Àmbit
                <select name="category">
                  <option>Sostenibilitat</option>
                  <option>Tecnologia</option>
                  <option>Comunitat</option>
                  <option>Salut i benestar</option>
                  <option>Disseny</option>
                  <option>Altres</option>
                </select>
              </label>
              <label>
                Companys d’equip
                <input
                  name="team"
                  maxLength={300}
                  placeholder="Noms separats per comes"
                />
                <small>
                  Laia Ferrer s’hi afegeix com a alumna de mostra. No s’envien
                  invitacions.
                </small>
              </label>
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancel·la
                </button>
                <button className="button primary">Crea el projecte</button>
              </div>
            </form>
          )}
          {modal === "delivery" && (
            <form onSubmit={submitDelivery}>
              <p className="muted">
                Cada entrega crea una versió nova i conserva el feedback
                anterior.
              </p>
              <label>
                Què heu treballat?
                <textarea
                  name="note"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                  placeholder="Expliqueu els avenços, els canvis i els dubtes que voleu compartir."
                />
              </label>
              <label className="upload-zone">
                <Upload size={25} />
                <strong>Afegeix els documents del projecte</strong>
                <span>Fins a 5 fitxers · 10 MB per fitxer</span>
                <input name="files" type="file" multiple />
              </label>
              <p className="local-note">
                Els fitxers es guarden en aquest navegador. No hi ha càrrega al
                núvol ni compartició entre dispositius.
              </p>
              <div className="form-actions">
                <button
                  disabled={busy}
                  type="button"
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Cancel·la
                </button>
                <button disabled={busy} className="button primary">
                  {busy ? "Desant…" : "Presenta l’entrega"}
                </button>
              </div>
            </form>
          )}
          {modal === "join" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get("code"))
                  .trim()
                  .toUpperCase();
                const found = store.spaces.find((s) => s.code === code);
                if (!found) {
                  setError("No trobem aquest codi de demostració.");
                  return;
                }
                navigate("Projectes", found.id);
                setModal(null);
                notify(
                  "Espai seleccionat. Els codis només funcionen en aquesta demostració local.",
                );
              }}
            >
              <p>
                Prova <strong>DEMO-LAB</strong> per seleccionar el laboratori.
                No es creen permisos ni membresies reals.
              </p>
              <label>
                Codi de mostra
                <input name="code" required />
              </label>
              <div className="form-actions">
                <button className="button primary">Obre l’espai</button>
              </div>
            </form>
          )}
          {modal === "help" && (
            <div className="help-content">
              <p>
                Aquest és el primer prototip d’IncForStartUp Campus. Pots provar
                el recorregut d’alumne i professor amb el selector de la
                capçalera.
              </p>
              <ul>
                <li>
                  Projectes i revisions: emmagatzematge local del navegador.
                </li>
                <li>Fitxers: guardats localment amb IndexedDB.</li>
                <li>
                  Sense autenticació real, backend compartit ni IA connectada.
                </li>
                <li>
                  La guia de projecte és editorial; no consulta cap model d’IA.
                </li>
              </ul>
              <p>
                No hi incorporis dades personals ni treballs confidencials
                reals. L’exportació inclou les fitxes i revisions, però no els
                fitxers adjunts.
              </p>
              <button className="button secondary" onClick={exportData}>
                <ArrowDownToLine size={16} />
                Exporta les dades locals
              </button>
              <button
                className="text-button reset"
                onClick={() => {
                  if (
                    window.confirm(
                      "Vols restablir les fitxes, projectes i revisions de demostració? Els fitxers locals no s’esborraran.",
                    )
                  ) {
                    if (commit(seed())) {
                      navigate("Resum");
                      setModal(null);
                      notify("Demostració restablerta.");
                    }
                  }
                }}
              >
                Restableix les dades de mostra
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
