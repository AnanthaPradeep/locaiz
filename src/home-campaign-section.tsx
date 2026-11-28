import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { asset } from "./catalog";
import { homeCampaigns, type HomeCampaign } from "./home-campaigns";

export function CampaignCard({ campaign, mediaRoot = "images/campaigns/", heading: Heading = "h3", illustrative, beforeNavigate }: {
  campaign: HomeCampaign;
  mediaRoot?: string;
  heading?: "h2" | "h3";
  illustrative?: boolean;
  beforeNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const campaignImage = (file: string) => asset(mediaRoot + file);
  return (
    <article className={"home-campaign home-campaign--" + campaign.layout}>
      <picture>
        {campaign.mobileImage && (
          <source
            media="(max-width: 650px)"
            srcSet={campaignImage(campaign.mobileImage)}
          />
        )}
        <img
          src={campaignImage(campaign.image)}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </picture>
      <div className="home-campaign-copy">
        {(campaign.sponsored || campaign.discountLabel || illustrative) && (
          <div className="home-campaign-labels">
            {campaign.sponsored && <span>Sponsored</span>}
            {campaign.discountLabel && <span>{campaign.discountLabel}</span>}
            {illustrative && <span>Illustrative</span>}
          </div>
        )}
        <Heading>{campaign.title}</Heading>
        <p>{campaign.description}</p>
        {campaign.href.startsWith("#") ? (
          <button className="button" type="button" onClick={() => {
            const target = document.getElementById(campaign.href.slice(1));
            target?.focus({ preventScroll: true });
            target?.scrollIntoView({ block: "start" });
          }}>{campaign.ctaLabel}</button>
        ) : (
          <Link className="button" to={campaign.href} onClick={beforeNavigate}>{campaign.ctaLabel}</Link>
        )}
      </div>
    </article>
  );
}

export function HomeCampaignSection({
  campaigns = homeCampaigns,
}: {
  campaigns?: readonly HomeCampaign[];
}) {
  const visible = campaigns
    .filter((campaign) => campaign.enabled)
    .sort((a, b) => a.order - b.order);
  if (!visible.length) return null;
  return (
    <section className="home-section" aria-labelledby="home-campaign-heading">
      <div className="section-heading">
        <h2 id="home-campaign-heading">Featured collections</h2>
      </div>
      <div className="home-campaign-grid">
        {visible.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
    </section>
  );
}
