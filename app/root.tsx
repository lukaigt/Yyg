import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  NavLink,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import styles from "~/styles/global.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="app-layout">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <h1>VideoForge</h1>
            </div>
            <nav className="sidebar-nav">
              <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                New Project
              </NavLink>
              <NavLink to="/projects" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Projects
              </NavLink>
              <NavLink to="/library" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Asset Library
              </NavLink>
              <NavLink to="/renders" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Renders
              </NavLink>
            </nav>
          </aside>
          <main className="main-content">
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${error.data}`
    : error instanceof Error
    ? error.message
    : "Something went wrong";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>VideoForge - Error</title>
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f0f14; color: #e0e0e0; }
          .err-wrap { max-width: 600px; margin: 80px auto; padding: 0 20px; }
          .err-card { background: #1a1a24; border: 1px solid #ff4444; border-radius: 12px; padding: 32px; }
          .err-card h2 { margin: 0 0 12px; color: #fff; }
          .err-card p { color: #aaa; margin: 0 0 20px; font-size: 14px; word-break: break-word; }
          .err-btn { display: inline-block; padding: 10px 20px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; margin-right: 10px; border: none; cursor: pointer; }
          .err-btn-sec { background: #2a2a3a; }
        `}} />
      </head>
      <body>
        <div className="err-wrap">
          <div className="err-card">
            <h2>{isRouteErrorResponse(error) ? `Error ${error.status}` : "Something went wrong"}</h2>
            <p>{message}</p>
            <a href="/" className="err-btn">Go Home</a>
            <button className="err-btn err-btn-sec" onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
