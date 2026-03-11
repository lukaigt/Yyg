import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { v4 as uuidv4 } from "uuid";
import { projects, renders, assets as assetsDb } from "~/lib/db.server";
import { renderVideo } from "~/lib/renderer.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const { projectId, voiceId, voiceRate, voicePitch } = body;

  const project = projects.getById(projectId);
  if (!project || !project.scene_plan) {
    return json({ error: "Project not found or no scene plan" }, { status: 400 });
  }

  const renderId = uuidv4();
  renders.create({ id: renderId, project_id: projectId });
  projects.updateStatus(projectId, "rendering");

  const allAssets = assetsDb.getAll();
  const resolvedPlan = { ...project.scene_plan };
  if (resolvedPlan.scenes) {
    resolvedPlan.scenes = resolvedPlan.scenes.map((scene: any) => ({
      ...scene,
      elements: (scene.elements || []).map((el: any) => {
        const matched = allAssets.find((a) =>
          a.tags.some((t: string) => t.toLowerCase() === el.assetTag?.toLowerCase())
        );
        return {
          ...el,
          resolvedSrc: matched ? matched.file_path : undefined,
        };
      }),
    }));
  }

  renderVideo(renderId, projectId, resolvedPlan, {
    voiceId,
    voiceRate: voiceRate ?? 1.05,
    voicePitch: voicePitch ?? "normal",
  }).catch((err) => {
    console.error("Render failed:", err);
  });

  return json({ renderId, status: "queued" });
}
