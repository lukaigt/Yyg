import { useLoaderData, Link } from "@remix-run/react";
import { json } from "@remix-run/node";
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

  return (
    <div>
      <div className="page-header">
        <h2>Renders</h2>
        <p>{renders.length} renders</p>
      </div>

      {renders.length === 0 ? (
        <div className="empty-state">
          <h3>No renders yet</h3>
          <p>Create a project and render your first video</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            Create Project
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {renders.map((render: any) => (
            <div key={render.id} className="card">
              <div className="flex justify-between items-center">
                <div>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>{render.projectName}</h3>
                  <p className="text-sm text-muted">
                    {render.duration_seconds
                      ? `${Math.round(render.duration_seconds)}s`
                      : "Processing..."}{" "}
                    &middot; {render.resolution}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`status-badge status-${render.status}`}>
                    {render.status === "rendering"
                      ? `Rendering ${render.progress}%`
                      : render.status}
                  </span>
                  {render.status === "completed" && render.file_path && (
                    <a
                      href={`/api/download/${render.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      Download
                    </a>
                  )}
                  {render.status === "rendering" && (
                    <div className="progress-bar" style={{ width: 120 }}>
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${render.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
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
