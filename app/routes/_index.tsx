import { useState } from "react";
import { Form, useActionData, useNavigation, Link, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { projects } from "~/lib/db.server";
import { useLoaderData } from "@remix-run/react";

const LENGTH_MAP: Record<string, number> = {
  short: 3,
  medium: 8,
  long: 15,
};

export async function loader() {
  const { AVAILABLE_MODELS, DEFAULT_MODEL } = await import("~/lib/openrouter.server");
  return json({ models: AVAILABLE_MODELS, defaultModel: DEFAULT_MODEL });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { AVAILABLE_MODELS, DEFAULT_MODEL } = await import("~/lib/openrouter.server");
    const { createScenePlan } = await import("~/lib/scenePlanner.server");

    const formData = await request.formData();
    const prompt = formData.get("prompt") as string;
    const lengthPref = (formData.get("length") as string) || "long";
    const model = (formData.get("model") as string) || DEFAULT_MODEL;
    const targetMinutes = LENGTH_MAP[lengthPref] || 8;

    if (!prompt || !prompt.trim()) {
      return json({ error: "Please enter a topic for your video" }, { status: 400 });
    }

    const validModelIds = AVAILABLE_MODELS.map(m => m.id);
    const selectedModel = validModelIds.includes(model as any) ? model : DEFAULT_MODEL;

    const id = uuidv4();
    const name = prompt.trim().substring(0, 60);
    projects.create({ id, name, prompt: prompt.trim() });
    projects.setPlanning(id, true);

    createScenePlan(prompt.trim(), targetMinutes, selectedModel)
      .then((scenePlan) => {
        projects.updateScenePlan(id, scenePlan);
        projects.setPlanning(id, false);
      })
      .catch((error: any) => {
        console.error("Background scene planning error:", error);
        projects.setPlanningError(id, error.message || "Planning failed");
      });

    return redirect(`/project/${id}`);
  } catch (err) {
    console.error("Index action error:", err);
    return json({ error: err instanceof Error ? err.message : "Failed to create project" }, { status: 500 });
  }
}

export default function Index() {
  const { models, defaultModel } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);

  return (
    <div>
      <div className="page-header">
        <h2>Create New Video</h2>
        <p>Describe what your video should be about and the AI will plan the whole thing</p>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <Form method="post">
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="prompt"
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              What should the video be about?
            </label>
            <textarea
              id="prompt"
              name="prompt"
              placeholder={"e.g., The rise and fall of Alexander the Great — from Macedonia to conquering Persia, Egypt, and beyond. Cover his key battles, his generals, and what happened after his death."}
              rows={5}
              style={{ width: "100%", minHeight: 140 }}
              disabled={isSubmitting}
            />
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              The more detail you give, the better the video. You can be brief ("history of coffee") or detailed with specific points you want covered.
            </p>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                Video Length
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { value: "short", label: "Short", desc: "2-4 min" },
                  { value: "medium", label: "Medium", desc: "6-10 min" },
                  { value: "long", label: "Long", desc: "10-15 min" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      padding: "8px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      fontSize: 13,
                      background: "var(--bg-secondary)",
                      minWidth: 80,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="radio"
                        name="length"
                        value={opt.value}
                        defaultChecked={opt.value === "long"}
                        disabled={isSubmitting}
                      />
                      <span style={{ fontWeight: 600 }}>{opt.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setShowModelPicker(!showModelPicker)}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: 13,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {showModelPicker ? "Hide AI model options" : "Change AI model"}
            </button>

            {showModelPicker && (
              <div style={{ marginTop: 8 }}>
                {models.map((m: any) => (
                  <label
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      fontSize: 13,
                      background: "var(--bg-secondary)",
                      marginBottom: 6,
                    }}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={m.id}
                      checked={selectedModel === m.id}
                      onChange={() => setSelectedModel(m.id)}
                      disabled={isSubmitting}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: m.tier === "free" ? "rgba(0,200,83,0.15)" : m.tier === "cheap" ? "rgba(255,209,102,0.15)" : "rgba(124,77,255,0.15)",
                          color: m.tier === "free" ? "#00c853" : m.tier === "cheap" ? "#ffd166" : "var(--primary)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}>
                          {m.tier}
                        </span>
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{m.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {!showModelPicker && (
              <input type="hidden" name="model" value={selectedModel} />
            )}
          </div>

          {actionData?.error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(244, 91, 105, 0.1)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius)",
                color: "var(--danger)",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {actionData.error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ width: "100%" }}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" /> Researching topic & planning video...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
                </svg>
                Plan My Video
              </>
            )}
          </button>
        </Form>

        <div style={{ marginTop: 24, padding: "16px 0", borderTop: "1px solid var(--border)" }}>
          <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
            How it works:
          </p>
          <ol style={{ color: "var(--text-secondary)", fontSize: 13, paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>You describe the topic — the system searches the web for accurate facts first</li>
            <li style={{ marginBottom: 6 }}>AI uses those facts to plan scenes with narration, animations, and text</li>
            <li style={{ marginBottom: 6 }}>Review the scene plan — see every scene, what gets shown, what gets said</li>
            <li style={{ marginBottom: 6 }}>Hit Render — the system creates a real MP4 video with animated visuals</li>
            <li>Download and upload to YouTube</li>
          </ol>
        </div>
      </div>
    </div>
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
    <div>
      <div className="page-header">
        <h2>Something went wrong</h2>
      </div>
      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <p style={{ color: "var(--danger)", fontWeight: 600, marginBottom: 8 }}>Error</p>
        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>{message}</p>
        <Link to="/" className="btn btn-primary" onClick={() => window.location.href = "/"}>Try Again</Link>
      </div>
    </div>
  );
}
