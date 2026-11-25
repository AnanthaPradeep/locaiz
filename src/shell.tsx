import { marketClient } from "./market-foundation";
import { BrandHome } from "./brand-logo";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Globe2,
  Handshake,
  Heart,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Store,
  Sun,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { findListings } from "./catalog";
import { useDemo } from "./store";
import { SiteFooter } from "./site-footer";

export const modules = [
  { id: "shop", title: "Shop", desc: "Everyday finds", icon: ShoppingBag },
  { id: "nearby", title: "Nearby", desc: "Discover local shops", icon: MapPin },
  {
    id: "global",
    title: "Global Atlas",
    desc: "Source worldwide",
    icon: Globe2,
  },
  { id: "together", title: "Together", desc: "Buy as a group", icon: Users },
  { id: "care", title: "Care", desc: "Book trusted repairs", icon: Wrench },
  {
    id: "connect",
    title: "Connect",
    desc: "Get supplier quotes",
    icon: Handshake,
  },
  {
    id: "business",
    title: "Business",
    desc: "Grow your business",
    icon: Store,
  },
];

function LocationPicker() {
  const { city, setPreference } = useDemo();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  function locate() {
    if (!navigator.geolocation) {
      setFeedback("Choose a city to browse local fixtures.");
      return;
    }
    setFeedback("Finding your closest demo city…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const delta = (lat: number, lng: number) =>
          Math.hypot(coords.latitude - lat, coords.longitude - lng);
        const nearest =
          delta(13.08, 80.27) <= delta(11.02, 76.96) ? "Chennai" : "Coimbatore";
        setPreference({ city: nearest });
        setFeedback(`Showing ${nearest}, the nearest demo city.`);
      },
      () => setFeedback("Location unavailable. Choose a city below."),
      { timeout: 7000 },
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="location">
        <MapPin size={19} />
        <span>
          <small>YOUR LOCATION</small>
          {city}, IN
        </span>
        <ArrowDownRight size={15} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog">
          <Dialog.Title>Choose your location</Dialog.Title>
          <Dialog.Description>
            Nearby shows sample stores in the city you choose.
          </Dialog.Description>
          <div className="actions">
            {["Chennai", "Coimbatore"].map((name) => (
              <button
                className="outline"
                key={name}
                onClick={() => {
                  setPreference({ city: name });
                  setOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <button className="outline" onClick={locate}>
            Use my location
          </button>
          <p role="status">{feedback}</p>
          <Dialog.Close
            className="icon-button close"
            aria-label="Close location selector"
          >
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState(false);
  const { theme, setPreference, cart, liked } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0);
  const suggestions = query.trim() ? findListings(query, undefined, undefined, undefined, false, true).slice(0, 5) : [];
  const categories = [...new Set(suggestions.filter(item => item.section === "shop").map(item => item.category))].slice(0, 2);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);
  function search(event: FormEvent) {
    event.preventDefault();
    setFocused(false);
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <>
      <a
        className="skip"
        href="#content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("content")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="announcement">
        <span>LOCAL ROOTS. GLOBAL REACH.</span>
        <Link to="/about">
          Meet LOCAIZ <ArrowUpRight size={13} />
        </Link>
      </div>
      <header>
        <div className="header-main wrap">
          <button
            aria-label="Toggle marketplace menu"
            aria-expanded={menu}
            className="icon-button menu-toggle"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={22} />
          </button>
          <BrandHome />
          <LocationPicker />
          <div
            className="search-area"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setFocused(false);
            }}
          >
            <form className="search" role="search" onSubmit={search}>
              <Search size={19} />
              <input
                type="search"
                aria-label="Search marketplace"
                placeholder="Search products, shops & services"
                value={query}
                onFocus={() => setFocused(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFocused(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setFocused(false);
                }}
              />
              <button aria-label="Submit marketplace search" type="submit">
                <ArrowUpRight size={17} />
              </button>
            </form>
            {focused && suggestions.length > 0 && (
              <ul className="suggestions" aria-label="Marketplace search suggestions">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/listing/${item.section}/${item.id}`}
                      onClick={() => setFocused(false)}
                    >
                      {item.name}
                      <span>{item.section}</span>
                    </Link>
                  </li>
                ))}
                {categories.map(category => (
                  <li key={category}>
                    <Link to={"/shop?" + new URLSearchParams({category})} onClick={() => setFocused(false)}>
                      {category}<span>Category</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="header-actions">
            <Link
              className="icon-button optional"
              aria-label="Account"
              to={marketClient ? "/account/sign-in" : "/account/profile"}
            >
              <UserRound size={20} />
            </Link>
            <Link
              className="icon-button optional"
              aria-label="Messages"
              to="/account/messages"
            >
              <MessageCircle size={20} />
            </Link>
            <Link
              className="icon-button optional cart-button"
              aria-label={`Wishlist, ${liked.length} saved products`}
              to="/account/wishlist"
            >
              <Heart size={20} />
              {liked.length > 0 && <span>{liked.length}</span>}
            </Link>
            <Link
              className="icon-button cart-button"
              aria-label={`Cart, ${count} items`}
              to="/account/cart"
            >
              <ShoppingBag size={20} />
              <span>{count}</span>
            </Link>
          </div>
        </div>
        <nav
          aria-label="Marketplace"
          className={`secondary ${menu ? "expanded" : ""}`}
        >
          <div className="wrap">
            {modules.map(({ id, title, icon: Icon }) => (
              <NavLink key={id} to={`/${id}`} onClick={() => setMenu(false)}>
                <Icon size={16} />
                {title}
              </NavLink>
            ))}
            <button
              className="theme-button"
              onClick={() =>
                setPreference({ theme: theme === "light" ? "dark" : "light" })
              }
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </nav>
      </header>
      <div id="content" tabIndex={-1}>
        {children}
      </div>
      <SiteFooter
        brand={<BrandHome />}
        marketplace={modules.filter(({ id }) => id !== "business").map(({ title, id }) => ({
          label: title,
          to: id === "global" ? "/sourcing" : `/${id}`,
        }))}
      />
      <nav className="mobile-nav" aria-label="Quick navigation">
        <NavLink end to="/">
          <Compass size={19} />
          Explore
        </NavLink>
        <NavLink to="/nearby">
          <MapPin size={19} />
          Nearby
        </NavLink>
        <NavLink to="/account/wishlist" aria-label={`Saved, ${liked.length} products`}>
          <Heart size={19} />
          {liked.length ? `Saved (${liked.length})` : "Saved"}
        </NavLink>
        <NavLink to="/account/cart">
          <ShoppingBag size={19} />
          Cart
        </NavLink>
        <NavLink to={marketClient ? "/account/sign-in" : "/account/profile"}>
          <UserRound size={19} />
          Account
        </NavLink>
      </nav>
    </>
  );
}
