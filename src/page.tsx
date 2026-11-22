import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Page({
  title,
  label,
  intro,
  children,
}: {
  title: string;
  label?: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="wrap page">
      <div className="page-heading">
        {label && <span className="eyebrow">{label}</span>}
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {children}
    </main>
  );
}

export function Missing() {
  return (
    <Page title="Page not found">
      <Link className="button" to="/">
        Return to LOCAIZ
      </Link>
    </Page>
  );
}
