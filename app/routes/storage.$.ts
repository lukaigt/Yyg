import type { LoaderFunctionArgs } from "@remix-run/node";
import path from "path";
import fs from "fs";

const STORAGE_DIR = path.join(process.cwd(), "storage");

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

export async function loader({ params }: LoaderFunctionArgs) {
  const filePath = params["*"];
  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  const resolved = path.resolve(STORAGE_DIR, filePath);
  if (!resolved.startsWith(STORAGE_DIR + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const data = fs.readFileSync(resolved);

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
