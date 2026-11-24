import { Link } from "react-router-dom";
import { symbolPath, wordmarkPath } from "./brand-geometry";

export function BrandLogo({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <span className="brand" aria-hidden="true">
      <svg className="brand-symbol" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="8" fill="var(--ink)" />
        <path fill="var(--milk)" d={symbolPath} />
      </svg>
      {!iconOnly && (
        <svg className="wordmark" viewBox="0 0 114 24">
          <path fill="var(--ink)" d={wordmarkPath} />
        </svg>
      )}
    </span>
  );
}

export function BrandHome() {
  return (
    <Link className="brand-link" to="/" aria-label="LOCAIZ home">
      <BrandLogo />
    </Link>
  );
}
