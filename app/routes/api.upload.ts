import type { ActionFunctionArgs } from "@remix-run/node";
import { json, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { handleFileUpload } from "~/lib/upload.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const uploadHandler = unstable_createMemoryUploadHandler({
      maxPartSize: 50_000_000,
    });

    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    const files = formData.getAll("files");

    const results = [];
    for (const file of files) {
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const asset = await handleFileUpload(buffer, file.name, file.type);
        results.push(asset);
      }
    }

    return json({ success: true, assets: results });
  } catch (error: any) {
    console.error("Upload error:", error);
    return json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
