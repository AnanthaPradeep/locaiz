import { MatchCheck } from "./saved-search-ui";
import {
  Component,
  lazy,
  Suspense,
  useLayoutEffect,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./shell";
import { Home } from "./home";
import { stockEnabled } from "./stock/config";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-700.css";
import "./styles.css";

const About = lazy(() =>
  import("./information").then((module) => ({ default: module.About })),
);
const Contact = lazy(() =>
  import("./information").then((module) => ({ default: module.Contact })),
);
const Marketplace = lazy(() => import("./marketplace"));
const Sourcing = lazy(() => import("./sourcing/screens"));
const Workspace = lazy(() => import("./workspace"));
const Stock = lazy(() =>
  import("./stock/screens").then((module) => ({ default: module.StockScreen })),
);
const client = new QueryClient();

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="wrap page">
          <StartupReady />
          <h1>Unable to load LOCAIZ</h1>
          <p>Reload to try again.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      );
    return this.props.children;
  }
}

function StartupReady() {
  useLayoutEffect(() => {
    const loader = document.getElementById("startup-loader");
    if (!loader || document.documentElement.dataset.startup === "ready") return;
    document.documentElement.dataset.startup = "ready";
    document.getElementById("root")?.removeAttribute("inert");
    document.dispatchEvent(new Event("locaiz:ready"));
    loader.setAttribute("aria-hidden", "true");
    loader.setAttribute("inert", "");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      loader.remove();
      return;
    }
    loader.dataset.leaving = "";
    loader.addEventListener("transitionend", () => loader.remove(), {
      once: true,
    });
    setTimeout(() => loader.remove(), 200);
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <HashRouter>
      <AppErrorBoundary>
        <Shell>
          <MatchCheck />
          <Suspense
            fallback={
              <main className="wrap page route-loading" role="status">
                Loading page
              </main>
            }
          >
            <Routes>
              <Route path="/sourcing/:kind?/:id?" element={<Sourcing />} />
              <Route
                path="/account/stock-new"
                element={<Stock panel="new" />}
              />
              {stockEnabled && (
                <Route
                  path="/account/stock"
                  element={<Stock panel="buyer" />}
                />
              )}
              <Route
                path="/account/stock-notifications"
                element={<Stock panel="notifications" />}
              />
              <Route
                path="/business/stock"
                element={<Stock panel="seller" />}
              />
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route
                path="/account/about"
                element={<Navigate replace to="/about" />}
              />
              <Route path="/search" element={<Marketplace />} />
              <Route path="/listing/:section/:id" element={<Marketplace />} />
              <Route path="/:section" element={<Marketplace />} />
              <Route path="/account/:panel" element={<Workspace />} />
              <Route path="/business/:panel" element={<Workspace business />} />
              <Route path="*" element={<Marketplace />} />
            </Routes>
            <StartupReady />
          </Suspense>
        </Shell>
      </AppErrorBoundary>
    </HashRouter>
  </QueryClientProvider>,
);
