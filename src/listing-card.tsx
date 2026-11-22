import {
  Heart,
  ArrowUpRight,
  Globe2,
  MapPin,
  Wrench,
  Package,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { asset, money, type Listing } from "./catalog";
import { useDemo } from "./store";

const icons = { global: Globe2, nearby: MapPin, care: Wrench, together: Users };

export function ListingCard({ item }: { item: Listing }) {
  const { liked, toggleLike } = useDemo();
  const url = `/listing/${item.section}/${item.id}`;
  const Icon = icons[item.section as keyof typeof icons] || Package;
  return (
    <article className="listing-card">
      <Link className="card-media" to={url} aria-label={item.name}>
        {item.image ? (
          <img
            src={asset(`images/${item.image}.webp`)}
            alt={item.name}
            loading="lazy"
          />
        ) : (
          <Icon size={42} strokeWidth={1.15} />
        )}
      </Link>
      {item.section === "shop" && (
        <button
          className="save"
          aria-label={`Save ${item.name}`}
          aria-pressed={liked.includes(item.id)}
          onClick={() => toggleLike(item.id)}
        >
          <Heart
            size={18}
            fill={liked.includes(item.id) ? "currentColor" : "none"}
          />
        </button>
      )}
      <div className="card-copy">
        <small>{item.manufacturer ? "Demo manufacturer" : item.category}</small>
        <Link to={url}>
          <strong>{item.name}</strong>
          <ArrowUpRight size={15} />
        </Link>
        <p>
          {item.detail}
          {item.distance && ` · ${item.distance} km`}
        </p>
        {item.price !== undefined && <b>{money(item.price)}</b>}
      </div>
    </article>
  );
}
