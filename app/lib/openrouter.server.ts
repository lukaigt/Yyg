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

export const AVAILABLE_MODELS = [
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", desc: "Fast & cheap, great for structured plans", tier: "free" },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", desc: "Latest Gemini, better reasoning", tier: "cheap" },
  { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3", desc: "Very cheap, solid quality", tier: "cheap" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", desc: "Good balance of cost and quality", tier: "cheap" },
  { id: "openai/gpt-4o", name: "GPT-4o", desc: "High quality all-rounder", tier: "mid" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", desc: "Best narration writing quality", tier: "mid" },
] as const;

export const DEFAULT_MODEL = "google/gemini-2.0-flash-001";

function buildSystemPrompt(targetMinutes: number): string {
  const lengthGuidance = targetMinutes <= 4
    ? `Aim for roughly ${targetMinutes} minutes. Create 6-15 scenes, each 3-8 seconds.`
    : targetMinutes <= 10
    ? `Aim for roughly ${targetMinutes} minutes. Create 25-50 scenes. Vary scene durations — quick scenes (3-5s) for transitions, longer scenes (8-15s) for detailed explanations.`
    : `Aim for roughly ${targetMinutes} minutes. Create 40-70 scenes. Vary scene durations — quick scenes (3-5s) for transitions, longer scenes (8-15s) for detailed explanations.`;

  return `You are a video scene planner for animated explainer videos in the style of The Infographics Show or Kurzgesagt on YouTube.

Your job: take a topic and turn it into a full structured scene plan. You decide the story structure, what to cover, how to explain it, and how to keep it engaging. Think like a YouTube scriptwriter — hook the viewer, explain things clearly, use visual variety.

You will receive a topic description (could be brief like "history of coffee" or detailed with specific points to cover), available visual assets, and a rough length target.

RULES FOR SCENE PLANNING:
- ${lengthGuidance}
- The total duration should be NATURAL for the topic — don't pad or rush. If a topic naturally fits 7 minutes, make it 7 minutes even if the target says 10. Better to be engaging than to fill time.
- Structure the video with clear sections: hook/intro, main content broken into logical parts, conclusion
- Write narration text as if it's a real YouTube script — conversational, interesting, not robotic
- Every scene needs at least one animated visual element with real motion (sliding, bouncing, scaling, rotating)
- Vary animations — cycle through slides, bounces, fades, scales, spins. Don't use the same one 3 times in a row
- Text overlays: max 10 words each, use them for key terms, numbers, names
- Background colors: dark professional tones (hex codes), vary between sections
- Positions are percentages: x=0 left, x=100 right, y=0 top, y=100 bottom, center is x=50,y=50
- 1-3 animated elements per scene, 1-2 text overlays per scene
- Section title scenes at major transitions (larger text, bold animation)
- Start with a hook, end with a proper conclusion

ASSET MATCHING:
- You'll get a list of available asset tags from the user's library
- Match scene visuals to available assets when possible
- If no good match exists, suggest descriptive tags — the user can add those assets later
- Be creative with reusing assets in different contexts (a "person" asset works for many scenes)

RESPOND WITH ONLY VALID JSON:
{
  "title": "Video Title",
  "totalDuration": <sum of all scene durations in seconds>,
  "sections": [
    {"title": "Introduction", "startScene": 1, "endScene": 3},
    {"title": "Section Name", "startScene": 4, "endScene": 10}
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "section": "Introduction",
      "narrationText": "Full narration script for this scene",
      "visualDescription": "What the viewer sees happening",
      "assetTags": ["tag1", "tag2"],
      "backgroundColor": "#1a1a2e",
      "textOverlays": [
        {
          "text": "Title Text",
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
  maxTokens: number,
  model: string = DEFAULT_MODEL
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
      model,
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
  targetMinutes: number = 8,
  research: string = "",
  model: string = DEFAULT_MODEL
): Promise<ScenePlan> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const tagsStr = availableTags.length > 0
    ? availableTags.join(", ")
    : "No assets uploaded yet — suggest descriptive tags the user should add (e.g., person, map, arrow, globe, building)";

  const researchBlock = research
    ? `\n\n${research}\n\nIMPORTANT: Use the research findings above for accurate facts, dates, names, and details in your narration. Do not make up facts — if the research doesn't cover something, keep it general rather than inventing specifics.`
    : "";

  const systemPrompt = buildSystemPrompt(targetMinutes);

  if (targetMinutes <= 5) {
    const userPrompt = `Topic: "${prompt}"

Available assets: ${tagsStr}
${researchBlock}

Plan an animated explainer video for this topic. Aim for around ${targetMinutes} minutes but let the content dictate the natural length.`;

    const content = await callOpenRouter(apiKey, systemPrompt, userPrompt, 8000, model);
    return parseScenePlan(content);
  }

  const halfTarget = Math.ceil(targetMinutes / 2);

  const userPromptPart1 = `Topic: "${prompt}"

Available assets: ${tagsStr}
${researchBlock}

Plan the FIRST HALF of an animated explainer video on this topic (target ~${targetMinutes} min total).
Cover: the hook/introduction and the first major sections of the topic.
Generate approximately ${halfTarget} minutes worth of scenes. Start at scene 1.
Make it feel like the first half of a real YouTube video — hook the viewer and build momentum.`;

  console.log(`Planning part 1 of 2 (~${halfTarget} min) with ${model}...`);
  const content1 = await callOpenRouter(apiKey, systemPrompt, userPromptPart1, 16000, model);
  const plan1 = parseScenePlan(content1);

  const lastScene = plan1.scenes[plan1.scenes.length - 1];
  const nextSceneNumber = lastScene ? lastScene.sceneNumber + 1 : 1;
  const part1Duration = plan1.scenes.reduce((acc, s) => acc + s.duration, 0);
  const remainingSeconds = Math.max(60, (targetMinutes * 60) - part1Duration);
  const coveredSections = plan1.sections?.map(s => s.title).join(", ") || "Introduction and first sections";

  const userPromptPart2 = `Topic: "${prompt}"

Available assets: ${tagsStr}
${researchBlock}

Plan the SECOND HALF of this video. The first half already covered: ${coveredSections}
(${plan1.scenes.length} scenes, ${Math.round(part1Duration / 60)} minutes so far)

Continue from scene ${nextSceneNumber}. Cover the remaining aspects of the topic and end with a strong conclusion/summary.
Generate approximately ${Math.round(remainingSeconds / 60)} more minutes of content.
Don't repeat what was already covered. Build toward a satisfying ending.`;

  console.log(`Planning part 2 of 2 (~${Math.round(remainingSeconds / 60)} min) with ${model}...`);
  const content2 = await callOpenRouter(apiKey, systemPrompt, userPromptPart2, 16000, model);
  const plan2 = parseScenePlan(content2);

  const allScenes = [
    ...plan1.scenes,
    ...plan2.scenes.map((s, i) => ({
      ...s,
      sceneNumber: nextSceneNumber + i,
    })),
  ];

  const part1SceneCount = plan1.scenes.length;
  const allSections = [
    ...(plan1.sections || []),
    ...(plan2.sections || []).map(s => ({
      ...s,
      startScene: s.startScene + part1SceneCount,
      endScene: s.endScene + part1SceneCount,
    })),
  ];

  const combinedPlan: ScenePlan = {
    title: plan1.title,
    totalDuration: allScenes.reduce((acc, s) => acc + s.duration, 0),
    sections: allSections,
    scenes: allScenes,
  };

  console.log(`Final plan: ${combinedPlan.scenes.length} scenes, ${Math.round(combinedPlan.totalDuration / 60)} minutes`);
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
