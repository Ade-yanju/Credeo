"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff,
  HelpCircle,
  MessageCircle,
  Pill,
  Printer,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  WashingMachine,
  RefreshCw,
} from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AuthStepPanel } from "@/components/ui/auth-step-panel";

/**
 * Vendor sign-up — a four-step wizard ending in an emailed verification code.
 *
 * Single centred column on the dark surface, matching sign-in and the
 * dashboard. The previous layout gave 42% of the viewport to a marketing panel
 * on a screen the vendor only reaches after already clicking "Start free
 * trial".
 */

const VENDOR_TYPES = [
  { value: "PROVISION_SHOP", label: "Provision shop", icon: ShoppingBag },
  { value: "FOOD_CANTEEN", label: "Food canteen", icon: UtensilsCrossed },
  { value: "LAUNDRY", label: "Laundry", icon: WashingMachine },
  { value: "PRINTING", label: "Printing", icon: Printer },
  { value: "BARBING_SALON", label: "Barbing salon", icon: Scissors },
  { value: "HAIR_SALON", label: "Hair salon", icon: Sparkles },
  { value: "PHARMACY", label: "Pharmacy", icon: Pill },
  { value: "MINI_MART", label: "Mini mart", icon: ShoppingCart },
  { value: "OTHER", label: "Other", icon: HelpCircle },
];

type PhoneCountry = "NG" | "US";

const PHONE_COUNTRIES: Record<
  PhoneCountry,
  { flag: string; dial: string; name: string; placeholder: string; hint: string; minDigits: number }
> = {
  NG: {
    flag: "🇳🇬",
    dial: "+234",
    name: "Nigeria",
    placeholder: "801 234 5678",
    hint: "Your Nigerian WhatsApp number",
    minDigits: 10,
  },
  US: {
    flag: "🇺🇸",
    dial: "+1",
    name: "United States",
    placeholder: "(415) 555-1234",
    hint: "Your US WhatsApp number",
    minDigits: 10,
  },
};

type FormData = {
  businessName: string;
  vendorType: string;
  location: string;
  community: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
};

const STEPS = [
  { id: 1, label: "Business" },
  { id: 2, label: "Community" },
  { id: 3, label: "Contact" },
  { id: 4, label: "Verify" },
];

export default function RegisterPage() {
  const router = useRouter();
  const submitting = useRef(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const countryRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [done, setDone] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>("NG");
  const [countryOpen, setCountryOpen] = useState(false);
  const [form, setForm] = useState<FormData>({
    businessName: "",
    vendorType: "",
    location: "",
    community: "",
    ownerName: "",
    phone: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // The country dropdown previously stayed open until you picked something or
  // typed in the number field — clicking anywhere else left it hanging.
  useEffect(() => {
    if (!countryOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!countryRef.current?.contains(e.target as Node)) setCountryOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCountryOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [countryOpen]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  const country = PHONE_COUNTRIES[phoneCountry];

  const fullPhone = (): string => {
    let digits = form.phone.replace(/\D/g, "");
    if (phoneCountry === "NG" && digits.startsWith("0")) digits = digits.slice(1);
    if (phoneCountry === "US" && digits.length === 11 && digits.startsWith("1"))
      digits = digits.slice(1);
    return `${country.dial}${digits}`;
  };

  const isValidPhoneFormat = (): boolean => {
    const digits = form.phone.replace(/\D/g, "");
    if (phoneCountry === "NG") return digits.length === 10 || digits.length === 11;
    if (phoneCountry === "US") return digits.length === 10;
    return false;
  };

  const getPhoneError = (): string | null => {
    if (!form.phone) return null;
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length === 0) return null;
    if (!isValidPhoneFormat()) {
      return phoneCountry === "NG"
        ? "Nigerian numbers must be 10–11 digits"
        : "US numbers must be exactly 10 digits";
    }
    return null;
  };

  const canAdvance = () => {
    if (step === 1)
      return form.businessName.length > 1 && !!form.vendorType && form.location.length > 2;
    if (step === 2) return form.community.length > 1;
    if (step === 3)
      return (
        form.ownerName.length > 2 &&
        form.phone.replace(/\D/g, "").length >= country.minDigits &&
        isValidPhoneFormat() &&
        form.email.includes("@") &&
        form.password.length >= 8
      );
    if (step === 4) return otp.join("").length === 6;
    return false;
  };

  const formPayload = () => ({
    businessName: form.businessName,
    vendorType: form.vendorType,
    location: form.location,
    community: form.community,
    ownerName: form.ownerName,
    phone: fullPhone(),
    email: form.email.trim().toLowerCase(),
    password: form.password,
  });

  async function handleRequestOtp() {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send code");
      setStep(4);
      setResendCooldown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length !== 6 || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formPayload(), otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formPayload()),
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
    const next = [...otp];
    text.split("").forEach((d, i) => {
      if (i < 6) next[i] = d;
    });
    setOtp(next);
    otpRefs.current[Math.min(text.length, 5)]?.focus();
  }

  if (done)
    return (
      <SuccessScreen
        name={form.ownerName}
        business={form.businessName}
        onDashboard={() => router.push("/dashboard")}
      />
    );

  const current = STEPS.find((s) => s.id === step);

  return (
    <div className="marketing-page flex min-h-screen justify-center gap-16 px-6 py-8 pb-safe pt-safe xl:gap-24">
      {/* Progress rail — wide screens only. Below xl the form's own bar and
          the header brandmark do this job, and the rail would crowd them. */}
      <aside
        aria-label="Sign-up progress"
        className="hidden w-64 shrink-0 py-2 xl:block"
      >
        <div className="sticky top-8">
          <AuthStepPanel
            steps={STEPS}
            currentStep={step}
            heading="Start tracking in minutes."
            caption="Four short steps. Your first 60 days are free, and no card is needed."
          />
        </div>
      </aside>

      <div className="flex w-full max-w-md flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between xl:hidden">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-vodium-gold/30 bg-[color:var(--surface-2)]">
            <span className="font-serif text-[15px] leading-none text-vodium-gold">V</span>
          </span>
          <span className="font-serif text-[13px] tracking-[0.16em] text-[color:var(--text-primary)]">
            VODIUM LEDGER
          </span>
        </Link>
        <Link
          href="/login"
          className="text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {/* Step indicator. The bare bar told you progress but not where you
            were; the label makes the wizard's length explicit up front.
            Hidden at xl, where the rail beside the form says the same thing
            with room to name every step. */}
        <div className="mb-8 xl:hidden">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-quaternary)]">
              {current?.label}
            </p>
            <p className="tnum text-[11px] text-[color:var(--text-quaternary)]">
              Step {step} of {STEPS.length}
            </p>
          </div>
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label="Sign-up progress"
          >
            {STEPS.map((s) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                  step >= s.id ? "bg-vodium-gold" : "bg-[color:var(--surface-3)]"
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <h1 className="font-serif text-[26px] leading-tight text-[color:var(--text-primary)]">
              Tell us about your shop
            </h1>
            <p className="mt-2 text-[14px] text-[color:var(--text-tertiary)]">
              This is how your business will appear to customers.
            </p>

            <div className="mt-7 space-y-5">
              <Field label="Business name" htmlFor="businessName" required>
                <input
                  id="businessName"
                  type="text"
                  placeholder="e.g. Mama Taiwo's Provisions"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  className="input-dark"
                  autoFocus
                />
              </Field>

              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-[color:var(--text-secondary)]">
                  Type of business <span className="text-[#F0736B]">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {VENDOR_TYPES.map((t) => {
                    const Icon = t.icon;
                    const sel = form.vendorType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => update("vendorType", t.value)}
                        aria-pressed={sel}
                        className={`flex flex-col items-center gap-2 rounded-lg border px-2 py-3 text-center transition-colors ${
                          sel
                            ? "border-vodium-gold/50 bg-vodium-gold/[0.07] text-[color:var(--text-primary)]"
                            : "border-[color:var(--hairline)] bg-[color:var(--surface-1)] text-[color:var(--text-tertiary)] hover:border-[color:var(--hairline-strong)]"
                        }`}
                      >
                        <Icon
                          size={16}
                          className={sel ? "text-vodium-gold" : "text-[color:var(--text-quaternary)]"}
                        />
                        <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <Field
                label="Business location"
                htmlFor="location"
                required
                hint="Where can customers find you?"
              >
                <input
                  id="location"
                  type="text"
                  placeholder="e.g. Shop 12, Yaba Market"
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  className="input-dark"
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-serif text-[26px] leading-tight text-[color:var(--text-primary)]">
              Which community?
            </h1>
            <p className="mt-2 text-[14px] text-[color:var(--text-tertiary)]">
              Your community, market, area or institution name.
            </p>

            <div className="mt-7">
              <Field
                label="Community or market"
                htmlFor="community"
                required
                hint="e.g. Yaba, Balogun Market, Victoria Island, UNILAG"
              >
                <input
                  id="community"
                  type="text"
                  placeholder="e.g. Yaba or Victoria Island"
                  value={form.community}
                  onChange={(e) => update("community", e.target.value)}
                  className="input-dark"
                  autoFocus
                  autoComplete="off"
                />
              </Field>

              {form.community.trim().length > 1 && (
                <p className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--hairline)] bg-[color:var(--surface-1)] px-3.5 py-2.5 text-[12px] text-[color:var(--text-tertiary)]">
                  <CheckCircle size={13} className="shrink-0 text-vodium-gold" />
                  Saved as{" "}
                  <span className="font-mono text-[color:var(--text-primary)]">
                    {form.community.trim().replace(/\s+/g, " ").toLowerCase()}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-serif text-[26px] leading-tight text-[color:var(--text-primary)]">
              Your details
            </h1>
            <p className="mt-2 text-[14px] text-[color:var(--text-tertiary)]">
              Set up your login credentials.
            </p>

            <div className="mt-7 space-y-5">
              <Field label="Your full name" htmlFor="ownerName" required>
                <input
                  id="ownerName"
                  type="text"
                  placeholder="e.g. Taiwo Adeyemi"
                  value={form.ownerName}
                  onChange={(e) => update("ownerName", e.target.value)}
                  className="input-dark"
                  autoFocus
                />
              </Field>

              <Field label="WhatsApp number" htmlFor="phone" required hint={country.hint}>
                <div className="flex">
                  <div ref={countryRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setCountryOpen((v) => !v)}
                      aria-haspopup="listbox"
                      aria-expanded={countryOpen}
                      className="flex h-full min-w-[92px] items-center gap-1.5 rounded-l-lg border border-r-0 border-[color:var(--hairline-strong)] bg-[color:var(--surface-2)] px-3 transition-colors hover:bg-[color:var(--surface-3)]"
                    >
                      <span className="select-none text-[15px] leading-none">{country.flag}</span>
                      <span className="tnum text-[14px] text-[color:var(--text-secondary)]">
                        {country.dial}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`text-[color:var(--text-quaternary)] transition-transform ${
                          countryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {countryOpen && (
                      <ul
                        role="listbox"
                        className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-[color:var(--hairline-strong)] bg-[color:var(--surface-2)] shadow-[var(--elev-2)]"
                      >
                        {(Object.entries(PHONE_COUNTRIES) as [PhoneCountry, typeof country][]).map(
                          ([code, c]) => (
                            <li key={code}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={phoneCountry === code}
                                onClick={() => {
                                  setPhoneCountry(code);
                                  setCountryOpen(false);
                                  update("phone", "");
                                }}
                                className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                                  phoneCountry === code
                                    ? "bg-vodium-gold/10 text-[color:var(--text-primary)]"
                                    : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-3)]"
                                }`}
                              >
                                <span className="text-[16px] leading-none">{c.flag}</span>
                                <span className="text-[13px]">{c.name}</span>
                                <span className="tnum ml-auto text-[12px] text-[color:var(--text-quaternary)]">
                                  {c.dial}
                                </span>
                              </button>
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                  </div>

                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder={country.placeholder}
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    aria-invalid={!!getPhoneError()}
                    className="input-dark flex-1 rounded-l-none"
                  />
                </div>

                {form.phone.replace(/\D/g, "").length > 0 &&
                  (getPhoneError() ? (
                    <p role="alert" className="mt-1.5 text-[12px] text-[#F0736B]">
                      {getPhoneError()}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] text-[color:var(--text-quaternary)]">
                      Stored as{" "}
                      <span className="tnum text-[color:var(--text-tertiary)]">{fullPhone()}</span>
                    </p>
                  ))}
              </Field>

              <Field label="Email address" htmlFor="email" required>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="input-dark"
                />
              </Field>

              <Field label="Password" htmlFor="password" required hint="Minimum 8 characters.">
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
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
                {form.password.length > 0 && form.password.length < 8 && (
                  <p className="mt-1.5 text-[12px] text-[#F0736B]">
                    {8 - form.password.length} more character
                    {8 - form.password.length !== 1 ? "s" : ""} needed.
                  </p>
                )}
              </Field>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-serif text-[26px] leading-tight text-[color:var(--text-primary)]">
              Verify your email
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
              We sent a 6-digit code to{" "}
              <span className="text-[color:var(--text-primary)]">{form.email}</span>. It expires
              in 10 minutes.
            </p>

            <fieldset className="mt-7">
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
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${i + 1} of 6`}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={handleOtpPaste}
                    className={`tnum aspect-square w-full rounded-lg border bg-[color:var(--surface-1)] text-center text-[18px] text-[color:var(--text-primary)] outline-none transition-colors ${
                      digit ? "border-vodium-gold/50" : "border-[color:var(--hairline-strong)]"
                    } focus:border-vodium-gold`}
                  />
                ))}
              </div>
            </fieldset>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResendOtp}
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
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-[#E5534B]/25 bg-[#E5534B]/10 px-3.5 py-2.5 text-[13px] text-[#F0736B]"
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-[color:var(--hairline)] pt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setStep(step - 1);
                if (step === 4) setOtp(["", "", "", "", "", ""]);
                setError(null);
              }}
              className="inline-flex items-center gap-2 text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[13px] text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              <ArrowLeft size={15} /> Home
            </Link>
          )}

          {step < 3 && (
            <ShimmerButton
              onClick={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
              className="gap-2"
            >
              Continue <ArrowRight size={15} />
            </ShimmerButton>
          )}
          {step === 3 && (
            <ShimmerButton
              onClick={handleRequestOtp}
              disabled={!canAdvance() || loading}
              className="gap-2"
            >
              {loading ? "Sending code…" : <>Continue <ArrowRight size={15} /></>}
            </ShimmerButton>
          )}
          {step === 4 && (
            <ShimmerButton
              onClick={handleVerifyOtp}
              disabled={!canAdvance() || loading}
              className="gap-2"
            >
              {loading ? "Creating account…" : "Create account"}
            </ShimmerButton>
          )}
        </div>
      </main>

      {/* These were href="#" — a consent line that links nowhere is worse than
          no link, since it is the record of what the vendor agreed to. */}
      <footer className="mx-auto w-full max-w-md text-center">
        <p className="text-[12px] leading-relaxed text-[color:var(--text-quaternary)]">
          By creating an account you agree to Vodium&rsquo;s{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 transition-colors hover:text-[color:var(--text-secondary)]"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 transition-colors hover:text-[color:var(--text-secondary)]"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[13px] font-medium text-[color:var(--text-secondary)]"
      >
        {label} {required && <span className="text-[#F0736B]">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[12px] text-[color:var(--text-quaternary)]">{hint}</p>
      )}
    </div>
  );
}

function SuccessScreen({
  name,
  business,
  onDashboard,
}: {
  name: string;
  business: string;
  onDashboard: () => void;
}) {
  const firstName = name.split(" ")[0];
  const waPhone = "+2347019575717";
  return (
    <div className="marketing-page flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-full border border-[#3FB950]/25 bg-[#3FB950]/10">
          <CheckCircle size={26} className="text-[#56C963]" />
        </span>
        <h1 className="font-serif text-[28px] leading-tight text-[color:var(--text-primary)]">
          Welcome, {firstName}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--text-tertiary)]">
          <span className="text-[color:var(--text-primary)]">{business}</span> is now on Vodium
          Ledger. Your 60-day free trial has started.
        </p>
        <div className="mt-8 space-y-3">
          <a
            href={`https://wa.me/${waPhone.replace("+", "")}?text=START`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold inline-flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[14px]"
          >
            <MessageCircle size={17} /> Activate WhatsApp bot
          </a>
          <button
            onClick={onDashboard}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--hairline-strong)] py-3 text-[14px] font-medium text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--text-quaternary)] hover:text-[color:var(--text-primary)]"
          >
            Go to my dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
