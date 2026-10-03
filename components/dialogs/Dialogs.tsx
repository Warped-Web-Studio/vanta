"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useVanta, vanta } from "@/lib/store";
import { allocation, dossier, ledger, final } from "@/lib/content";
import { sound } from "@/lib/audio/Sound";

// Native <dialog>s: focus is trapped and Esc closes them for free. Rendering pauses
// while one is open.

function Sheet({ open, title, onClose, children, labelId }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; labelId: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      onClose={onClose}
      onCancel={onClose}
      className="sheet fixed m-0 ml-auto h-[100dvh] max-h-none w-[min(640px,100vw)] max-w-none overflow-y-auto border-0 border-l border-bone/15 bg-carbon p-0 text-bone"
    >
      <div className="sticky top-0 flex items-center justify-between bg-carbon/95 px-[var(--gutter)] py-5">
        <h2 id={labelId} className="t-mono text-ash">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="t-mono text-bone hover:text-white py-1">
          CLOSE
        </button>
      </div>
      <div className="px-[var(--gutter)] pb-16">{children}</div>
    </dialog>
  );
}

type Status = "idle" | "sending" | "done" | "error";

function AllocationForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ref, setRef] = useState("");
  const id = useId();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries()) as Record<string, string>;
    const errs: Record<string, string> = {};
    if (!data.name?.trim()) errs.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email ?? "")) errs.email = "Enter a valid email address.";
    if (!data.country) errs.country = "Choose a country.";
    if (data.serial && (!/^\d{1,3}$/.test(data.serial) || +data.serial < 2 || +data.serial > 99)) errs.serial = "Serials 002 to 099 are available.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      (e.currentTarget.querySelector(`[name="${Object.keys(errs)[0]}"]`) as HTMLElement | null)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/allocation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.errors ?? {});
        setStatus("error");
        return;
      }
      setRef(json.ref);
      setStatus("done");
      sound.click(1.1);
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="pt-10" role="status">
        <p className="t-display text-[clamp(36px,5vw,64px)]">REQUEST LOGGED.</p>
        <p className="mt-6 max-w-[42ch] text-alloy">VANTA will contact you within 72 hours to confirm your allocation. Keep this reference.</p>
        <p className="mt-10 t-mono text-ash">REFERENCE</p>
        <p className="mt-1 font-mono text-[28px] tracking-[0.04em] [font-stretch:80%]">{ref}</p>
      </div>
    );
  }

  const field = "block w-full border border-bone/25 bg-void px-3.5 py-3 text-bone outline-none transition-colors placeholder:text-ash focus:border-bone";
  const label = "mb-2 block t-mono text-alloy";
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${id}-${k}-err`} className="mt-2 t-mono text-signal">
        {errors[k]}
      </p>
    ) : null;
  const desc = (k: string) => (errors[k] ? `${id}-${k}-err` : undefined);

  return (
    <form onSubmit={submit} noValidate className="pt-8">
      <p className="t-display text-[clamp(32px,4.2vw,56px)]">{allocation.title}</p>
      <p className="mt-5 max-w-[46ch] text-alloy">{allocation.intro}</p>
      <div className="mt-10 grid gap-6">
        <div>
          <label htmlFor={`${id}-name`} className={label}>
            FULL NAME
          </label>
          <input id={`${id}-name`} name="name" autoComplete="name" className={field} aria-invalid={!!errors.name} aria-describedby={desc("name")} />
          {err("name")}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={label}>
            EMAIL
          </label>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" className={field} aria-invalid={!!errors.email} aria-describedby={desc("email")} />
          {err("email")}
        </div>
        <div>
          <label htmlFor={`${id}-country`} className={label}>
            COUNTRY OF REGISTRATION
          </label>
          <select id={`${id}-country`} name="country" defaultValue="" className={field} aria-invalid={!!errors.country} aria-describedby={desc("country")}>
            <option value="" disabled>
              Select
            </option>
            {allocation.countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          {err("country")}
        </div>
        <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
          <div>
            <label htmlFor={`${id}-serial`} className={label}>
              PREFERRED SERIAL <span className="text-ash">(OPTIONAL)</span>
            </label>
            <input id={`${id}-serial`} name="serial" inputMode="numeric" placeholder="002 to 099" className={field} aria-invalid={!!errors.serial} aria-describedby={desc("serial") ?? `${id}-serial-help`} />
            {errors.serial ? err("serial") : (
              <p id={`${id}-serial-help`} className="mt-2 t-mono text-ash">
                001 is retained by VANTA.
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-machine`} className={label}>
              CURRENT MACHINE <span className="text-ash">(OPTIONAL)</span>
            </label>
            <input id={`${id}-machine`} name="machine" className={field} />
          </div>
        </div>
      </div>
      {status === "error" && !Object.keys(errors).length && (
        <p className="mt-6 t-mono text-signal" role="alert">
          The request did not go through. Try again in a moment.
        </p>
      )}
      <button type="submit" disabled={status === "sending"} className="btn-solid mt-10 w-full disabled:opacity-60">
        {status === "sending" ? "SENDING" : final.primary}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

function DossierBody() {
  return (
    <div className="pt-8">
      <p className="t-display text-[clamp(32px,4.2vw,56px)]">VANTA / R1</p>
      <p className="mt-3 t-mono text-ash">{dossier.title}</p>
      <div className="mt-12 grid grid-cols-2 gap-x-10 gap-y-12 max-md:grid-cols-1">
        {dossier.groups.map((g) => (
          <section key={g.title} className="border-t border-bone/20 pt-4">
            <h3 className="t-mono text-bone">{g.title.toUpperCase()}</h3>
            <dl className="mt-4 space-y-3">
              {g.rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="t-mono text-ash">{k.toUpperCase()}</dt>
                  <dd className="mt-0.5 text-[15px] text-bone">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <section className="mt-14 border-t border-bone/20 pt-4">
        <h3 className="t-mono text-bone">WHERE THE 37 KG WENT</h3>
        <dl className="mt-5 grid grid-cols-2 gap-x-10 gap-y-2.5 max-md:grid-cols-1">
          {ledger.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-[15px] text-alloy">{l.label}</dt>
              <dd className="font-mono text-[14px] text-bone [font-stretch:80%] tabular-nums">−{l.kg.toFixed(1)} KG</dd>
            </div>
          ))}
        </dl>
      </section>
      <button type="button" onClick={() => window.print()} className="btn-line mt-14">
        PRINT DOSSIER
      </button>
    </div>
  );
}

export function Dialogs() {
  const dialog = useVanta((s) => s.dialog);
  const close = () => vanta.setState({ dialog: null });
  const a = useId(), d = useId();
  return (
    <>
      <Sheet open={dialog === "allocation"} title="ALLOCATION" onClose={close} labelId={a}>
        <AllocationForm />
      </Sheet>
      <Sheet open={dialog === "dossier"} title="TECHNICAL DOSSIER" onClose={close} labelId={d}>
        <DossierBody />
      </Sheet>
    </>
  );
}
