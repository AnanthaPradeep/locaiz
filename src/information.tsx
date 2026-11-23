import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { asset } from "./catalog";
import { Page } from "./page";
import "./information.css";

const destinations = [
  ["Shop", "/shop", "Find everyday essentials and independent brands."],
  [
    "Nearby",
    "/nearby",
    "Discover local shops and ask about availability or pickup.",
  ],
  [
    "Global Atlas",
    "/sourcing",
    "Explore product origins, makers and wholesale markets.",
  ],
  ["Together", "/together", "Pool demand to reach group buying targets."],
  ["Care", "/care", "Explore repair and service options."],
  [
    "Connect",
    "/connect",
    "Post a requirement or request a supplier quotation.",
  ],
  ["Business", "/business", "Explore storefront and supplier tools."],
];

const topics = [
  [
    "Buyer Support",
    "/account/help",
    "Products, orders, local stock and account help",
  ],
  [
    "Seller Support",
    "/business",
    "Storefronts, listings and supplier onboarding",
  ],
  [
    "Manufacturer & Wholesale",
    "/connect",
    "Bulk enquiries, manufacturing and quotations",
  ],
  ["Partnerships", "", "Logistics, integrations and business collaboration"],
  [
    "Trust, Privacy & Complaints",
    "/account/privacy",
    "Listing reports, account safety and privacy requests",
  ],
] as const;

export type PublicOrganisation = {
  supportEmail?: string;
  sellerEmail?: string;
  partnershipEmail?: string;
  privacyEmail?: string;
  phone?: string;
  legalName?: string;
  registeredAddress?: string;
  operationalLocation?: string;
  supportHours?: string;
  socialProfiles?: { label: string; url: string }[];
  grievanceOfficer?: { name: string; channel: string };
};

const organisation: PublicOrganisation = {};

const faqs = [
  [
    "What is LOCAIZ?",
    "A marketplace for discovering products, makers, suppliers and services.",
  ],
  [
    "Who can use LOCAIZ?",
    "Everyday shoppers, retailers, artisans, workshops, manufacturers and service providers can explore the marketplace.",
  ],
  [
    "Can small artisans join?",
    "The Business area lets makers explore storefront and supplier onboarding tools in the demo.",
  ],
  [
    "Can I find products near me?",
    "Nearby helps you discover participating shops. Ask the shop to confirm current stock before travelling.",
  ],
  [
    "Can I source from international suppliers?",
    "Global Atlas lets you explore sourcing locations and sample offers. Ask suppliers about shipping eligibility and terms.",
  ],
  [
    "How does supplier verification work?",
    "Published review labels describe the review recorded for that supplier. Sample listings do not establish supplier verification.",
  ],
  [
    "Is LOCAIZ a direct seller?",
    "LOCAIZ provides discovery and enquiry tools. Sellers are responsible for their listings and any terms they agree with buyers.",
  ],
  [
    "How do I request a quotation?",
    "Open Connect to describe your requirements, or follow the quote link on an applicable supplier offer.",
  ],
  [
    "How do I contact support?",
    "Open Contact Us and choose your enquiry category. The page shows whether submission is available.",
  ],
];

function useMetadata(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const nodes = [
      ["name", "description", description],
      ["property", "og:title", title],
      ["property", "og:description", description],
      [
        "property",
        "og:image",
        new URL(asset("brand/locaiz-512.png"), document.baseURI).href,
      ],
    ].map(([attribute, key, value]) => {
      const existing = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`,
      );
      const element = existing ?? document.createElement("meta");
      const previous = element.content;
      element.setAttribute(attribute, key);
      element.content = value;
      if (!existing) document.head.append(element);
      return () => {
        if (existing) element.content = previous;
        else element.remove();
      };
    });
    return () => {
      document.title = previousTitle;
      nodes.forEach((restore) => restore());
    };
  }, [title, description]);
}

export function About() {
  useMetadata(
    "About LOCAIZ | Local Roots. Global Reach.",
    "Discover how LOCAIZ connects buyers, makers and suppliers from village workshops to global manufacturing hubs.",
  );
  return (
    <main className="wrap page info-page">
      <section className="info-hero">
        <div>
          <span className="eyebrow">ABOUT LOCAIZ</span>
          <h1>Commerce begins everywhere.</h1>
          <h2>From village workshops to global manufacturing hubs.</h2>
          <p>
            LOCAIZ helps people discover products, explore their origins and
            find the makers and suppliers behind them.
          </p>
          <div className="actions">
            <Link className="button" to="/shop">
              Explore Marketplace
            </Link>
            <Link className="outline" to="/sourcing">
              Discover Global Markets
            </Link>
          </div>
        </div>
        <img
          src={asset("images/sourcing/reed-mat.webp")}
          alt="Illustrative photograph of woven reed mats"
        />
      </section>
      <section className="info-section">
        <h2>Why we’re building LOCAIZ</h2>
        <p>
          A village workshop’s work can be hard to find beyond its town.
          Shoppers may struggle to find local stock, small businesses to find
          the right manufacturer, and households to find a repair before
          replacing a product. LOCAIZ brings those searches into one
          marketplace.
        </p>
        <div className="info-grid">
          <article className="record">
            <h3>Our mission</h3>
            <p>
              Help buyers find the right products and suppliers, give makers a
              way to be discovered, and make buying and sourcing options easier
              to understand.
            </p>
          </article>
          <article className="record">
            <h3>Our vision</h3>
            <p>
              Build a marketplace where village artisans, regional workshops and
              manufacturers can be found by location, product category and
              capability.
            </p>
          </article>
        </div>
      </section>
      <section className="info-section">
        <h2>The LOCAIZ ecosystem</h2>
        <div className="info-grid">
          {destinations.map(([name, route, description]) => (
            <Link className="record info-link" key={name} to={route}>
              <strong>{name}</strong>
              <span>{description}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="info-section">
        <h2>Who we serve</h2>
        <p>
          Buyers can explore what is available locally and where a product comes
          from. Retailers, artisans and independent makers can make their work
          easier to find. Workshops, wholesalers and manufacturers can show what
          they supply, and service professionals can help buyers find repair
          options.
        </p>
        <h2>How LOCAIZ works</h2>
        <div className="info-grid">
          <article className="record">
            <h3>For buyers</h3>
            <p>
              Discover a product, compare offers, then choose a purchase option
              or <Link to="/connect">request a quote</Link>.
            </p>
          </article>
          <article className="record">
            <h3>For suppliers</h3>
            <p>
              Explore how to create a business profile, list products and handle
              enquiries in <Link to="/business">LOCAIZ Business</Link>.
            </p>
          </article>
        </div>
      </section>
      <section className="info-section">
        <h2>Built around trust</h2>
        <p>
          Seller review labels reflect the review recorded for that seller.
          Product origins can be reported by suppliers; stock, prices, minimum
          order quantities and delivery terms should be confirmed before you act
          on an offer. Quotes reflect the terms a supplier shares with you.
        </p>
        <p>
          The public demo uses sample offers, stock and transactions.
          Authenticated stock confirmation is available only in a configured
          pilot. Use Contact Us to find the current reporting options.
        </p>
        <div className="actions">
          <Link to="/contact?topic=4">Contact Us</Link>
          <Link to="/account/help">Help</Link>
          <Link to="/account/privacy">Privacy</Link>
          <Link to="/account/terms">Terms</Link>
        </div>
        <h3>Our principles</h3>
        <ul>
          <li>Discovery for everyone</li>
          <li>Transparency over assumptions</li>
          <li>Respect for independent businesses</li>
          <li>Responsible, accessible technology</li>
        </ul>
      </section>
      <section className="info-section">
        <h2>Frequently asked questions</h2>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
      <section className="record info-section">
        <h2>Every connection starts with discovery.</h2>
        <div className="actions">
          <Link className="button" to="/shop">
            Explore LOCAIZ
          </Link>
          <Link className="outline" to="/sourcing/onboarding">
            Join as a Seller
          </Link>
          <Link className="outline" to="/contact">
            Contact Us
          </Link>
        </div>
      </section>
    </main>
  );
}

const fields = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  subject: z.string().trim().min(1, "Enter a subject.").max(120),
  message: z.string().trim().min(1, "Enter a message.").max(4000),
  context: z.string().trim().max(120),
});

export function Contact() {
  useMetadata(
    "Contact LOCAIZ | Support & Business Enquiries",
    "Find buyer help, seller resources, sourcing, partnership and privacy support paths.",
  );
  const [params, setParams] = useSearchParams();
  const rawTopic = params.get("topic");
  const topic = Number(rawTopic) in topics ? Number(rawTopic) : 0;
  const setTopic = (index: number) =>
    setParams({ topic: String(index) }, { replace: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const selected = topics[topic];

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = fields.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    setErrors(
      result.success
        ? {}
        : Object.fromEntries(
            result.error.issues.map((issue) => [issue.path[0], issue.message]),
          ),
    );
    setStatus(
      result.success
        ? "Your entries are valid. This preview has no submission channel."
        : "Check the highlighted fields.",
    );
  }

  return (
    <Page
      label="GET IN TOUCH"
      title="Every connection starts somewhere."
      intro="Find the right support path for a shopping question, sourcing enquiry or business opportunity."
    >
      <div className="info-grid" aria-label="Support categories">
        {topics.map(([name, , description], index) => (
          <button
            className="record info-link"
            key={name}
            type="button"
            aria-pressed={topic === index}
            onClick={() => {
              setTopic(index);
              setErrors({});
              setStatus("");
            }}
          >
            <strong>{name}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
      <section className="record info-section">
        <h2>{selected[0]}</h2>
        <p>{selected[2]}</p>
        {selected[1] && (
          <Link to={selected[1]}>
            Open{" "}
            {selected[0] === "Manufacturer & Wholesale"
              ? "LOCAIZ Connect"
              : "related resources"}
          </Link>
        )}
        {organisation.supportEmail && (
          <p>
            <a href={`mailto:${organisation.supportEmail}`}>
              {organisation.supportEmail}
            </a>
          </p>
        )}
      </section>
      <section className="record info-section">
        <h2>Enquiry preview</h2>
        <p id="contact-mode">
          Demo mode. Live submission is unavailable. Use sample details to try
          the form. Entries are cleared when you leave this page.
        </p>
        <form
          className="form"
          onSubmit={check}
          noValidate
          aria-describedby="contact-mode"
        >
          <label>
            Enquiry category
            <select
              value={topic}
              onChange={(event) => {
                setTopic(Number(event.target.value));
                setErrors({});
                setStatus("");
              }}
            >
              {topics.map(([name], index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["name", "Full name", 100],
              ["email", "Email address", 254],
              ["subject", "Subject", 120],
            ] as const
          ).map(([name, label, max]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                maxLength={max}
                type={name === "email" ? "email" : "text"}
                required
                aria-invalid={Boolean(errors[name])}
                aria-describedby={
                  errors[name] ? `contact-${name}-error` : undefined
                }
              />
              {errors[name] && (
                <span id={`contact-${name}-error`}>{errors[name]}</span>
              )}
            </label>
          ))}
          <label key={topic}>
            {topic === 0
              ? "Order reference"
              : topic === 4
                ? "Listing or requirement reference"
                : "Business name"}{" "}
            (optional)
            <input name="context" maxLength={120} />
          </label>
          <label>
            Message
            <textarea
              name="message"
              rows={5}
              maxLength={4000}
              required
              aria-invalid={Boolean(errors.message)}
              aria-describedby={
                errors.message ? "contact-message-error" : undefined
              }
            />
            {errors.message && (
              <span id="contact-message-error">{errors.message}</span>
            )}
          </label>
          <button className="outline" type="submit">
            Check form
          </button>
          <p role="status">{status}</p>
        </form>
      </section>
      <div className="actions info-section">
        <Link to="/about">About LOCAIZ</Link>
        <Link to="/account/help">Help</Link>
        <Link to="/account/privacy">Privacy</Link>
        <Link to="/account/terms">Terms</Link>
      </div>
    </Page>
  );
}
