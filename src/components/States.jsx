export function Notice({ title, children, tone, actions = [] }) {
  return (
    <div className={`notice${tone ? ` notice--${tone}` : ""}`} role={tone === "error" ? "alert" : undefined}>
      <h2 className="notice__title">{title}</h2>
      {children && <p className="notice__text">{children}</p>}
      {actions.length > 0 && (
        <div className="notice__actions">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`btn${a.primary ? " btn--primary" : ""}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ rows = 5 }) {
  return (
    <div className="skeleton" role="status" aria-label="Chargement des prix">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton__row" />
      ))}
    </div>
  );
}
