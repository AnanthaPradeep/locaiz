import { useLocale } from "./i18n";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Page({
  title,
  translateTitle=false,
  label,
  intro,
  children,
}: {
  title: string;
  translateTitle?: boolean;
  label?: string;
  intro?: string;
  children: ReactNode;
}) {
  const {t}=useLocale();
  return (
    <main className="wrap page">
      <div className="page-heading">
        {label && <span className="eyebrow">{label}</span>}
        <h1>{translateTitle?t(title):title}</h1>
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
