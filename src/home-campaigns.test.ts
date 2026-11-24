import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { HomeCampaignSection } from "./home-campaign-section";
import { homeCampaigns, type HomeCampaign } from "./home-campaigns";

function renderCampaigns(campaigns: readonly HomeCampaign[]) {
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(HomeCampaignSection, { campaigns })));
}

it("renders default campaigns in order with a responsive source and no promotional labels", () => {
  const html = renderCampaigns([...homeCampaigns].reverse());
  expect(html.indexOf("Crafted Close to Home")).toBeLessThan(
    html.indexOf("Upgrade Your Everyday Tech"),
  );
  expect(html.indexOf("Upgrade Your Everyday Tech")).toBeLessThan(
    html.indexOf("From Workshops to Factories"),
  );
  expect(html).toContain("crafted-close-home-desktop.webp");
  expect(html).toMatch(/<source[^>]+crafted-close-home-mobile.webp/);
  expect(html).not.toContain("Sponsored");
  expect(html).not.toContain("home-campaign-labels");
});
it("omits disabled campaigns and renders configured sponsorship and discount labels", () => {
  const html = renderCampaigns([
    { ...homeCampaigns[0], enabled: false },
    { ...homeCampaigns[1], sponsored: true, discountLabel: "Configured test offer" },
  ]);
  expect(html).not.toContain("Crafted Close to Home");
  expect(html).toContain("Sponsored");
  expect(html).toContain("Configured test offer");
});
