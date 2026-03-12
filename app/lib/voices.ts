export const AVAILABLE_VOICES = [
  { id: "en-US-GuyNeural", name: "Guy", desc: "Deep male narrator", gender: "male" },
  { id: "en-US-AndrewMultilingualNeural", name: "Andrew", desc: "Warm male storyteller", gender: "male" },
  { id: "en-US-BrianMultilingualNeural", name: "Brian", desc: "Clear male presenter", gender: "male" },
  { id: "en-US-AriaNeural", name: "Aria", desc: "Engaging female narrator", gender: "female" },
  { id: "en-US-JennyNeural", name: "Jenny", desc: "Friendly female voice", gender: "female" },
  { id: "en-US-MichelleNeural", name: "Michelle", desc: "Warm female storyteller", gender: "female" },
] as const;

export const DEFAULT_VOICE = "en-US-AndrewMultilingualNeural";

export type VoiceId = (typeof AVAILABLE_VOICES)[number]["id"];

export const PITCH_OPTIONS = [
  { id: "low", label: "Low", value: "-2st" },
  { id: "normal", label: "Normal", value: "+0Hz" },
  { id: "high", label: "High", value: "+2st" },
] as const;

export type PitchId = (typeof PITCH_OPTIONS)[number]["id"];
