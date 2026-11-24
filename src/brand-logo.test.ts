import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";
import { symbolPath, wordmarkPath } from "./brand-geometry";

it("preserves original SVG paths and exposes both theme-aware fills", () => {
  expect(readFileSync("public/brand/symbol.svg", "utf8")).toContain(symbolPath);
  expect(readFileSync("public/brand/wordmark.svg", "utf8")).toContain(
    wordmarkPath,
  );
  const html = renderToStaticMarkup(createElement(BrandLogo));
  expect(html).toContain('viewBox="0 0 40 40"');
  expect(html).toContain('viewBox="0 0 114 24"');
  expect(html).toContain('fill="var(--ink)"');
  expect(html).toContain('fill="var(--milk)"');
});
it("renders the original icon without a wordmark in icon-only mode", () => {
  const html = renderToStaticMarkup(
    createElement(BrandLogo, { iconOnly: true }),
  );
  expect(html).toContain(symbolPath);
  expect(html).not.toContain(wordmarkPath);
  expect(html).toContain('aria-hidden="true"');
});
