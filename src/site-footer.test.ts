import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SocialLinks } from "./site-footer";
import type { SocialProfile } from "./organisation";

it("renders only enabled account URLs on the expected platform", () => {
  const profiles: SocialProfile[] = [
    {
      platform: "instagram",
      url: "https://www.instagram.com/fixture.shop/",
      enabled: true,
    },
    {
      platform: "facebook",
      url: "https://www.facebook.com/fixture.shop/",
      enabled: true,
    },
    {
      platform: "linkedin",
      url: "https://www.linkedin.com/company/fixture-shop/",
      enabled: true,
    },
    {
      platform: "youtube",
      url: "https://www.youtube.com/@fixture-shop",
      enabled: true,
    },
    { platform: "instagram", url: "", enabled: true },
    {
      platform: "instagram",
      url: "https://instagram.com/explore/",
      enabled: true,
    },
    { platform: "facebook", url: "https://facebook.com/", enabled: true },
    {
      platform: "linkedin",
      url: "https://linkedin.com.example.com/company/fixture",
      enabled: true,
    },
    { platform: "youtube", url: "http://youtube.com/@fixture", enabled: true },
    {
      platform: "youtube",
      url: "https://youtube.com/@disabled",
      enabled: false,
    },
  ];
  const markup = renderToStaticMarkup(createElement(SocialLinks, { profiles }));
  expect(markup).toContain("Follow LOCAIZ");
  expect(markup.match(/<svg /g)).toHaveLength(4);
  for (const name of ["Instagram", "Facebook", "LinkedIn", "YouTube"]) {
    expect(markup).toContain(`LOCAIZ on ${name} (opens in a new tab)`);
  }
  expect(
    markup.match(/target="_blank" rel="noopener noreferrer"/g),
  ).toHaveLength(4);
  expect(renderToStaticMarkup(createElement(SocialLinks, {}))).toBe("");
});
