import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { projects } from "~/lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const project = projects.getById(params.id!);
  if (!project) {
    return json({ error: "Not found" }, { status: 404 });
  }
  return json({
    is_planning: project.is_planning,
    scene_plan_ready: !!project.scene_plan,
    planning_error: project.planning_error,
  });
}
