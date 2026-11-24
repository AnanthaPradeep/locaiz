import { Link } from "react-router-dom";
import { asset } from "./catalog";
import { homeCampaigns, type HomeCampaign } from "./home-campaigns";

function campaignImage(file: string) {
  return asset("images/campaigns/" + file);
}

function CampaignCard({ campaign }: { campaign: HomeCampaign }) {
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
        {(campaign.sponsored || campaign.discountLabel) && (
          <div className="home-campaign-labels">
            {campaign.sponsored && <span>Sponsored</span>}
            {campaign.discountLabel && <span>{campaign.discountLabel}</span>}
          </div>
        )}
        <h3>{campaign.title}</h3>
        <p>{campaign.description}</p>
        <Link className="button" to={campaign.href}>
          {campaign.ctaLabel}
        </Link>
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
