export interface ScenePlan {
  title: string;
  totalDuration: number;
  sections?: Section[];
  scenes: Scene[];
}

export interface Section {
  title: string;
  startScene: number;
  endScene: number;
}

export interface Scene {
  sceneNumber: number;
  duration: number;
  narrationText: string;
  visualDescription: string;
  assetTags: string[];
  backgroundColor: string;
  textOverlays: TextOverlay[];
  elements: AnimationElement[];
  transition: string;
  section?: string;
}

export interface TextOverlay {
  text: string;
  position: "top" | "center" | "bottom" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  fontSize: number;
  animation: "fadeIn" | "slideIn" | "typewriter" | "bounceIn" | "scaleIn";
  color: string;
  delay: number;
}

export interface AnimationElement {
  role: string;
  assetTag: string;
  motion: "slideFromLeft" | "slideFromRight" | "slideFromTop" | "slideFromBottom" | "bounceIn" | "fadeIn" | "scaleIn" | "floatIn" | "spinIn";
  position: { x: number; y: number };
  scale: number;
  delay: number;
  duration: number;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function buildSystemPrompt(targetMinutes: number): string {
  const sceneCount = targetMinutes <= 2
    ? "4-8"
    : targetMinutes <= 5
    ? "15-25"
    : targetMinutes <= 10
    ? "40-60"
    : "60-90";

  const sceneDuration = targetMinutes <= 2 ? "3-6" : "5-15";

  return `You are a video scene planner for animated explainer videos in the style of The Infographics Show or CGP Grey on YouTube. You create structured scene plans with real motion animations — objects sliding, bouncing, rotating across the screen, text animating in with effects, smooth transitions between scenes.

You will be given a topic, target video length, and a list of available asset tags from the user's library. Create a detailed scene plan that fills the requested duration.

IMPORTANT RULES:
- Target video length: approximately ${targetMinutes} minutes
- Create ${sceneCount} scenes to fill this duration
- Each scene should be ${sceneDuration} seconds long
- VARY scene durations — some scenes are quick (3-5s for transitions/emphasis), others are longer (8-15s for detailed explanations)
- Structure the video with clear sections: Introduction, main content sections, and conclusion
- Use available asset tags when possible, but you can suggest tags that might not exist yet
- Every scene must have at least one animated element with real motion (not just static display)
- Use varied animations: slides, bounces, fades, scales, spins — cycle through them, don't repeat the same one 3 times in a row
- Text overlays should be concise (max 10 words per overlay)
- Use contrasting colors for text on backgrounds
- Background colors should be dark, professional tones (hex codes) — vary them between sections to create visual variety
- Positions are percentages: x=0 is left edge, x=100 is right, y=0 is top, y=100 is bottom, center is x=50,y=50
- Each scene should have 1-3 animated elements and 1-2 text overlays
- Include section title scenes at the start of each major section (larger text, bold animation)
- End with a proper conclusion/summary scene

RESPOND WITH ONLY VALID JSON matching this exact structure:
{
  "title": "Video Title",
  "totalDuration": <sum of all scene durations in seconds>,
  "sections": [
    {"title": "Introduction", "startScene": 1, "endScene": 3},
    {"title": "Section Title", "startScene": 4, "endScene": 10}
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "section": "Introduction",
      "narrationText": "What the narrator would say during this scene — write enough text to fill the scene duration naturally",
      "visualDescription": "Brief description of what happens visually",
      "assetTags": ["tag1", "tag2"],
      "backgroundColor": "#1a1a2e",
      "textOverlays": [
        {
          "text": "Short Title Text",
          "position": "top",
          "fontSize": 48,
          "animation": "slideIn",
          "color": "#ffffff",
          "delay": 0.5
        }
      ],
      "elements": [
        {
          "role": "main",
          "assetTag": "tag1",
          "motion": "slideFromLeft",
          "position": {"x": 50, "y": 55},
          "scale": 0.8,
          "delay": 0,
          "duration": 2
        }
      ],
      "transition": "crossfade"
    }
  ]
}`;
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://videoforge.app",
      "X-Title": "VideoForge",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from OpenRouter");
  }

  return content;
}

export async function generateScenePlan(
  prompt: string,
  availableTags: string[],
  targetMinutes: number = 1
): Promise<ScenePlan> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const tagsStr = availableTags.length > 0
    ? availableTags.join(", ")
    : "No assets uploaded yet — suggest tags the user should get";

  if (targetMinutes <= 5) {
    const systemPrompt = buildSystemPrompt(targetMinutes);
    const userPrompt = `Topic: "${prompt}"
Target length: ${targetMinutes} minutes
Available asset tags in the library: ${tagsStr}

Create a detailed animated explainer video scene plan for this topic. Make sure the total scene durations add up to approximately ${targetMinutes * 60} seconds.`;

    const maxTokens = targetMinutes <= 2 ? 4000 : 8000;
    const content = await callOpenRouter(apiKey, systemPrompt, userPrompt, maxTokens);
    return parseScenePlan(content);
  }

  const systemPrompt = buildSystemPrompt(targetMinutes);
  const halfDuration = Math.ceil(targetMinutes / 2);

  const userPromptPart1 = `Topic: "${prompt}"
Target length: ${targetMinutes} minutes total
THIS IS PART 1 OF 2 — generate the first ${halfDuration} minutes worth of scenes (approximately ${halfDuration * 60} seconds).
Start with scene 1 (Introduction) and cover the first half of the topic content.
Available asset tags in the library: ${tagsStr}

Create a detailed animated explainer video scene plan. Make sure durations add up to approximately ${halfDuration * 60} seconds.`;

  console.log(`Generating part 1 of 2 for ${targetMinutes}-minute video...`);
  const content1 = await callOpenRouter(apiKey, systemPrompt, userPromptPart1, 16000);
  const plan1 = parseScenePlan(content1);

  const lastScene = plan1.scenes[plan1.scenes.length - 1];
  const nextSceneNumber = lastScene ? lastScene.sceneNumber + 1 : 1;
  const part1Duration = plan1.scenes.reduce((acc, s) => acc + s.duration, 0);
  const remainingDuration = Math.max(60, (targetMinutes * 60) - part1Duration);

  const userPromptPart2 = `Topic: "${prompt}"
Target length: ${targetMinutes} minutes total
THIS IS PART 2 OF 2 — generate the remaining scenes (approximately ${remainingDuration} seconds worth).
Continue from scene number ${nextSceneNumber}. Cover the second half of the topic and end with a conclusion/summary.
The first part covered: ${plan1.sections?.map(s => s.title).join(", ") || plan1.scenes.slice(0, 3).map(s => s.visualDescription).join(", ")}
Available asset tags in the library: ${tagsStr}

Create the remaining scenes. Start scene numbering at ${nextSceneNumber}. Make sure durations add up to approximately ${remainingDuration} seconds.`;

  console.log(`Generating part 2 of 2...`);
  const content2 = await callOpenRouter(apiKey, systemPrompt, userPromptPart2, 16000);
  const plan2 = parseScenePlan(content2);

  const combinedPlan: ScenePlan = {
    title: plan1.title,
    totalDuration: plan1.scenes.reduce((acc, s) => acc + s.duration, 0) +
                   plan2.scenes.reduce((acc, s) => acc + s.duration, 0),
    sections: [
      ...(plan1.sections || []),
      ...(plan2.sections || []).map(s => ({
        ...s,
        startScene: s.startScene + (plan1.scenes.length),
        endScene: s.endScene + (plan1.scenes.length),
      })),
    ],
    scenes: [
      ...plan1.scenes,
      ...plan2.scenes.map((s, i) => ({
        ...s,
        sceneNumber: nextSceneNumber + i,
      })),
    ],
  };

  console.log(`Combined plan: ${combinedPlan.scenes.length} scenes, ${combinedPlan.totalDuration}s total`);
  return combinedPlan;
}

function parseScenePlan(content: string): ScenePlan {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse scene plan JSON from response");
  }

  const scenePlan: ScenePlan = JSON.parse(jsonMatch[0]);

  if (!scenePlan.scenes || !Array.isArray(scenePlan.scenes)) {
    throw new Error("Invalid scene plan: missing scenes array");
  }

  return scenePlan;
}
