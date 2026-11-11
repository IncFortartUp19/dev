"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sprout } from "lucide-react";
import { campusApi, CampusError } from "../lib/campus-api";
import { loginAction, logoutAction } from "../app/actions";
const KEY = "campus-pending-invitation";
export function JoinSpace({ userName }: { userName: string | null }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    window.history.replaceState(null, "", "/campus/join");
    try {
      const value = fromLink ?? sessionStorage.getItem(KEY) ?? "";
      if (value && /^[A-Za-z0-9_-]{32,128}$/.test(value)) {
        sessionStorage.setItem(KEY, value);
        setToken(value);
      } else {
        sessionStorage.removeItem(KEY);
      }
    } catch {
      setError(
        "No podem conservar la invitació en aquesta pestanya. Inicia sessió i torna a obrir l’enllaç original.",
      );
    }
  }, []);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      await campusApi("/invitations/accept", "POST", { token });
      sessionStorage.removeItem(KEY);
      setToken("");
      setAccepted(true);
    } catch (e) {
      setError(
        e instanceof CampusError && e.status === 403
          ? "Per unir-te a un equip, primer has de ser alumne del seu espai docent. Demana la invitació de l’espai al professor."
          : e instanceof CampusError && e.status === 404
            ? "Aquesta invitació ha caducat, s’ha revocat o ja s’ha utilitzat. Demana’n una de nova."
            : e instanceof Error
              ? e.message
              : "No hem pogut acceptar la invitació.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="panel login-card">
        <span className="brand-icon">
          <Sprout size={28} />
        </span>
        <span className="eyebrow">UNA INVITACIÓ A FER CRÉIXER IDEES</span>
        <h1>
          {accepted
            ? "Ja tens accés a l’espai."
            : "El projecte comença amb tu."}
        </h1>
        {token && !accepted && (
          <button
            className="text-button"
            onClick={() => {
              sessionStorage.removeItem(KEY);
              setToken("");
              setError("");
            }}
          >
            Descarta aquesta invitació
          </button>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {accepted ? (
          <>
            <CheckCircle2 size={30} />
            <p>
              L’accés s’ha desat per al teu compte. Ja pots obrir els teus
              espais de Campus.
            </p>
            <Link className="button primary" href="/campus">
              Obre el Campus <ArrowRight size={17} />
            </Link>
          </>
        ) : token ? (
          userName ? (
            <>
              <p>
                Has iniciat sessió com a <strong>{userName}</strong>. Accepta la
                invitació amb aquest compte; no canviarà el rol que ja tinguis
                en altres espais.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={accept}
              >
                {busy ? "Confirmant…" : "Accepta la invitació"}
              </button>
              <form action={logoutAction}>
                <button className="text-button">
                  No és el meu compte: tanca la sessió
                </button>
              </form>
            </>
          ) : (
            <>
              <p>
                Inicia sessió amb el teu compte abans d’acceptar la invitació.
                No utilitzis el compte del professor.
              </p>
              <form action={loginAction}>
                <input type="hidden" name="next" value="/campus/join" />
                <button className="button primary">
                  Identifica’t per continuar <ArrowRight size={17} />
                </button>
              </form>
            </>
          )
        ) : (
          <>
            <p>
              Obre l’enllaç complet que t’ha compartit el professor o un membre
              del teu equip.
            </p>
            <Link className="text-button" href="/campus">
              Torna al Campus <ArrowRight size={15} />
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
