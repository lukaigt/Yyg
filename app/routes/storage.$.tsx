import type { LoaderFunctionArgs } from "@remix-run/node";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function loader({ params }: LoaderFunctionArgs) {
  const filePath = path.join(process.cwd(), "storage", params["*"] || "");

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.join(process.cwd(), "storage"))) {
    throw new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    throw new Response("Not found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  const fileBuffer = fs.readFileSync(resolved);
  return new Response(fileBuffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
