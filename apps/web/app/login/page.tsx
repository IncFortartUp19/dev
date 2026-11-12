import Link from "next/link";
import { Sprout, ArrowRight, LockKeyhole } from "lucide-react";
import { loginConfig, loginDestination } from "../../lib/auth-config";
import { loginAction, privateLoginAction } from "../actions";
export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = !!loginConfig();
  return (
    <main className="login-page">
      <section className="panel login-card">
        <span className="brand-icon">
          <Sprout size={28} />
        </span>
        <span className="eyebrow">INCFORSTARTUP CAMPUS</span>
        <h1>
          Un compte.
          <br />
          Moltes idees per fer créixer.
        </h1>
        <p>
          Accedeix al teu espai, comparteix avenços i continua el projecte amb
          el teu equip.
        </p>
        {params.error && (
          <p className="notice error" role="alert">
            No hem pogut completar l’accés. Torna-ho a provar amb el teu compte.
          </p>
        )}
        {configured ? (
          <form
            action={
              params.next === "/private" && loginConfig()?.privateContext
                ? privateLoginAction
                : loginAction
            }
          >
            <input
              type="hidden"
              name="next"
              value={loginDestination(params.next)}
            />
            <button className="button primary">
              Continua amb el teu compte <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          <div className="waiting">
            <LockKeyhole size={20} />
            <p>
              L’accés compartit al pilot està en preparació. Mentrestant, pots
              explorar la demostració.
            </p>
          </div>
        )}
        <p className="muted">
          Cada participant utilitza el seu compte. El professor et pot donar
          accés a un espai amb una invitació.
        </p>
        <Link className="text-button" href="/demo">
          Explora la demostració local <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
