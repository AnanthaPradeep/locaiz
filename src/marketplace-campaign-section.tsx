import type { MouseEvent } from "react";
import { CampaignCard } from "./home-campaign-section";
import { marketClient } from "./market-foundation";
import { campaignDiscount, campaignMediaRoot, selectCampaigns, type CampaignPage } from "./marketplace-campaigns";

export function MarketplaceCampaignSection({ page, beforeNavigate, inline = false }: {
  page: CampaignPage;
  beforeNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  inline?: boolean;
}) {
  const campaigns = inline ? selectCampaigns(page, "inline") : [...selectCampaigns(page, "hero"), ...selectCampaigns(page, "collection")];
  if (!campaigns.length) return null;
  return (
    <section className={"marketplace-campaigns home-campaign-grid" + (inline ? " marketplace-campaigns-inline" : "")}
      aria-label={inline ? "Sourcing promotion" : "Marketplace promotions"}>
      {campaigns.map((promotion) => (
        <CampaignCard
          key={promotion.id}
          campaign={{
            ...promotion,
            href: marketClient && promotion.connectedHref ? promotion.connectedHref : promotion.href,
            layout: promotion.placement === "collection" ? "collection" : "featured",
            discountLabel: campaignDiscount(promotion.verifiedOffer),
          }}
          heading={promotion.placement === "hero" ? "h2" : "h3"}
          mediaRoot={campaignMediaRoot}
          illustrative={promotion.illustrative}
          beforeNavigate={beforeNavigate}
        />
      ))}
    </section>
  );
}
