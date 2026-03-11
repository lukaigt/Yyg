import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { renders, projects } from "./db.server";
import { generateVoiceover, AVAILABLE_VOICES } from "./tts.server";

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

let _chromiumPath: string | undefined | null = null;
function getChromiumPath(): string | undefined {
  if (_chromiumPath === null) {
    _chromiumPath = findChromiumPath();
    if (_chromiumPath) {
      console.log(`Using system Chromium: ${_chromiumPath}`);
    } else {
      console.log("No system Chromium found, Remotion will download its own");
    }
  }
  return _chromiumPath || undefined;
}

function ensureRendersDir(): string {
  const dir = path.join(process.cwd(), "storage", "renders");
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create renders directory:", err);
  }
  return dir;
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

export interface RenderOptions {
  voiceId?: string;
  voiceRate?: number;
  voicePitch?: string;
  musicPath?: string | null;
  musicVolume?: number;
  showCaptions?: boolean;
  captionSize?: string;
  showProgressBar?: boolean;
}

export async function renderVideo(
  renderId: string,
  projectId: string,
  scenePlan: any,
  voiceIdOrOptions?: string | RenderOptions
): Promise<string> {
  const options: RenderOptions = typeof voiceIdOrOptions === "string"
    ? { voiceId: voiceIdOrOptions }
    : voiceIdOrOptions || {};
  const voiceId = options.voiceId;
  const outputPath = path.join(ensureRendersDir(), `${renderId}.mp4`);

  try {
    const resolvedPlan = resolveAssetPaths(scenePlan);

    renders.updateProgress(renderId, 3);
    console.log("Generating voiceover...");

    const port = process.env.PORT || "5000";
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const voiceInfo = AVAILABLE_VOICES.find(v => v.id === voiceId);
      const pitchValue = options.voicePitch === "low" ? "-2st" : options.voicePitch === "high" ? "+2st" : "+0Hz";
      const audioPaths = await generateVoiceover(
        renderId,
        resolvedPlan.scenes,
        voiceId,
        options.voiceRate ?? 1.05,
        pitchValue
      );
      resolvedPlan.scenes = resolvedPlan.scenes.map((scene: any, i: number) => {
        if (audioPaths[i]) {
          const storageIndex = audioPaths[i].indexOf("storage/");
          if (storageIndex !== -1) {
            const relativePath = audioPaths[i].substring(storageIndex + "storage/".length);
            return { ...scene, voiceoverUrl: `${baseUrl}/storage/${relativePath}` };
          }
        }
        return scene;
      });
      console.log("Voiceover generation complete");
    } catch (err: any) {
      console.error("Voiceover generation failed, continuing without:", err.message);
    }

    let musicUrl: string | undefined;
    if (options.musicPath && fs.existsSync(options.musicPath)) {
      const storageIndex = options.musicPath.indexOf("storage/");
      if (storageIndex !== -1) {
        const relativePath = options.musicPath.substring(storageIndex + "storage/".length);
        musicUrl = `${baseUrl}/storage/${relativePath}`;
      }
    }

    renders.updateProgress(renderId, 15);
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

    const browserExecutable = getChromiumPath();

    const inputProps = {
      scenePlan: resolvedPlan,
      musicUrl: musicUrl || null,
      musicVolume: options.musicVolume ?? 0.15,
      showCaptions: options.showCaptions ?? true,
      captionSize: options.captionSize ?? "medium",
      showProgressBar: options.showProgressBar ?? true,
    };

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: "VideoComposition",
      inputProps,
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
      inputProps,
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
