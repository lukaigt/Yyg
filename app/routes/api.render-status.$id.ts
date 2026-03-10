import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { renders } from "~/lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const render = renders.getById(params.id!);
  if (!render) {
    return json({ error: "Render not found" }, { status: 404 });
  }
  return json(render);
}
