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
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { asset, money, type Listing } from "./catalog";
import { useDemo } from "./store";
import { retailVariants } from "./product-commerce";

const icons = { global: Globe2, nearby: MapPin, care: Wrench, together: Users };

export function ListingCard({ item, quickView = false }: { item: Listing; quickView?: boolean }) {
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
        {quickView && item.section === "shop" && <ProductQuickView item={item} url={url} />}
      </div>
    </article>
  );
}

function ProductQuickView({ item, url }: { item: Listing; url: string }) {
  const { cart, setCart, liked, toggleLike } = useDemo();
  const [selected, setSelected] = useState("standard");
  const [message, setMessage] = useState("");
  const variants = retailVariants(item);
  const variant = variants.find((entry) => entry.id === selected) ?? variants[0];
  const quantity = cart[variant.cartKey] ?? 0;
  return (
    <Dialog.Root onOpenChange={() => setMessage("")}>
      <Dialog.Trigger className="outline" aria-label={`Quick view ${item.name}`}>Quick view</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog detail-actions">
          <Dialog.Title>{item.name}</Dialog.Title>
          <Dialog.Description>{item.detail} · {item.category}</Dialog.Description>
          <label>
            Variant
            <select value={selected} onChange={(event) => { setSelected(event.target.value); setMessage(""); }}>
              {variants.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          <p>{money(variant.price)} · {variant.stock ? `${variant.stock} in demo stock` : "Out of demo stock"}</p>
          <div className="actions">
            <button className="button" disabled={quantity >= variant.stock} onClick={() => {
              setCart(variant.cartKey, quantity + 1);
              setMessage("Added to your sample cart.");
            }}>Add to cart</button>
            <button className="outline" aria-pressed={liked.includes(item.id)} onClick={() => toggleLike(item.id)}>Wishlist</button>
          </div>
          <p role="status">{message}</p>
          <Link to={url}>Open full product details</Link>
          <Dialog.Close className="outline">Close quick view</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
