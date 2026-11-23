import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Listing } from "./catalog";

export default function MarketMap({
  items,
  hrefFor = (item) => `/listing/${item.section}/${item.id}`,
}: {
  items: Listing[];
  hrefFor?: (item: Listing) => string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const places = items.filter((item) => item.coords);
  const signature = JSON.stringify(
    places.map(({ id, name, coords }) => ({ id, name, coords })),
  );
  useEffect(() => {
    const entries: { id: string; name: string; coords: [number, number] }[] =
      JSON.parse(signature);
    if (!container.current || !entries.length) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        center: entries[0].coords,
        zoom: entries.length < 3 ? 10 : 3,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    map.on("error", () => setFailed(true));
    map.addControl(new maplibregl.NavigationControl());
    const bounds = new maplibregl.LngLatBounds();
    entries.forEach((item) => {
      bounds.extend(item.coords);
      const popup = new maplibregl.Popup().setText(item.name);
      new maplibregl.Marker({ color: "#5C5752" })
        .setLngLat(item.coords)
        .setPopup(popup)
        .addTo(map);
    });
    if (entries.length > 1)
      map.fitBounds(bounds, { padding: 44, maxZoom: 11, duration: 0 });
    return () => map.remove();
  }, [signature]);
  return (
    <div className="record">
      <div
        className="map"
        ref={container}
        aria-label="Map of selected listings"
      />
      {failed && (
        <p role="status">
          Map imagery unavailable. You can still browse the listings below.
        </p>
      )}
      <div className="actions">
        {places.map((item) => (
          <Link key={item.id} className="outline" to={hrefFor(item)}>
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
