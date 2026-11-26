import { RegionalCraftSection } from "./regional-craft-section";
import { useLocale } from "./i18n";
import { HomeCampaignSection } from "./home-campaign-section";
import { FindProductForm } from "./find-it";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Globe2,
  House,
  MapPin,
  Package,
  Shirt,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { asset, findListings, products } from "./catalog";
import { modules } from "./shell";
import { ListingCard } from "./listing-card";
import { useDemo } from "./store";

const categories = [
  { name: "Electronics", icon: AudioLines },
  { name: "Home & Living", icon: House },
  { name: "Fashion", icon: Shirt },
  { name: "Spare Parts", icon: Package },
];

export function Home() {
  const {t,language}=useLocale();
  const { city } = useDemo();
  const reducedMotion = useReducedMotion();
  return (
    <main className="wrap home">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="rule" /> THE UNIFIED MARKETPLACE
          </div>
          <h1>
            {t("Find it near.")}
            <br />
            {language.id === "en" ? <>Source it <em>far.</em></> : <em>{t("Source it far.")}</em>}
          </h1>
          <p>
            Shop thoughtfully, discover businesses nearby and source from the
            world's wholesale markets. All in one place.
          </p>
          <FindProductForm />
          <div className="actions">
            <Link className="button" to="/shop">
              {t("Explore marketplace")} <ArrowRight size={17} />
            </Link>
            <Link className="outline" to="/global">
              <Globe2 size={17} /> {t("Global Atlas")}
            </Link>
          </div>
        </div>
        <Link
          to="/listing/shop/studio-headphones"
          className="hero-visual"
          aria-label="View Studio Wireless Headphones"
        >
          <motion.img
            src={asset("images/hero.webp")}
            alt="Charcoal headphones on a travertine plinth in warm sunlight"
            fetchPriority="high"
            initial={reducedMotion ? false : { opacity: 0.84 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.35 }}
          />
          <span className="image-label">
            THE DESIGN EDIT <ArrowUpRight size={15} />
          </span>
        </Link>
      </section>
      <section className="module-grid" aria-label="Marketplace destinations">
        {modules.map(({ id, title, desc, icon: Icon }) => (
          <Link key={id} to={`/${id}`}>
            <Icon size={22} strokeWidth={1.6} />
            <strong>{t(title)}</strong>
            <span>{desc}</span>
          </Link>
        ))}
      </section>
      <HomeCampaignSection />
      <RegionalCraftSection />
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE LOCAIZ EDIT</span>
            <h2>{t("Trending finds")}</h2>
          </div>
          <Link className="text-link" to="/shop">
            {t("View all products")} <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="product-grid">
          {products.filter((item) => ["studio-headphones", "stoneware-cups", "globe-lamp", "everyday-tote"].includes(item.id)).map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <h2>{t("Shop by category")}</h2>
        </div>
        <div className="category-grid">
          {categories.map(({ name, icon: Icon }) => (
            <Link key={name} to={`/shop?category=${encodeURIComponent(name)}`}>
              <Icon size={23} />
              <strong>{name}</strong>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      </section>
      <section className="home-section split">
        <div className="feature">
          <MapPin />
          <span className="eyebrow">NEARBY · SAMPLE SHOPS</span>
          <h2>Local to {city}</h2>
          {findListings("", "nearby", "", city).map((item) => (
            <Link
              className="row-link"
              key={item.id}
              to={`/listing/nearby/${item.id}`}
            >
              {item.name}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
        <div className="feature inverse">
          <Globe2 />
          <span className="eyebrow">GLOBAL MARKET ATLAS</span>
          <h2>Where the world sources</h2>
          {["tiruppur", "yiwu", "istanbul"].map((id) => {
            const item = findListings("", "global").find(
              (entry) => entry.id === id,
            )!;
            return (
              <Link className="row-link" key={id} to={`/listing/global/${id}`}>
                {item.name} · {item.category}
                <ArrowUpRight size={16} />
              </Link>
            );
          })}
        </div>
      </section>
      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">WHOLESALE SOURCING</span>
            <h2>Featured manufacturers</h2>
          </div>
          <Link className="text-link" to="/global">
            Browse the Atlas <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="split">
          {findListings("", "global")
            .filter((item) => item.manufacturer)
            .map((item) => (
              <div className="feature" key={item.id}>
                <p>
                  {item.city} · {item.category}
                </p>
                <h3>{item.name}</h3>
                <Link className="text-link" to={`/listing/global/${item.id}`}>
                  View demo manufacturer <ArrowUpRight size={16} />
                </Link>
              </div>
            ))}
        </div>
      </section>
      <section className="home-section split">
        <div className="feature">
          <h2>Buy together</h2>
          <p>
            Join a group purchase and unlock sample volume pricing when it
            reaches its target.
          </p>
          <Link className="outline" to="/together">
            Browse group deals
          </Link>
        </div>
        <div className="feature">
          <Wrench size={23} />
          <h2>Make it last</h2>
          <p>
            Find a repair service or compare a repair quote with replacement
            costs.
          </p>
          <Link className="outline" to="/care">
            Explore repair services
          </Link>
        </div>
      </section>
      <section className="home-section split">
        <div className="feature">
          <h2>Post your requirement</h2>
          <p>
            Describe what you need and compare sample responses in one place.
          </p>
          <Link className="button" to="/connect">
            Create a requirement
          </Link>
        </div>
        <div className="feature">
          <h2>Sell with LOCAIZ</h2>
          <p>Set up your demo business and manage your listings.</p>
          <Link className="outline" to="/business/onboarding">
            Start onboarding
          </Link>
        </div>
      </section>
      <div className="trust">
        <ShieldCheck size={22} />
        <p>
          Demo marketplace. Listings, stock, quotations and checkout use sample
          data.
        </p>
      </div>
    </main>
  );
}
