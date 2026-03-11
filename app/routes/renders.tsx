import { useLoaderData, Link } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useEffect } from "react";
import { renders as rendersDb, projects as projectsDb } from "~/lib/db.server";

export async function loader() {
  const allRenders = rendersDb.getAll();
  const rendersWithProject = allRenders.map((r: any) => {
    const project = projectsDb.getById(r.project_id);
    return { ...r, projectName: project?.name || "Unknown" };
  });
  return json({ renders: rendersWithProject });
}

export default function Renders() {
  const { renders } = useLoaderData<typeof loader>();

  const hasActiveRenders = renders.some(
    (r: any) => r.status === "rendering" || r.status === "queued"
  );

  useEffect(() => {
    if (!hasActiveRenders) return;
    const interval = setInterval(() => {
      window.location.reload();
    }, 4000);
    return () => clearInterval(interval);
  }, [hasActiveRenders]);

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h2>Renders</h2>
          <p>{renders.length} render{renders.length !== 1 ? "s" : ""}</p>
        </div>
        <Link to="/" className="btn btn-primary">New Project</Link>
      </div>

      {renders.length === 0 ? (
        <div className="empty-state">
          <h3>No renders yet</h3>
          <p>Open a project and hit Render Video to generate your first MP4</p>
          <Link to="/projects" className="btn btn-primary" style={{ marginTop: 12 }}>
            View Projects
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {renders.map((render: any) => (
            <div key={render.id} className="card">
              <div className="flex justify-between items-center">
                <div>
                  <Link
                    to={`/project/${render.project_id}`}
                    style={{ textDecoration: "none", color: "var(--text-primary)" }}
                  >
                    <h3 style={{ fontSize: 16, marginBottom: 4 }}>{render.projectName}</h3>
                  </Link>
                  <p className="text-sm text-muted">
                    {render.duration_seconds
                      ? `${Math.round(render.duration_seconds)}s video`
                      : render.status === "rendering" || render.status === "queued"
                      ? "Rendering..."
                      : "—"}{" "}
                    &middot; {render.resolution}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`status-badge status-${render.status}`}>
                    {render.status === "rendering"
                      ? `${render.progress}%`
                      : render.status}
                  </span>
                  {render.status === "completed" && render.file_path && (
                    <a
                      href={`/api/download/${render.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Download MP4
                    </a>
                  )}
                  <Link
                    to={`/project/${render.project_id}`}
                    className="btn btn-sm"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  >
                    Open Project
                  </Link>
                </div>
              </div>
              {(render.status === "rendering" || render.status === "queued") && (
                <div style={{ marginTop: 12 }}>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${render.progress || 0}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted" style={{ marginTop: 6 }}>
                    {render.progress || 0}% — running on server, no need to stay on this page
                  </p>
                </div>
              )}
              {render.error_message && (
                <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
                  {render.error_message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
