import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { projects } from "~/lib/db.server";
import { createScenePlan } from "~/lib/scenePlanner.server";

const LENGTH_MAP: Record<string, number> = {
  short: 3,
  medium: 8,
  long: 15,
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;
  const lengthPref = (formData.get("length") as string) || "long";
  const targetMinutes = LENGTH_MAP[lengthPref] || 8;

  if (!prompt || !prompt.trim()) {
    return json({ error: "Please enter a topic for your video" }, { status: 400 });
  }

  try {
    const id = uuidv4();
    const name = prompt.trim().substring(0, 60);
    const project = projects.create({ id, name, prompt: prompt.trim() });

    const scenePlan = await createScenePlan(prompt.trim(), targetMinutes);
    projects.updateScenePlan(id, scenePlan);

    return redirect(`/project/${id}`);
  } catch (error: any) {
    console.error("Scene planning error:", error);
    return json(
      { error: `Failed to generate scene plan: ${error.message}` },
      { status: 500 }
    );
  }
}

export default function Index() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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

          <div style={{ marginBottom: 16 }}>
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
                { value: "long", label: "Long (YouTube)", desc: "10-15 min" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "12px 20px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    fontSize: 14,
                    background: "var(--bg-secondary)",
                    minWidth: 120,
                    textAlign: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      name="length"
                      value={opt.value}
                      defaultChecked={opt.value === "long"}
                      disabled={isSubmitting}
                    />
                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{opt.desc}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              This is a rough guide — the AI adjusts based on how much content the topic needs.
            </p>
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
                <span className="spinner" /> AI is planning your video...
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
            <li style={{ marginBottom: 6 }}>You describe the topic — AI breaks it into scenes with narration, animations, and text</li>
            <li style={{ marginBottom: 6 }}>Review the scene plan — see every scene, what gets shown, what gets said</li>
            <li style={{ marginBottom: 6 }}>Hit Render — the system creates a real MP4 video with animated visuals</li>
            <li>Download and upload to YouTube</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
