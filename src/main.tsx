import { Component, lazy, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "./shell";
import { Home } from "./home";
import { stockEnabled } from "./stock/config";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-700.css";
import "./styles.css";

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

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="wrap page" role="status">
          Loading marketplace…
        </main>
      }
    >
      {children}
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <HashRouter>
      <AppErrorBoundary>
        <Shell>
          <Routes>
            <Route
              path="/sourcing/:kind?/:id?"
              element={
                <Loading>
                  <Sourcing />
                </Loading>
              }
            />
            <Route
              path="/account/stock-new"
              element={
                <Loading>
                  <Stock panel="new" />
                </Loading>
              }
            />
            {stockEnabled && (
              <Route
                path="/account/stock"
                element={
                  <Loading>
                    <Stock panel="buyer" />
                  </Loading>
                }
              />
            )}
            <Route
              path="/account/stock-notifications"
              element={
                <Loading>
                  <Stock panel="notifications" />
                </Loading>
              }
            />
            <Route
              path="/business/stock"
              element={
                <Loading>
                  <Stock panel="seller" />
                </Loading>
              }
            />
            <Route path="/" element={<Home />} />
            <Route
              path="/search"
              element={
                <Loading>
                  <Marketplace />
                </Loading>
              }
            />
            <Route
              path="/listing/:section/:id"
              element={
                <Loading>
                  <Marketplace />
                </Loading>
              }
            />
            <Route
              path="/:section"
              element={
                <Loading>
                  <Marketplace />
                </Loading>
              }
            />
            <Route
              path="/account/:panel"
              element={
                <Loading>
                  <Workspace />
                </Loading>
              }
            />
            <Route
              path="/business/:panel"
              element={
                <Loading>
                  <Workspace business />
                </Loading>
              }
            />
            <Route
              path="*"
              element={
                <Loading>
                  <Marketplace />
                </Loading>
              }
            />
          </Routes>
        </Shell>
      </AppErrorBoundary>
    </HashRouter>
  </QueryClientProvider>,
);
