import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { projects as projectsDb, renders as rendersDb, assets as assetsDb } from "~/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import { renderVideo } from "~/lib/renderer.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const project = projectsDb.getById(params.id!);
  if (!project) {
    throw new Response("Project not found", { status: 404 });
  }
  const projectRenders = rendersDb.getByProjectId(params.id!);
  const allAssets = assetsDb.getAll();
  return json({ project, renders: projectRenders, assets: allAssets });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "render") {
    const project = projectsDb.getById(params.id!);
    if (!project || !project.scene_plan) {
      return json({ error: "No scene plan to render" }, { status: 400 });
    }

    const allAssets = assetsDb.getAll();
    const resolvedPlan = { ...project.scene_plan };
    if (resolvedPlan.scenes) {
      resolvedPlan.scenes = resolvedPlan.scenes.map((scene: any) => ({
        ...scene,
        elements: (scene.elements || []).map((el: any) => {
          const matched = allAssets.find((a: any) =>
            a.tags.some((t: string) => t.toLowerCase() === el.assetTag?.toLowerCase())
          );
          return {
            ...el,
            resolvedSrc: matched ? matched.file_path : undefined,
          };
        }),
      }));
    }

    const renderId = uuidv4();
    rendersDb.create({ id: renderId, project_id: project.id });
    projectsDb.updateStatus(project.id, "rendering");

    renderVideo(renderId, project.id, resolvedPlan).catch((err) => {
      console.error("Background render failed:", err);
    });

    return json({ renderId, message: "Render started" });
  }

  if (intent === "updateScenePlan") {
    const scenePlanJson = formData.get("scenePlan") as string;
    try {
      const scenePlan = JSON.parse(scenePlanJson);
      projectsDb.updateScenePlan(params.id!, scenePlan);
      return json({ success: true });
    } catch {
      return json({ error: "Invalid scene plan JSON" }, { status: 400 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function ProjectDetail() {
  const { project, renders, assets } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [activeRender, setActiveRender] = useState<any>(null);
  const [trackingRenderId, setTrackingRenderId] = useState<string | null>(null);

  const latestRender = renders[0];
  const isSubmitting = fetcher.state === "submitting";
  const isRendering = latestRender?.status === "rendering" || isSubmitting || !!trackingRenderId;

  useEffect(() => {
    if (fetcher.data && (fetcher.data as any).renderId) {
      setTrackingRenderId((fetcher.data as any).renderId);
    }
  }, [fetcher.data]);

  useEffect(() => {
    const renderIdToTrack = trackingRenderId || (latestRender?.status === "rendering" ? latestRender.id : null);
    if (!renderIdToTrack) return;

    const interval = setInterval(() => {
      fetch(`/api/render-status/${renderIdToTrack}`)
        .then((r) => r.json())
        .then((data) => {
          setActiveRender(data);
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
            setTrackingRenderId(null);
            window.location.reload();
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [trackingRenderId, latestRender]);

  const handleRender = () => {
    fetcher.submit({ intent: "render" }, { method: "post" });
  };

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <Link to="/projects" className="text-sm text-muted" style={{ textDecoration: "none" }}>
            &larr; Back to Projects
          </Link>
          <h2 style={{ marginTop: 8 }}>{project.name}</h2>
          <p>{project.prompt}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`status-badge status-${project.status}`}>{project.status}</span>
          {project.scene_plan && (
            <button
              className="btn btn-primary"
              onClick={handleRender}
              disabled={isRendering}
            >
              {isRendering ? (
                <>
                  <span className="spinner" /> Rendering...
                </>
              ) : (
                "Render Video"
              )}
            </button>
          )}
        </div>
      </div>

      {isRendering && activeRender && (
        <div className="render-info">
          <span className="spinner" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Rendering in progress...</p>
            <div className="progress-bar mt-2">
              <div
                className="progress-bar-fill"
                style={{ width: `${activeRender.progress || 0}%` }}
              />
            </div>
            <p className="text-sm text-muted mt-2">{activeRender.progress || 0}% complete</p>
          </div>
        </div>
      )}

      {latestRender?.status === "completed" && latestRender.file_path && (
        <div className="card mb-4">
          <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16 }}>Rendered Video</h3>
            <a href={`/api/download/${latestRender.id}`} className="btn btn-primary btn-sm">
              Download MP4
            </a>
          </div>
          <video
            controls
            className="video-player"
            src={`/api/download/${latestRender.id}`}
          />
        </div>
      )}

      {latestRender?.status === "failed" && (
        <div
          className="card mb-4"
          style={{ borderColor: "var(--danger)" }}
        >
          <p style={{ color: "var(--danger)", fontWeight: 600 }}>Render Failed</p>
          <p className="text-sm text-muted mt-2">{latestRender.error_message}</p>
        </div>
      )}

      {project.scene_plan ? (
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 16 }}>
            Scene Plan — {project.scene_plan.scenes?.length || 0} Scenes
          </h3>
          {project.scene_plan.scenes?.map((scene: any, index: number) => (
            <div key={index} className="scene-card">
              <div className="scene-card-header">
                <div className="flex items-center gap-3">
                  <span className="scene-number">{scene.sceneNumber}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{scene.visualDescription}</p>
                    <p className="text-sm text-muted">{scene.duration}s &middot; {scene.transition} transition</p>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="scene-label">Narration</div>
                <p style={{ fontSize: 14, marginTop: 4, marginBottom: 12 }}>{scene.narrationText}</p>

                {scene.textOverlays && scene.textOverlays.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="scene-label">Text Overlays</div>
                    <div className="tags-container mt-2">
                      {scene.textOverlays.map((overlay: any, i: number) => (
                        <span key={i} className="tag">{overlay.text} ({overlay.animation})</span>
                      ))}
                    </div>
                  </div>
                )}

                {scene.elements && scene.elements.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="scene-label">Animated Elements</div>
                    <div className="tags-container mt-2">
                      {scene.elements.map((el: any, i: number) => (
                        <span key={i} className="tag">{el.assetTag} — {el.motion}</span>
                      ))}
                    </div>
                  </div>
                )}

                {scene.assetTags && scene.assetTags.length > 0 && (
                  <div>
                    <div className="scene-label">Asset Tags</div>
                    <div className="tags-container mt-2">
                      {scene.assetTags.map((tag: string, i: number) => {
                        const matched = assets.find((a: any) =>
                          a.tags.includes(tag.toLowerCase())
                        );
                        return (
                          <span
                            key={i}
                            className="tag"
                            style={
                              matched
                                ? {}
                                : { background: "rgba(255,209,102,0.15)", color: "var(--warning)" }
                            }
                          >
                            {tag} {matched ? "✓" : "(no match)"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>No scene plan generated</h3>
          <p>Something went wrong during scene planning</p>
        </div>
      )}
    </div>
  );
}
