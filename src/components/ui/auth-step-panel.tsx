import type { ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

/**
 * Progress rail for the auth wizards, shown beside the form from `lg` up.
 *
 * The forms already carry a compact progress bar, which is all there is room
 * for on a phone. On a wide screen that bar leaves most of the viewport empty
 * and still never says what the *remaining* steps are — you learn you are on
 * step 2 of 4 without learning what 3 and 4 will ask of you. This names them
 * all, marks the ones behind you as done, and gives the page a left edge.
 *
 * Presentational only: the caller owns `currentStep`, so the rail cannot drift
 * from the form it describes. Steps are not links — jumping into step 3 of a
 * wizard whose earlier fields are empty is not a state the form supports.
 */
export function AuthStepPanel({
  steps,
  currentStep,
  heading,
  caption,
  brandmark,
}: {
  steps: readonly { id: number; label: string }[];
  /** 1-based id of the step in progress. */
  currentStep: number;
  heading: string;
  caption: string;
  /**
   * Overrides the Vodium brandmark. The rail is the *only* brandmark from `xl`
   * up — the page header it sits beside is hidden at that width — so a
   * white-labelled host must pass its tenant's mark here or its customers meet
   * our branding instead of their own.
   */
  brandmark?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <span className="text-[color:var(--text-primary)]">
        {brandmark ?? (
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-vodium-gold/30 bg-[color:var(--surface-2)]">
              <span className="font-serif text-[15px] leading-none text-vodium-gold">
                V
              </span>
            </span>
            <span className="font-serif text-[13px] tracking-[0.16em]">
              VODIUM LEDGER
            </span>
          </Link>
        )}
      </span>

      <div className="mt-16">
        <h2 className="font-serif text-[26px] leading-tight tracking-[-0.015em] text-[color:var(--text-primary)]">
          {heading}
        </h2>
        <p className="mt-2.5 max-w-[16rem] text-[13px] leading-relaxed text-[color:var(--text-tertiary)]">
          {caption}
        </p>
      </div>

      <ol className="mt-10 space-y-1">
        {steps.map((s, i) => {
          const done = s.id < currentStep;
          const active = s.id === currentStep;
          const last = i === steps.length - 1;

          return (
            <li
              key={s.id}
              data-auth-step={s.id}
              aria-current={active ? "step" : undefined}
              className="flex gap-3.5"
            >
              {/* Marker + the rail joining it to the next one. */}
              <div className="flex flex-col items-center">
                <span
                  className={`tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors duration-200 ${
                    done
                      ? "border-vodium-gold/40 bg-vodium-gold/10 text-vodium-gold"
                      : active
                        ? "border-vodium-gold bg-vodium-gold text-vodium-black"
                        : "border-[color:var(--hairline)] text-[color:var(--text-quaternary)]"
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={2.5} aria-hidden /> : s.id}
                </span>
                {!last && (
                  <span
                    className={`my-1 w-px flex-1 transition-colors duration-200 ${
                      done ? "bg-vodium-gold/40" : "bg-[color:var(--hairline)]"
                    }`}
                  />
                )}
              </div>

              <span
                className={`pb-6 pt-1 text-[13px] transition-colors duration-200 ${
                  active
                    ? "font-medium text-[color:var(--text-primary)]"
                    : done
                      ? "text-[color:var(--text-tertiary)]"
                      : "text-[color:var(--text-quaternary)]"
                }`}
              >
                {s.label}
                {/* Done/in-progress is otherwise carried by colour alone. */}
                {(done || active) && (
                  <span className="sr-only">
                    {done ? " — completed" : " — current step"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
