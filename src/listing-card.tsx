import { useLocale } from "./i18n";
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
import {
  availableCartUnits,
  retailVariants,
  type RetailVariant,
} from "./product-commerce";

const icons = { global: Globe2, nearby: MapPin, care: Wrench, together: Users };

function addOne(variant: RetailVariant) {
  const { cart, setCart } = useDemo.getState();
  if (!availableCartUnits(variant, cart)) return false;
  setCart(variant.cartKey, (cart[variant.cartKey] ?? 0) + 1);
  return true;
}

export function ListingCard({
  item,
  quickView = false,
}: {
  item: Listing;
  quickView?: boolean;
}) {
  const saved = useDemo((state) => state.liked.includes(item.id));
  const toggleLike = useDemo((state) => state.toggleLike);
  const url = `/listing/${item.section}/${item.id}`;
  const Icon = icons[item.section as keyof typeof icons] || Package;
  const retail = item.section === "shop";
  return (
    <article className="listing-card">
      <div className="card-media">
        {item.image ? (
          <img
            src={asset(`images/${item.image}.webp`)}
            alt={item.name}
            loading="lazy"
          />
        ) : (
          <Icon size={42} strokeWidth={1.15} aria-hidden="true" />
        )}
      </div>
      <div className="card-copy">
        <small>{item.manufacturer ? "Demo manufacturer" : item.category}</small>
        <Link className="card-product-link" to={url}>
          <strong>{item.name}</strong>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <p>
          {item.detail}
          {item.distance && ` · ${item.distance} km`}
        </p>
        {item.price !== undefined && <b>{money(item.price)}</b>}
        {item.quoteOnly && <p>Quotation only</p>}
        {item.specifications && (
          <small className="catalogue-card-spec">
            {Object.values(item.specifications).join(" · ")}
          </small>
        )}
        {retail && !item.quoteOnly && (
          <CardShoppingActions item={item} url={url} quickView={quickView} />
        )}
      </div>
      {retail && (
        <button
          className="save card-control"
          aria-label={
            saved
              ? `Remove ${item.name} from wishlist`
              : `Add ${item.name} to wishlist`
          }
          aria-pressed={saved}
          onClick={() => toggleLike(item.id)}
        >
          <Heart
            size={18}
            aria-hidden="true"
            fill={saved ? "currentColor" : "none"}
          />
        </button>
      )}
    </article>
  );
}

function CardShoppingActions({
  item,
  url,
  quickView,
}: {
  item: Listing;
  url: string;
  quickView: boolean;
}) {
  const {t}=useLocale();
  const cart = useDemo((state) => state.cart);
  const variants = retailVariants(item);
  const available = variants.filter(
    (variant) => availableCartUnits(variant, cart) > 0,
  );
  const [message, setMessage] = useState("");
  const add = (variant: RetailVariant) => {
    const success = addOne(variant);
    setMessage(
      success
        ? `Added ${item.name} (${variant.label}) to your demo cart.`
        : "No more units of this variant can be added.",
    );
    return success;
  };
  return (
    <>
      <div className="card-shopping">
        {variants.filter((variant) => variant.stock > 0).length > 1 ? (
          <ShoppingDialog
            item={item}
            url={url}
            variants={variants}
            available={available}
            mode="cart"
            onAdd={add}
          />
        ) : (
          <button
            className="button card-control"
            disabled={!available.length}
            onClick={(event) => {
              if (event.detail <= 1 && available[0]) add(available[0]);
            }}
          >
            {t("Add to Cart")}
          </button>
        )}
        {quickView && (
          <ShoppingDialog
            item={item}
            url={url}
            variants={variants}
            available={available}
            mode="preview"
            onAdd={add}
          />
        )}
      </div>
      <p className="card-feedback" role="status">
        {message}
      </p>
    </>
  );
}

function ShoppingDialog({
  item,
  url,
  variants,
  available,
  mode,
  onAdd,
}: {
  item: Listing;
  url: string;
  variants: RetailVariant[];
  available: RetailVariant[];
  mode: "cart" | "preview";
  onAdd: (variant: RetailVariant) => boolean;
}) {
  const {t}=useLocale();
  const cart = useDemo((state) => state.cart);
  const saved = useDemo((state) => state.liked.includes(item.id));
  const toggleLike = useDemo((state) => state.toggleLike);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [message, setMessage] = useState("");
  const preview = mode === "preview";
  const variant =
    variants.find((entry) => entry.id === selected) ??
    available[0] ??
    variants[0];
  const units = availableCartUnits(variant, cart);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelected(available[0]?.id ?? variants[0].id);
          setMessage("");
        }
      }}
    >
      <Dialog.Trigger
        className={preview ? "outline card-control" : "button card-control"}
        aria-label={preview ? `Quick view ${item.name}` : undefined}
        disabled={!preview && !available.length}
      >
        {t(preview ? "Quick view" : "Add to Cart")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog detail-actions shopping-dialog">
          <div className="shopping-product">
            {variant.photos[0] && (
              <img
                className="shopping-product-image"
                src={asset(`images/${variant.photos[0]}.webp`)}
                alt={item.name}
              />
            )}
            <div className="shopping-product-copy">
              <Dialog.Title>
                {preview ? item.name : `Choose a variant for ${item.name}`}
              </Dialog.Title>
              <Dialog.Description>
                {item.detail} · {item.category}
              </Dialog.Description>
              <p>
                {money(variant.price)} ·{" "}
                {variant.stock
                  ? `${variant.stock} in demo stock`
                  : "Out of demo stock"}
              </p>
              <p className="muted">SKU {variant.sku}</p>
            </div>
          </div>
          <label>
            Variant
            <select
              value={variant.id}
              onChange={(event) => {
                setSelected(event.target.value);
                setMessage("");
              }}
            >
              {variants.map((entry) => (
                <option
                  key={entry.id}
                  value={entry.id}
                  disabled={mode === "cart" && !availableCartUnits(entry, cart)}
                >
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          {variant.stock > 0 && <p>{units} more can be added</p>}
          <div className="actions">
            <button
              className="button"
              disabled={!units}
              onClick={(event) => {
                if (event.detail > 1 || !open || !onAdd(variant)) return;
                if (preview) setMessage("Added to your demo cart.");
                else setOpen(false);
              }}
            >
              {t("Add to Cart")}
            </button>
            {preview && (
              <button
                className="outline"
                aria-pressed={saved}
                onClick={() => toggleLike(item.id)}
              >
                Wishlist
              </button>
            )}
          </div>
          {preview && (
            <>
              <p role="status">{message}</p>
              <Link to={url}>Open full product details</Link>
            </>
          )}
          <Dialog.Close className="outline">
            {preview ? "Close quick view" : "Cancel"}
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
