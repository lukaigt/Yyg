import { useState } from "react";
import { Form, useActionData, useNavigation, Link } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { projects } from "~/lib/db.server";
import { createScenePlan } from "~/lib/scenePlanner.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;

  if (!prompt || !prompt.trim()) {
    return json({ error: "Please enter a topic for your video" }, { status: 400 });
  }

  try {
    const id = uuidv4();
    const name = prompt.trim().substring(0, 60);
    const project = projects.create({ id, name, prompt: prompt.trim() });

    const scenePlan = await createScenePlan(prompt.trim());
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
        <p>Enter a topic and let AI plan your animated explainer video</p>
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
              Video Topic
            </label>
            <textarea
              id="prompt"
              name="prompt"
              placeholder="e.g., How to teach your dog to sit down in 5 easy steps"
              rows={4}
              style={{ width: "100%", minHeight: 120 }}
              disabled={isSubmitting}
            />
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
                <span className="spinner" /> Generating Scene Plan...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
                </svg>
                Generate Scene Plan
              </>
            )}
          </button>
        </Form>

        <div style={{ marginTop: 24, padding: "16px 0", borderTop: "1px solid var(--border)" }}>
          <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
            Tips for better results:
          </p>
          <ul style={{ color: "var(--text-secondary)", fontSize: 13, paddingLeft: 20 }}>
            <li style={{ marginBottom: 4 }}>Be specific about what the video should explain</li>
            <li style={{ marginBottom: 4 }}>Upload relevant assets to your library first for best matching</li>
            <li style={{ marginBottom: 4 }}>Include the number of steps if it's a how-to video</li>
            <li>Keep topics focused — one subject per video works best</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
