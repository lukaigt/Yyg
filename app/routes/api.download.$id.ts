import type { LoaderFunctionArgs } from "@remix-run/node";
import fs from "fs";
import path from "path";
import { renders } from "~/lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const render = renders.getById(params.id!);
  if (!render || !render.file_path) {
    throw new Response("Render not found", { status: 404 });
  }

  if (!fs.existsSync(render.file_path)) {
    throw new Response("File not found", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(render.file_path);
  const fileName = `video-${render.id.substring(0, 8)}.mp4`;

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
