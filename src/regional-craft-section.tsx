import { Link } from "react-router-dom";
import { asset } from "./catalog";
import { regionalCrafts, regionalDirectoryHref } from "./regional-crafts";

export function RegionalCraftSection() {
  return (
    <section className="home-section" aria-labelledby="regional-crafts-title">
      <div className="section-heading">
        <div>
          <h2 id="regional-crafts-title">Handmade &amp; art by state</h2>
          <p>Explore regional crafts, find makers and start a sourcing request. Images are illustrative.</p>
        </div>
      </div>
      <div className="regional-crafts">
        {regionalCrafts.map(({ id, state, alt, crafts }) => (
          <article className="regional-craft" key={id}>
            <img className="regional-craft-cover" src={asset("images/regional/" + id + ".webp")} alt={alt} width="720" height="720" loading="lazy" />
            <div>
              <h3>{state}</h3>
              <ul aria-label={state + " crafts"}>
                {crafts.map((craft) => (
                  <li key={craft}>
                    <Link to={regionalDirectoryHref(id, craft)}>
                      <img src={asset("images/regional/" + id + "/" + craft.toLowerCase().replaceAll(" ", "-") + ".webp")} alt="" width="320" height="320" loading="lazy" />
                      {craft}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
