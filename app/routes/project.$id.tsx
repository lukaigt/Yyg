import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { projects as projectsDb, renders as rendersDb, assets as assetsDb } from "~/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import { renderVideo } from "~/lib/renderer.server";
import { AVAILABLE_VOICES, DEFAULT_VOICE } from "~/lib/tts.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const project = projectsDb.getById(params.id!);
  if (!project) {
    throw new Response("Project not found", { status: 404 });
  }
  const projectRenders = rendersDb.getByProjectId(params.id!);
  const allAssets = assetsDb.getAll();
  return json({ project, renders: projectRenders, assets: allAssets, voices: AVAILABLE_VOICES, defaultVoice: DEFAULT_VOICE });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "render") {
    const project = projectsDb.getById(params.id!);
    if (!project || !project.scene_plan) {
      return json({ error: "No scene plan to render" }, { status: 400 });
    }

    const rawVoiceId = (formData.get("voiceId") as string) || DEFAULT_VOICE;
    const validVoiceIds = AVAILABLE_VOICES.map(v => v.id);
    const voiceId = validVoiceIds.includes(rawVoiceId as any) ? rawVoiceId : DEFAULT_VOICE;

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

    renderVideo(renderId, project.id, resolvedPlan, voiceId).catch((err) => {
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
  const { project, renders, assets, voices, defaultVoice } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [activeRender, setActiveRender] = useState<any>(null);
  const [trackingRenderId, setTrackingRenderId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice);

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
    fetcher.submit({ intent: "render", voiceId: selectedVoice }, { method: "post" });
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

      {project.scene_plan && (
        <div className="card mb-4">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Narration Voice</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {voices.map((v: any) => (
              <label
                key={v.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: selectedVoice === v.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  background: selectedVoice === v.id ? "rgba(124, 77, 255, 0.08)" : "var(--bg-secondary)",
                  transition: "all 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="voiceSelect"
                  value={v.id}
                  checked={selectedVoice === v.id}
                  onChange={() => setSelectedVoice(v.id)}
                  style={{ display: "none" }}
                />
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: v.gender === "male" ? "rgba(100, 149, 237, 0.2)" : "rgba(255, 105, 180, 0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0,
                }}>
                  {v.gender === "male" ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={v.gender === "male" ? "#6495ED" : "#FF69B4"} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF69B4" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {project.scene_plan ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 18 }}>
              Scene Plan — {project.scene_plan.scenes?.length || 0} Scenes
            </h3>
            <span className="text-muted" style={{ fontSize: 14 }}>
              Total: {Math.round((project.scene_plan.totalDuration || project.scene_plan.scenes?.reduce((a: number, s: any) => a + (s.duration || 0), 0) || 0) / 60 * 10) / 10} min
              ({project.scene_plan.totalDuration || project.scene_plan.scenes?.reduce((a: number, s: any) => a + (s.duration || 0), 0) || 0}s)
            </span>
          </div>

          {project.scene_plan.sections && project.scene_plan.sections.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {project.scene_plan.sections.map((sec: any, i: number) => (
                <span key={i} style={{
                  padding: "4px 12px",
                  background: "rgba(124, 77, 255, 0.15)",
                  color: "var(--primary)",
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                  fontWeight: 500,
                }}>
                  {sec.title}
                </span>
              ))}
            </div>
          )}

          {project.scene_plan.scenes?.map((scene: any, index: number) => (
            <div key={index} className="scene-card">
              <div className="scene-card-header">
                <div className="flex items-center gap-3">
                  <span className="scene-number">{scene.sceneNumber}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{scene.visualDescription}</p>
                    <p className="text-sm text-muted">
                      {scene.duration}s &middot; {scene.transition} transition
                      {scene.section && <> &middot; {scene.section}</>}
                    </p>
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
