import { Camera, Play } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  officialSocialProfiles,
  organisation,
  platformNames,
  type SocialProfile,
} from "./organisation";
import "./site-footer.css";

type FooterLink = { label: string; to: string };
type FooterGroup = { title: string; links: FooterLink[] };

const accountLinks: FooterGroup = {
  title: "Account",
  links: [
    { label: "My Profile", to: "/account/profile" },
    { label: "My Orders", to: "/account/orders" },
    { label: "Wishlist", to: "/account/wishlist" },
    { label: "My Requirements", to: "/account/requirements" },
    { label: "Bookings", to: "/account/bookings" },
    { label: "Notifications", to: "/account/notifications" },
    { label: "Settings", to: "/account/settings" },
  ],
};

const supportLinks: FooterGroup = {
  title: "Support",
  links: [
    { label: "Contact Us", to: "/contact" },
    { label: "Help Centre", to: "/account/help" },
    { label: "Privacy Policy", to: "/account/privacy" },
    { label: "Terms & Conditions", to: "/account/terms" },
  ],
};

const companyLinks: FooterGroup = {
  title: "Company",
  links: [
    { label: "About Us", to: "/about" },
    { label: "Become a Seller", to: "/business" },
  ],
};

const marks = {
  instagram: <Camera size={19} aria-hidden="true" />,
  facebook: <span aria-hidden="true">f</span>,
  linkedin: <span aria-hidden="true">in</span>,
  youtube: <Play size={19} aria-hidden="true" />,
};

export function SocialLinks({
  profiles,
}: {
  profiles?: readonly SocialProfile[];
}) {
  const official = officialSocialProfiles(profiles);
  if (!official.length) return null;
  return (
    <nav className="footer-social" aria-label="LOCAIZ social media">
      {official.map(({ platform, url }) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`LOCAIZ on ${platformNames[platform]} (opens in a new tab)`}
        >
          {marks[platform]}
        </a>
      ))}
    </nav>
  );
}

export function SiteFooter({
  brand,
  marketplace,
}: {
  brand: ReactNode;
  marketplace: FooterLink[];
}) {
  const groups = [
    { title: "Marketplace", links: marketplace },
    accountLinks,
    supportLinks,
    companyLinks,
  ];
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="site-footer-grid">
          <div className="footer-brand">
            {brand}
            <p className="footer-tagline">Local Roots. Global Reach.</p>
            <p className="footer-description">
              Discover local stores, independent makers, global suppliers and
              services in one marketplace.
            </p>
            <SocialLinks profiles={organisation.socialProfiles} />
          </div>
          {groups.map(({ title, links }) => (
            <nav key={title} aria-label={`Footer ${title}`}>
              <h2>{title}</h2>
              <ul>
                {links.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="site-footer-bottom">
          <small>
            © {new Date().getFullYear()} LOCAIZ. All rights reserved.
          </small>
          <small>Marketplace demonstration</small>
        </div>
      </div>
    </footer>
  );
}
