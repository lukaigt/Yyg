import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, Link, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { projects as projectsDb, renders as rendersDb, assets as assetsDb } from "~/lib/db.server";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { renderVideo } from "~/lib/renderer.server";
import { AVAILABLE_VOICES, DEFAULT_VOICE, PITCH_OPTIONS } from "~/lib/tts.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const project = projectsDb.getById(params.id!);
  if (!project) {
    throw new Response("Project not found", { status: 404 });
  }
  const projectRenders = rendersDb.getByProjectId(params.id!);
  const allAssets = assetsDb.getAll();
  return json({ project, renders: projectRenders, assets: allAssets, voices: AVAILABLE_VOICES, defaultVoice: DEFAULT_VOICE, pitchOptions: PITCH_OPTIONS });
}

function ensureMusicDir() {
  try {
    const dir = path.join(process.cwd(), "storage", "music");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (err) {
    console.error("Failed to create music directory:", err);
    return path.join(process.cwd(), "storage", "music");
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 50_000_000,
    });
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    const intent = formData.get("intent");

    if (intent === "uploadMusic") {
      const musicFile = formData.get("musicFile");
      if (!musicFile || !(musicFile instanceof File) || musicFile.size === 0) {
        return json({ error: "No music file uploaded" }, { status: 400 });
      }
      const ext = path.extname(musicFile.name || ".mp3").toLowerCase();
      if (ext !== ".mp3") {
        return json({ error: "Only MP3 files are supported" }, { status: 400 });
      }
      if (musicFile.size > 50_000_000) {
        return json({ error: "File too large (max 50MB)" }, { status: 400 });
      }
      try {
        const filename = `${uuidv4()}${ext}`;
        const musicPath = path.join(ensureMusicDir(), filename);
        const buffer = Buffer.from(await musicFile.arrayBuffer());
        fs.writeFileSync(musicPath, buffer);
        projectsDb.updateSettings(params.id!, { music_path: musicPath });
        return json({ success: true, musicUploaded: true });
      } catch (err: any) {
        console.error("Music upload failed:", err);
        return json({ error: "Failed to save music file" }, { status: 500 });
      }
    }

    return json({ error: "Unknown multipart action" }, { status: 400 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "removeMusic") {
    const project = projectsDb.getById(params.id!);
    if (project?.music_path) {
      try {
        if (fs.existsSync(project.music_path)) {
          fs.unlinkSync(project.music_path);
        }
      } catch (err: any) {
        console.error("Failed to delete music file:", err.message);
      }
    }
    projectsDb.updateSettings(params.id!, { music_path: null });
    return json({ success: true, musicRemoved: true });
  }

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

    const voiceRate = parseFloat((formData.get("voiceRate") as string) || "1.05");
    const voicePitch = (formData.get("voicePitch") as string) || "normal";
    const musicVolume = parseFloat((formData.get("musicVolume") as string) || "0.15");
    const showCaptions = formData.get("showCaptions") !== "false";
    const captionSize = (formData.get("captionSize") as string) || "medium";
    const showProgressBar = formData.get("showProgressBar") !== "false";

    projectsDb.updateSettings(params.id!, {
      voice_rate: Math.max(0.8, Math.min(1.2, voiceRate)),
      voice_pitch: voicePitch,
      music_volume: Math.max(0, Math.min(1, musicVolume)),
      show_captions: showCaptions,
      caption_size: captionSize,
      show_progress_bar: showProgressBar,
    });

    renderVideo(renderId, project.id, resolvedPlan, {
      voiceId,
      voiceRate: Math.max(0.8, Math.min(1.2, voiceRate)),
      voicePitch,
      musicPath: project.music_path,
      musicVolume: Math.max(0, Math.min(1, musicVolume)),
      showCaptions,
      captionSize,
      showProgressBar,
    }).catch((err) => {
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
  const { project, renders, assets, voices, defaultVoice, pitchOptions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [activeRender, setActiveRender] = useState<any>(null);
  const [trackingRenderId, setTrackingRenderId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice);
  const [voiceSpeed, setVoiceSpeed] = useState(project.voice_rate ?? 1.05);
  const [voicePitch, setVoicePitch] = useState<string>(project.voice_pitch ?? "normal");
  const [musicVolume, setMusicVolume] = useState(project.music_volume ?? 0.15);
  const [showCaptions, setShowCaptions] = useState(project.show_captions ?? true);
  const [captionSize, setCaptionSize] = useState<"small" | "medium" | "large">((project.caption_size as any) ?? "medium");
  const [showProgressBar, setShowProgressBar] = useState(project.show_progress_bar ?? true);
  const [planningDone, setPlanningDone] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(project.planning_error ?? null);

  const latestRender = renders[0];
  const isSubmitting = fetcher.state === "submitting";
  const isRendering = latestRender?.status === "rendering" || isSubmitting || !!trackingRenderId;
  const isPlanning = project.is_planning && !planningDone;

  useEffect(() => {
    if (fetcher.data && (fetcher.data as any).renderId) {
      setTrackingRenderId((fetcher.data as any).renderId);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (!project.is_planning || planningDone) return;
    const interval = setInterval(() => {
      fetch(`/api/plan-status/${project.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.planning_error) {
            setPlanningError(data.planning_error);
            setPlanningDone(true);
            clearInterval(interval);
          } else if (data.scene_plan_ready) {
            setPlanningDone(true);
            clearInterval(interval);
            window.location.reload();
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [project.id, project.is_planning, planningDone]);

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
    fetcher.submit({
      intent: "render",
      voiceId: selectedVoice,
      voiceRate: String(voiceSpeed),
      voicePitch,
      musicVolume: String(musicVolume),
      showCaptions: showCaptions ? "true" : "false",
      captionSize,
      showProgressBar: showProgressBar ? "true" : "false",
    }, { method: "post" });
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
          <span className={`status-badge status-${isPlanning ? "draft" : project.status}`}>
            {isPlanning ? "planning" : project.status}
          </span>
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

      {isRendering && (
        <div className="render-info">
          <span className="spinner" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Rendering in progress...</p>
            <div className="progress-bar mt-2">
              <div
                className="progress-bar-fill"
                style={{ width: `${activeRender?.progress || 0}%` }}
              />
            </div>
            <p className="text-sm text-muted mt-2">{activeRender?.progress || 0}% complete — you can close this tab, it keeps going on the server</p>
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

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Voice Speed</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{voiceSpeed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                <span>Slower</span>
                <span>Faster</span>
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Voice Pitch</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {pitchOptions.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setVoicePitch(p.id)}
                    style={{
                      flex: 1,
                      padding: "6px 0",
                      border: voicePitch === p.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: voicePitch === p.id ? "rgba(124, 77, 255, 0.08)" : "var(--bg-secondary)",
                      color: voicePitch === p.id ? "var(--primary)" : "var(--text)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: voicePitch === p.id ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {project.scene_plan && (
        <div className="card mb-4">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Background Music</h3>
          {project.music_path ? (
            <div>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--bg-secondary)",
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(124, 77, 255, 0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Music uploaded</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Ready to use in render</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fetcher.submit({ intent: "removeMusic" }, { method: "post" })}
                  style={{
                    padding: "4px 12px",
                    border: "1px solid var(--danger)",
                    borderRadius: "var(--radius)",
                    background: "transparent",
                    color: "var(--danger)",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Remove
                </button>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Music Volume</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--primary)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  <span>Silent</span>
                  <span>Full</span>
                </div>
              </div>
            </div>
          ) : (
            <form
              method="post"
              encType="multipart/form-data"
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "var(--radius)",
                padding: 24,
                textAlign: "center",
                cursor: "pointer",
                position: "relative",
              }}
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
              }}
            >
              <input
                type="hidden"
                name="intent"
                value="uploadMusic"
              />
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px" }}>
                Upload an MP3 for background music
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 12px" }}>
                Free music: YouTube Audio Library, Pixabay Music, Uppbeat
              </p>
              <label style={{
                display: "inline-block",
                padding: "8px 20px",
                background: "var(--primary)",
                color: "#fff",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}>
                Choose MP3 File
                <input
                  type="file"
                  name="musicFile"
                  accept=".mp3,audio/mpeg"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      const form = e.target.closest("form");
                      if (form) {
                        const formData = new FormData(form);
                        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
                      }
                    }
                  }}
                />
              </label>
            </form>
          )}
        </div>
      )}

      {project.scene_plan && (
        <div className="card mb-4">
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Visual Options</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                background: "var(--bg-secondary)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Show Captions</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Display narration text as animated subtitles at the bottom</div>
              </div>
              <div
                onClick={(e) => { e.preventDefault(); setShowCaptions(!showCaptions); }}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: showCaptions ? "var(--primary)" : "var(--border)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 2,
                  left: showCaptions ? 20 : 2,
                  transition: "left 0.2s",
                }} />
              </div>
            </label>

            {showCaptions && (
              <div
                style={{
                  padding: "10px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Caption Size</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setCaptionSize(size)}
                      style={{
                        padding: "6px 16px",
                        border: captionSize === size ? "2px solid var(--primary)" : "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        background: captionSize === size ? "rgba(124, 77, 255, 0.08)" : "transparent",
                        color: captionSize === size ? "var(--primary)" : "var(--text-secondary)",
                        fontWeight: captionSize === size ? 600 : 400,
                        fontSize: 13,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        transition: "all 0.15s",
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                background: "var(--bg-secondary)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Show Progress Bar</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Subtle bar at the bottom that fills as the video plays</div>
              </div>
              <div
                onClick={(e) => { e.preventDefault(); setShowProgressBar(!showProgressBar); }}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: showProgressBar ? "var(--primary)" : "var(--border)",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                  marginLeft: 12,
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 2,
                  left: showProgressBar ? 20 : 2,
                  transition: "left 0.2s",
                }} />
              </div>
            </label>
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
      ) : planningError ? (
        <div className="empty-state">
          <h3>Planning failed</h3>
          <p style={{ color: "var(--danger)", maxWidth: 480 }}>{planningError}</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Try Again
          </Link>
        </div>
      ) : isPlanning ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 8 }}>AI is planning your video...</h3>
          <p className="text-muted" style={{ fontSize: 14, maxWidth: 400, margin: "0 auto 8px" }}>
            Researching your topic and writing the full scene-by-scene script. This takes 30–60 seconds.
          </p>
          <p className="text-muted" style={{ fontSize: 13 }}>
            You can close this tab — the page will update automatically when it's ready.
          </p>
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

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${error.data}`
    : error instanceof Error
    ? error.message
    : "An unexpected error occurred";

  return (
    <div>
      <div className="page-header">
        <Link to="/projects" className="text-sm text-muted" style={{ textDecoration: "none" }}>
          &larr; Back to Projects
        </Link>
        <h2 style={{ marginTop: 8 }}>Something went wrong</h2>
      </div>
      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <p style={{ color: "var(--danger)", fontWeight: 600, marginBottom: 8 }}>
          Failed to load this project
        </p>
        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>{message}</p>
        <div className="flex gap-3">
          <Link to="/projects" className="btn btn-primary">Go to Projects</Link>
          <button className="btn" onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    </div>
  );
}
