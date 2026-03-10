import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { assets } from "./db.server";
import { generateTags, detectFileType, isAllowedFile } from "./autotag.server";

const STORAGE_DIR = path.join(process.cwd(), "storage", "assets");

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export async function handleFileUpload(
  fileData: Buffer,
  originalName: string,
  mimeType: string
) {
  if (!isAllowedFile(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed`);
  }

  const id = uuidv4();
  const ext = path.extname(originalName) || ".png";
  const filename = `${id}${ext}`;
  const filePath = path.join(STORAGE_DIR, filename);

  fs.writeFileSync(filePath, fileData);

  const tags = generateTags(originalName);
  const fileType = detectFileType(mimeType);
  const hasPng = mimeType === "image/png" || mimeType === "image/svg+xml";

  const asset = assets.create({
    id,
    filename,
    original_name: originalName,
    file_path: filePath,
    file_type: fileType,
    mime_type: mimeType,
    file_size: fileData.length,
    tags,
    has_transparency: hasPng,
  });

  return asset;
}

export function deleteAssetFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
  }
}
