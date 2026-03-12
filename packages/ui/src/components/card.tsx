import type { PropsWithChildren, ReactNode } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function Card({ title, eyebrow, actions, children }: CardProps) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 20,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
      }}
    >
      {(title || eyebrow || actions) && (
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            {eyebrow ? <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{eyebrow}</div> : null}
            {title ? <h3 style={{ margin: "6px 0 0", fontSize: 20 }}>{title}</h3> : null}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
