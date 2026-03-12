import path from "path";
import fs from "fs";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
export { AVAILABLE_VOICES, DEFAULT_VOICE, PITCH_OPTIONS } from "./voices";
export type { VoiceId, PitchId } from "./voices";

function ensureVoiceoverDir(): string {
  const dir = path.join(process.cwd(), "storage", "voiceover");
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error("Failed to create voiceover directory:", err);
  }
  return dir;
}

function preprocessText(text: string): string {
  let processed = text;
  processed = processed.replace(/\.\s+/g, ".\u2003 ");
  processed = processed.replace(/\?\s+/g, "?\u2003 ");
  processed = processed.replace(/!\s+/g, "!\u2003 ");
  processed = processed.replace(/—/g, " — ");
  processed = processed.replace(/\s*–\s*/g, " — ");
  processed = processed.replace(/:\s+/g, ":\u2003 ");
  return processed;
}

async function generateSingleAudio(
  text: string,
  voiceId: string,
  outputDir: string,
  filename: string,
  rate: number = 1.05,
  pitch: string = "+0Hz"
): Promise<string> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const processedText = preprocessText(text);

  const { audioFilePath } = await tts.toFile(outputDir, processedText, {
    rate,
    pitch,
    volume: 100,
  });

  const finalPath = path.join(outputDir, filename);
  fs.renameSync(audioFilePath, finalPath);
  return finalPath;
}

export async function generateVoiceover(
  renderId: string,
  scenes: Array<{ sceneNumber: number; narrationText: string }>,
  voiceId: string = DEFAULT_VOICE,
  rate: number = 1.05,
  pitch: string = "+0Hz"
): Promise<string[]> {
  const renderVoiceDir = path.join(ensureVoiceoverDir(), renderId);
  if (!fs.existsSync(renderVoiceDir)) {
    fs.mkdirSync(renderVoiceDir, { recursive: true });
  }

  const audioPaths: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const text = scene.narrationText?.trim();
    if (!text) {
      audioPaths.push("");
      continue;
    }

    const filename = `scene_${String(i).padStart(3, "0")}.mp3`;
    console.log(`TTS scene ${i + 1}/${scenes.length}: "${text.substring(0, 50)}..."`);

    try {
      const audioPath = await generateSingleAudio(text, voiceId, renderVoiceDir, filename, rate, pitch);
      audioPaths.push(audioPath);
    } catch (err: any) {
      console.error(`TTS failed for scene ${i + 1}:`, err.message);
      audioPaths.push("");
    }
  }

  return audioPaths;
}
