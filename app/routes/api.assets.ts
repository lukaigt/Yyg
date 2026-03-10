import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { assets } from "~/lib/db.server";
import { deleteAssetFile } from "~/lib/upload.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    const asset = assets.getById(id);
    if (asset) {
      deleteAssetFile(asset.file_path);
      assets.delete(id);
    }
    return json({ success: true });
  }

  if (intent === "updateTags") {
    const id = formData.get("id") as string;
    const tagsJson = formData.get("tags") as string;
    try {
      const tags = JSON.parse(tagsJson);
      assets.updateTags(id, tags);
      return json({ success: true });
    } catch {
      return json({ error: "Invalid tags" }, { status: 400 });
    }
  }

  if (intent === "removeBackground") {
    const id = formData.get("id") as string;
    const asset = assets.getById(id);
    if (!asset) {
      return json({ error: "Asset not found" }, { status: 404 });
    }

    try {
      const sharp = (await import("sharp")).default;
      const path = await import("path");
      const fs = await import("fs");

      const outputName = asset.filename.replace(/\.[^.]+$/, ".png");
      const outputPath = path.join(path.dirname(asset.file_path), outputName);

      await sharp(asset.file_path)
        .ensureAlpha()
        .png()
        .toFile(outputPath);

      if (outputPath !== asset.file_path && fs.existsSync(asset.file_path)) {
        fs.unlinkSync(asset.file_path);
      }

      const db = (await import("~/lib/db.server")).default;
      db.prepare(
        "UPDATE assets SET file_path = ?, filename = ?, mime_type = 'image/png', has_transparency = 1, updated_at = datetime('now') WHERE id = ?"
      ).run(outputPath, outputName, id);

      return json({ success: true });
    } catch (error: any) {
      return json({ error: error.message }, { status: 500 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
}
