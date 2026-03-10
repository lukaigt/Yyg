import { useLoaderData, Link } from "@remix-run/react";
import { json } from "@remix-run/node";
import { projects as projectsDb } from "~/lib/db.server";

export async function loader() {
  const allProjects = projectsDb.getAll();
  return json({ projects: allProjects });
}

export default function Projects() {
  const { projects } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h2>Projects</h2>
          <p>{projects.length} projects</p>
        </div>
        <Link to="/" className="btn btn-primary">
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects yet</h3>
          <p>Create your first video project to get started</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            Create Project
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((project: any) => (
            <Link
              key={project.id}
              to={`/project/${project.id}`}
              className="card"
              style={{ textDecoration: "none", cursor: "pointer" }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>{project.name}</h3>
                  <p className="text-sm text-muted">{project.prompt}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`status-badge status-${project.status}`}>
                    {project.status}
                  </span>
                  <span className="text-sm text-muted">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
