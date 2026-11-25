import { useLocale } from "./i18n";
type FulfilmentTerms = {
  productionDays?: number | null;
  transitDays?: number | null;
  shippingCountries?: string[];
  pickup?: boolean;
};

export function FulfilmentDetails({
  productionDays,
  transitDays,
  shippingCountries = [],
  pickup,
  compact = false,
}: FulfilmentTerms & { compact?: boolean }) {
  const {t}=useLocale();
  if (compact)
    return (
      <p className="muted">
        {shippingCountries.length
          ? "Ships to " + shippingCountries.join(", ")
          : "Delivery eligibility unconfirmed"}
        {pickup ? " · Pickup offered" : ""}
        {" · Shipping quote pending"}
      </p>
    );
  return (
    <section className="record market-stack" aria-label={t("Delivery and pickup")}>
      <h3>{t("Delivery and pickup")}</h3>
      <dl>
        <dt>Delivery eligibility</dt>
        <dd>
          {shippingCountries.length
            ? "Supplier lists " + shippingCountries.join(", ")
            : "Ask the supplier about your destination"}
        </dd>
        <dt>Production lead time</dt>
        <dd>
          {productionDays == null ? "Unconfirmed" : productionDays + " days"}
        </dd>
        <dt>Dispatch estimate</dt>
        <dd>Awaiting supplier confirmation</dd>
        <dt>Transit estimate</dt>
        <dd>{transitDays == null ? "Unconfirmed" : transitDays + " days"}</dd>
        <dt>Delivery estimate</dt>
        <dd>Awaiting confirmed dispatch and transit terms</dd>
        <dt>Charges</dt>
        <dd>
          Shipping quote pending. Taxes, duties, and customs responsibilities
          depend on the confirmed quote.
        </dd>
        <dt>Pickup</dt>
        <dd>
          {pickup
            ? "Pickup offered. Check stock and arrange collection with the shop."
            : "Ask whether pickup is offered."}
        </dd>
      </dl>
    </section>
  );
}
