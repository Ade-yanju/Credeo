"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AuthStepPanel } from "@/components/ui/auth-step-panel";

/**
 * Vendor sign-in — password, then a 6-digit code emailed via Resend.
 *
 * Laid out as a single centred column rather than the previous split with a
 * marketing panel. Someone reaching this screen has already decided; the
 * "127+ vendors / ₦47M tracked" stats that used to fill 42% of the viewport
 * were selling to a customer who is trying to log in.
 *
 * Dark surface, matching the marketing site and the dashboard — the form used
 * to sit on cream, so signing in flashed bright and then landed on a dark
 * dashboard.
 */

type Screen = "credentials" | "otp";

/** Sign-in is two stages, not a wizard — named here so the rail can list them. */
const LOGIN_STEPS = [
  { id: 1, label: "Email and password" },
  { id: 2, label: "Emailed code" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<{
    name: string;
    logoUrl: string | null;
    brandColor: string | null;
  } | null>(null);
  const submitting = useRef(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // White-label: if this host belongs to a supermarket tenant, brand the page.
  useEffect(() => {
    fetch("/api/tenant/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.organization && setTenant(d.organization))
      .catch(() => {});
  }, []);

  const brand = tenant?.brandColor || "#C9A961";

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      setScreen("otp");
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendCooldown(30);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setResending(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError(null);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const digits = text.split("");
    const next = [...otp];
    digits.forEach((d, i) => {
      if (i < 6) next[i] = d;
    });
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  const Brandmark = (
    <Link href="/" className="inline-flex items-center gap-2.5">
      {tenant?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tenant.logoUrl}
          alt={tenant.name}
          className="h-8 w-8 rounded-lg border object-cover"
          style={{ borderColor: `${brand}59` }}
        />
      ) : (
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-[color:var(--surface-2)]"
          style={{ borderColor: `${brand}59` }}
        >
          <span className="font-serif text-[15px] leading-none" style={{ color: brand }}>
            {tenant ? tenant.name.trim().charAt(0).toUpperCase() : "V"}
          </span>
        </span>
      )}
      <span
        className="font-serif text-[13px] tracking-[0.16em]"
        style={{ color: tenant ? brand : undefined }}
      >
        {tenant ? tenant.name.toUpperCase() : "VODIUM LEDGER"}
      </span>
    </Link>
  );

  return (
    <div className="marketing-page flex min-h-screen justify-center gap-16 px-6 py-8 pb-safe pt-safe xl:gap-24">
      {/* Progress rail — wide screens only, mirroring /register so the two
          screens feel like one flow. */}
      <aside
        aria-label="Sign-in progress"
        className="hidden w-64 shrink-0 py-2 xl:block"
      >
        <div className="sticky top-8">
          <AuthStepPanel
            steps={LOGIN_STEPS}
            currentStep={screen === "credentials" ? 1 : 2}
            heading="Welcome back."
            caption="Two steps: your password, then a code we email you."
            brandmark={Brandmark}
          />
        </div>
      </aside>

      <div className="flex w-full max-w-md flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between xl:hidden">
        <span className="text-[color:var(--text-primary)]">{Brandmark}</span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        {screen === "credentials" ? (
          <>
            <h1 className="font-serif text-[28px] leading-tight text-[color:var(--text-primary)]">
              Sign in
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
              Enter your password and we&rsquo;ll email you a verification code.
            </p>

            <form onSubmit={handleCredentials} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[13px] font-medium text-[color:var(--text-secondary)]"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  required
                  autoFocus
                  className="input-dark"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[13px] font-medium text-[color:var(--text-secondary)]"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[12px] text-[color:var(--text-quaternary)] transition-colors hover:text-vodium-gold"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    required
                    className="input-dark pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-quaternary)] transition-colors hover:text-[color:var(--text-primary)]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* role="alert" so a screen reader announces the failure rather
                  than leaving the user waiting on a form that silently stopped. */}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-[#E5534B]/25 bg-[#E5534B]/10 px-3.5 py-2.5 text-[13px] text-[#F0736B]"
                >
                  {error}
                </p>
              )}

              <ShimmerButton type="submit" disabled={loading} className="mt-2 w-full">
                {loading ? "Sending code…" : "Continue"}
              </ShimmerButton>
            </form>

            <p className="mt-8 text-center text-[13px] text-[color:var(--text-tertiary)]">
              No account?{" "}
              <Link
                href="/register"
                className="font-medium text-[color:var(--text-primary)] transition-colors hover:text-vodium-gold"
              >
                Sign up free
              </Link>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setScreen("credentials");
                setOtp(["", "", "", "", "", ""]);
                setError(null);
              }}
              className="mb-8 inline-flex items-center gap-2 self-start text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              <ArrowLeft size={15} /> Back
            </button>

            <h1 className="font-serif text-[28px] leading-tight text-[color:var(--text-primary)]">
              Check your email
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
              We sent a 6-digit code to{" "}
              <span className="text-[color:var(--text-primary)]">{email}</span>. It
              expires in 10 minutes.
            </p>

            <form onSubmit={handleOtp} className="mt-8 space-y-5">
              {/* Grouped as a fieldset so the six boxes read as one labelled
                  control instead of six anonymous text inputs. */}
              <fieldset>
                <legend className="mb-3 text-[13px] font-medium text-[color:var(--text-secondary)]">
                  Verification code
                </legend>
                <div className="flex gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      // Lets iOS and Android offer the emailed code as autofill.
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      aria-label={`Digit ${i + 1} of 6`}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpInput(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={handleOtpPaste}
                      className={`tnum aspect-square w-full rounded-lg border bg-[color:var(--surface-1)] text-center text-[18px] outline-none transition-colors ${
                        digit
                          ? "border-vodium-gold/50 text-[color:var(--text-primary)]"
                          : "border-[color:var(--hairline-strong)] text-[color:var(--text-primary)]"
                      } focus:border-vodium-gold`}
                    />
                  ))}
                </div>
              </fieldset>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-[#E5534B]/25 bg-[#E5534B]/10 px-3.5 py-2.5 text-[13px] text-[#F0736B]"
                >
                  {error}
                </p>
              )}

              <ShimmerButton
                type="submit"
                disabled={otp.join("").length < 6 || loading}
                className="w-full"
              >
                {loading ? "Verifying…" : "Verify and sign in"}
              </ShimmerButton>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="inline-flex items-center gap-2 text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)] disabled:pointer-events-none disabled:opacity-40"
              >
                <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
                {resendCooldown > 0 ? (
                  <span className="tnum">Resend in {resendCooldown}s</span>
                ) : (
                  "Resend code"
                )}
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="mx-auto w-full max-w-md text-center">
        <p className="text-[12px] text-[color:var(--text-quaternary)]">
          Protected by password and a one-time email code.
        </p>
      </footer>
      </div>
    </div>
  );
}
