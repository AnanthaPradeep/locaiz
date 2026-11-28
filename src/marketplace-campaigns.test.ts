import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { campaignDiscount, marketplaceCampaigns, selectCampaigns } from "./marketplace-campaigns";
import { resolveMarketplaceImage } from "./marketplace-images";

describe("marketplace promotions", () => {
  it("selects enabled page placements in order with one hero and one inline slot", () => {
    for (const page of ["nearby", "global-atlas", "care", "connect", "business"] as const) {
      const [hero] = selectCampaigns(page, "hero");
      expect(hero.page).toBe(page);
      expect(hero.mobileImage).toMatch(/-mobile\.webp$/);
      expect(selectCampaigns(page, "hero", [...marketplaceCampaigns, { ...hero, id: "also" }])).toHaveLength(1);
      expect(selectCampaigns(page, "hero", [{ ...hero, enabled: false }])).toEqual([]);
      expect(selectCampaigns(page, "inline").length).toBeLessThanOrEqual(1);
    }
    expect(selectCampaigns("global-atlas", "collection").map(({ id }) => id)).toEqual(["atlas-tamil-nadu", "atlas-kerala", "atlas-industrial"]);
    expect(marketplaceCampaigns.every((campaign) => !campaign.sponsored && !campaignDiscount(campaign.verifiedOffer))).toBe(true);
    expect(campaignDiscount({ id: "fixture", active: false, discountLabel: "Fixture" })).toBeUndefined();
    expect(campaignDiscount({ id: "fixture", active: true, discountLabel: "Fixture" })).toBe("Fixture");
  });

  it("prioritises existing images and limits illustrations to known demo listings", () => {
    expect(resolveMarketplaceImage({ id: "audio", name: "Headphone repair", section: "care", image: "approved" })).toMatchObject({ src: expect.stringContaining("images/approved.webp"), illustrative: false });
    expect(resolveMarketplaceImage({ id: "audio", name: "Headphone repair", section: "care" })).toMatchObject({ src: expect.stringContaining("care-electronics.webp"), alt: "", illustrative: true });
    expect(resolveMarketplaceImage({ id: "audio", name: "Headphones", section: "shop" })).toBeUndefined();
    expect(resolveMarketplaceImage({ id: "unmapped", name: "Workshop", section: "global" })).toBeUndefined();
  });

  it("ships unique encoded WebP assets for all configured campaigns", () => {
    const root = "public/images/marketplace-campaigns/";
    const names = readdirSync(root);
    const signatures = names.map((name) => {
      const bytes = readFileSync(root + name);
      expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
      return createHash("sha256").update(bytes).digest("hex");
    });
    expect(new Set(signatures).size).toBe(names.length);
    for (const item of marketplaceCampaigns) {
      expect(names).toContain(item.image);
      if (item.mobileImage) expect(names).toContain(item.mobileImage);
    }
  });
});
