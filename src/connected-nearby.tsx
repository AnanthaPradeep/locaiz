import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMarketMutation, useMarketSession } from "./market-account";
import { formText, marketClient } from "./market-foundation";
import { products, type Listing } from "./catalog";
import { readPilot, readRequests } from "./stock/client";
import { stockPath } from "./stock/config";

const MarketMap = lazy(() => import("./market-map"));
const pilotProducts = products.filter((item) =>
  ["studio-headphones", "audio-pads"].includes(item.id),
);

type Location = {
  id: string;
  business_id: string;
  locality: string;
  country_code: string;
  pickup: boolean;
  latitude: number;
  longitude: number;
  opening_hours: string;
  verified_at: string;
  sourcing_businesses: {
    name: string;
    pilot_business_id: string;
    roles: string[];
  };
};
type Coordinates = { latitude: number; longitude: number };
const rad = Math.PI / 180;
function distance(a: Coordinates, b: Coordinates) {
  const part =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, part)));
}
export function ConnectedNearby() {
  const session = useMarketSession();
  const user = session?.user.id;
  const [city, setCity] = useState("");
  const [position, setPosition] = useState<Coordinates>();
  const [locationNotice, setLocationNotice] = useState("");
  const [radius, setRadius] = useState(25);
  const [map, setMap] = useState(false);
  const [product, setProduct] = useState("");
  const [variant, setVariant] = useState("Standard");
  const locations = useQuery({
    queryKey: ["market", "verified-nearby"],
    enabled: Boolean(marketClient),
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("market_locations")
        .select(
          "id,business_id,locality,country_code,pickup,latitude,longitude,opening_hours,verified_at,sourcing_businesses!inner(name,pilot_business_id,roles)",
        )
        .not("verified_at", "is", null)
        .eq("sourcing_businesses.published", true)
        .eq("sourcing_businesses.trust_state", "verified")
        .order("locality")
        .limit(200);
      if (error) throw error;
      return data as unknown as Location[];
    },
  });
  const requests = useQuery({
    queryKey: ["market", "nearby-requests", user],
    enabled: Boolean(user && product),
    queryFn: () => readRequests(user!, false),
    refetchInterval: 15000,
  });
  const pilot = useQuery({
    queryKey: ["market", "nearby-stock-eligibility", user, product, variant],
    enabled: Boolean(user && product),
    queryFn: () => readPilot(product, variant),
  });
  if (!marketClient) return null;
  const entries = (locations.data ?? [])
    .map((shop) => ({
      shop,
      km: position ? distance(position, shop) : undefined,
    }))
    .filter(
      ({ shop, km }) =>
        shop.locality.toLowerCase().includes(city.trim().toLowerCase()) &&
        (km === undefined || km <= radius),
    )
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const mapItems: Listing[] = entries.map(({ shop }) => ({
    id: shop.id,
    name: shop.sourcing_businesses.name,
    detail: shop.locality,
    section: "nearby",
    category: "Verified participating shop",
    coords: [shop.longitude, shop.latitude],
  }));
  function geolocate() {
    if (!navigator.geolocation) {
      setLocationNotice("Location is unavailable. Enter a city to continue.");
      return;
    }
    setLocationNotice("Checking location");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        });
        setCity("");
        setLocationNotice("Showing nearby shops using your device location.");
      },
      () =>
        setLocationNotice(
          "Location access is unavailable. Enter a city to continue.",
        ),
      { timeout: 8000, maximumAge: 60000 },
    );
  }
  return (
    <section className="record market-stack" aria-label="Verified nearby shops">
      <h2>Verified nearby shops</h2>
      <div className="journey-fields">
        <label>
          City or locality
          <input
            type="search"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </label>
        <label>
          Product for stock checks
          <select
            value={product}
            onChange={(event) => {
              setProduct(event.target.value);
              setVariant("Standard");
            }}
          >
            <option value="">Choose product</option>
            {pilotProducts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {product && (
          <label>
            Stock variant
            <select
              value={variant}
              onChange={(event) => setVariant(event.target.value)}
            >
              <option>Standard</option>
              <option>Gift packaging</option>
            </select>
          </label>
        )}
        {position && (
          <label>
            Distance range
            <select
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            >
              <option value={5}>5 km</option>
              <option value={25}>25 km</option>
              <option value={100}>100 km</option>
            </select>
          </label>
        )}
      </div>
      <div className="actions">
        <button className="outline" onClick={geolocate}>
          Use my location
        </button>
        {position && (
          <button
            className="outline"
            onClick={() => {
              setPosition(undefined);
              setLocationNotice("");
            }}
          >
            Clear device location
          </button>
        )}
        {entries.length > 0 && (
          <button
            className="outline"
            aria-pressed={map}
            onClick={() => setMap(!map)}
          >
            {map ? "Hide shop map" : "Show shop map"}
          </button>
        )}
      </div>
      {locationNotice && <p role="status">{locationNotice}</p>}
      {locations.isPending && <p role="status">Loading verified shops</p>}
      {locations.isError && (
        <p role="alert">
          Unable to load verified shops.{" "}
          <button className="outline" onClick={() => void locations.refetch()}>
            Retry shops
          </button>
        </p>
      )}
      {locations.isSuccess && !entries.length && (
        <p>No verified participating shops match this area.</p>
      )}
      {map && entries.length > 0 && (
        <Suspense fallback={<p role="status">Loading shop map</p>}>
          <MarketMap
            items={mapItems}
            hrefFor={(item) =>
              "/supplier/" +
              entries.find(({ shop }) => shop.id === item.id)?.shop.business_id
            }
          />
        </Suspense>
      )}
      <div className="market-grid">
        {entries.map(({ shop, km }) => {
          const linked = shop.sourcing_businesses.pilot_business_id;
          const latest = requests.data
            ?.filter(
              (row) => row.product_id === product && row.variant === variant,
            )
            .flatMap((row) =>
              row.stock_request_shops
                .filter((item) => item.business_id === linked)
                .map((item) => ({ row, item })),
            )[0];
          const valid =
            latest &&
            !latest.row.cancelled_at &&
            Date.parse(latest.row.expires_at) > Date.now() &&
            (!latest.item.quote_expires_at ||
              Date.parse(latest.item.quote_expires_at) > Date.now());
          return (
            <article className="record market-stack" key={shop.id}>
              <h3>
                <Link to={"/supplier/" + shop.business_id}>
                  {shop.sourcing_businesses.name}
                </Link>
              </h3>
              <p>
                {shop.locality}, {shop.country_code}
                {km !== undefined ? " · " + km.toFixed(1) + " km" : ""}
              </p>
              {shop.opening_hours && (
                <p>Opening hours · {shop.opening_hours}</p>
              )}
              <p>{shop.pickup ? "Pickup offered" : "Ask about pickup"}</p>
              {product &&
                (latest ? (
                  <p>
                    {valid
                      ? latest.item.status === "available"
                        ? latest.item.available_quantity == null
                          ? "Shop reported availability"
                          : latest.item.available_quantity + " units confirmed"
                        : latest.item.status === "pending"
                          ? "Awaiting shop response"
                          : "Shop reported unavailable"
                      : "Confirmation closed"}
                    {latest.item.responded_at &&
                      " · " +
                        new Date(latest.item.responded_at).toLocaleString()}
                  </p>
                ) : (
                  <p>Stock unconfirmed for the selected product</p>
                ))}
              {latest && (
                <Link to={"/account/stock?request=" + latest.row.id}>
                  View stock request and pickup options
                </Link>
              )}
              {product &&
                (!user ||
                  (pilot.data?.eligible &&
                    pilot.data.shops.some(
                      (item) => item.id === linked && !item.is_demo,
                    ))) && (
                  <Link
                    className="outline"
                    to={
                      stockPath(product, variant) +
                      "&shop=" +
                      encodeURIComponent(linked)
                    }
                  >
                    Check stock at this shop
                  </Link>
                )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function NearbyVerification() {
  const mutation = useMarketMutation();
  const locations = useQuery({
    queryKey: ["market", "nearby-verification"],
    queryFn: async () => {
      const { data, error } = await marketClient!
        .from("market_locations")
        .select("id,locality,sourcing_businesses!inner(name,pilot_business_id)")
        .eq("sourcing_businesses.trust_state", "verified")
        .not("sourcing_businesses.pilot_business_id", "is", null)
        .order("locality")
        .limit(100);
      if (error) throw error;
      return data as unknown as {
        id: string;
        locality: string;
        sourcing_businesses: { name: string };
      }[];
    },
  });
  return (
    <details className="record">
      <summary>Verify Nearby shop coordinates</summary>
      {locations.isPending && (
        <p role="status">Loading participating locations</p>
      )}
      {locations.isError && (
        <p role="alert">Unable to load participating locations.</p>
      )}
      {locations.isSuccess && !locations.data.length && (
        <p>No approved businesses are linked to the stock pilot.</p>
      )}
      {!!locations.data?.length && (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutation.run(async () => {
              const { error } = await marketClient!.rpc(
                "verify_nearby_location",
                {
                  target: formText(form, "id"),
                  lat: Number(formText(form, "latitude")),
                  lng: Number(formText(form, "longitude")),
                  hours: formText(form, "hours"),
                },
              );
              if (error) throw error;
            }, "Verified location saved.");
          }}
        >
          <label>
            Shop location
            <select name="id">
              {locations.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sourcing_businesses.name} · {item.locality}
                </option>
              ))}
            </select>
          </label>
          <label>
            Verified latitude
            <input
              name="latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              required
            />
          </label>
          <label>
            Verified longitude
            <input
              name="longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              required
            />
          </label>
          <label>
            Confirmed opening hours
            <textarea name="hours" maxLength={500} />
          </label>
          <button className="button" disabled={mutation.pending}>
            Publish verified location
          </button>
          {mutation.feedback}
        </form>
      )}
    </details>
  );
}
