import type { CSSProperties, ReactNode } from "react";

export function SectionCard({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  accent,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  accent?: "default" | "executive" | "risk" | "insight";
}) {
  const shell =
    accent === "executive"
      ? sectionExecutive
      : accent === "risk"
        ? sectionRisk
        : accent === "insight"
          ? sectionInsight
          : sectionDefault;

  const accentKey = accent ?? "default";

  return (
    <section id={id} className="bai-section" data-accent={accentKey} style={{ ...sectionBase, ...shell }}>
      {(eyebrow || title || subtitle) && (
        <header style={{ marginBottom: "1.15rem" }}>
          <div className="bai-section-header-rule" aria-hidden />
          {eyebrow ? <div style={eyebrowStyle}>{eyebrow}</div> : null}
          <h2 style={h2}>{title}</h2>
          {subtitle ? <p style={sub}>{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}

const sectionBase: CSSProperties = {
  borderRadius: "var(--pinn-radius-lg)",
  padding: "1.35rem 1.5rem 1.45rem",
  marginBottom: "1.1rem",
  border: "1px solid var(--pinn-border-soft)",
  boxShadow: "var(--pinn-shadow-card)",
};

const sectionDefault: CSSProperties = {};

const sectionExecutive: CSSProperties = {};

const sectionRisk: CSSProperties = {};

const sectionInsight: CSSProperties = {};

const eyebrowStyle: CSSProperties = {
  fontSize: "0.62rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--pinn-text-muted)",
  fontWeight: 800,
  marginBottom: "0.35rem",
};

const h2: CSSProperties = {
  margin: 0,
  fontSize: "clamp(1.05rem, 1.8vw, 1.25rem)",
  fontWeight: 700,
  letterSpacing: "-0.025em",
  color: "var(--pinn-text-primary)",
  lineHeight: 1.25,
};

const sub: CSSProperties = {
  margin: "0.55rem 0 0",
  fontSize: "0.875rem",
  lineHeight: 1.6,
  color: "var(--pinn-text-secondary)",
  maxWidth: "62ch",
};
