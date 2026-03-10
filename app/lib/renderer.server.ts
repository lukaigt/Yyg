import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { renders, projects } from "./db.server";

function findChromiumPath(): string | undefined {
  try {
    const result = execSync("which chromium", { encoding: "utf-8" }).trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}
  try {
    const result = execSync("which chromium-browser", { encoding: "utf-8" }).trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}
  try {
    const result = execSync("which google-chrome", { encoding: "utf-8" }).trim();
    if (result && fs.existsSync(result)) return result;
  } catch {}
  return undefined;
}

const CHROMIUM_PATH = findChromiumPath();
if (CHROMIUM_PATH) {
  console.log(`Using system Chromium: ${CHROMIUM_PATH}`);
} else {
  console.log("No system Chromium found, Remotion will download its own");
}

const RENDERS_DIR = path.join(process.cwd(), "storage", "renders");

if (!fs.existsSync(RENDERS_DIR)) {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
}

let bundled: string | null = null;

async function getBundlePath(): Promise<string> {
  if (bundled && fs.existsSync(bundled)) {
    return bundled;
  }

  const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
  bundled = await bundle({
    entryPoint,
    onProgress: (progress: number) => {
      console.log(`Bundling: ${Math.round(progress * 100)}%`);
    },
  });

  return bundled;
}

function resolveAssetPaths(scenePlan: any): any {
  const resolved = { ...scenePlan };
  if (resolved.scenes) {
    resolved.scenes = resolved.scenes.map((scene: any) => ({
      ...scene,
      elements: (scene.elements || []).map((el: any) => {
        if (el.resolvedSrc && !el.resolvedSrc.startsWith("http")) {
          const absPath = el.resolvedSrc;
          const storageIndex = absPath.indexOf("storage/");
          if (storageIndex !== -1) {
            const relativePath = absPath.substring(storageIndex + "storage/".length);
            const port = process.env.PORT || "5000";
            return { ...el, resolvedSrc: `http://127.0.0.1:${port}/storage/${relativePath}` };
          }
        }
        return el;
      }),
    }));
  }
  return resolved;
}

export async function renderVideo(
  renderId: string,
  projectId: string,
  scenePlan: any
): Promise<string> {
  const outputPath = path.join(RENDERS_DIR, `${renderId}.mp4`);

  try {
    const resolvedPlan = resolveAssetPaths(scenePlan);

    renders.updateProgress(renderId, 5);
    console.log("Starting bundle...");
    const bundlePath = await getBundlePath();

    renders.updateProgress(renderId, 15);
    console.log("Bundle complete, selecting composition...");

    const FPS = 30;
    const totalDuration = resolvedPlan.scenes.reduce(
      (acc: number, s: any) => acc + (s.duration || 4),
      0
    );
    const totalFrames = Math.round(totalDuration * FPS);

    const browserExecutable = CHROMIUM_PATH || undefined;

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: "VideoComposition",
      inputProps: { scenePlan: resolvedPlan },
      browserExecutable,
    });

    composition.durationInFrames = totalFrames;
    composition.fps = FPS;
    composition.width = 1920;
    composition.height = 1080;

    renders.updateProgress(renderId, 20);
    console.log(`Rendering ${totalFrames} frames (${totalDuration}s)...`);

    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: { scenePlan: resolvedPlan },
      browserExecutable,
      onProgress: ({ progress }) => {
        const pct = Math.round(20 + progress * 75);
        renders.updateProgress(renderId, pct);
        if (Math.round(progress * 100) % 10 === 0) {
          console.log(`Render progress: ${Math.round(progress * 100)}%`);
        }
      },
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
    });

    renders.complete(renderId, outputPath, totalDuration);
    projects.updateStatus(projectId, "completed");
    console.log(`Render complete: ${outputPath}`);

    return outputPath;
  } catch (error: any) {
    console.error("Render error:", error);
    renders.fail(renderId, error.message || "Unknown render error");
    projects.updateStatus(projectId, "failed");
    throw error;
  }
}
