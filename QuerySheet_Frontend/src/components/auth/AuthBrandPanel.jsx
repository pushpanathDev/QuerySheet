function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-lime shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

const FEATURES = [
  "Upload CSV or Excel and analyze instantly",
  "AI-generated insights, trends & anomalies",
  "Chat with your data in plain English",
];

/**
 * Shared dark brand panel for the auth pages (Login / Register).
 * Hidden on small screens; the form column carries a compact logo there.
 */
export default function AuthBrandPanel({ headline, subtitle }) {
  return (
    <div className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-accent text-white p-12">
      {/* Ambient glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-brand/25 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-lime/10 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-brand" />
        <span className="font-display font-semibold text-xl tracking-tight">
          QuerySheet
        </span>
      </div>

      <div className="relative">
        <h1
          className="font-display font-bold text-white leading-none"
          style={{
            fontSize: "clamp(36px, 4vw, 56px)",
            letterSpacing: "-0.04em",
          }}
        >
          {headline}
        </h1>
        <p
          className="mt-5 text-white/70 text-lg max-w-md"
          style={{ letterSpacing: "-0.01em" }}
        >
          {subtitle}
        </p>

        <ul className="mt-8 space-y-3">
          {FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-center gap-3 text-sm text-white/85"
            >
              <CheckIcon />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/40">
        © {new Date().getFullYear()} QuerySheet. All rights reserved.
      </p>
    </div>
  );
}
