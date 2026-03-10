export interface ScenePlan {
  title: string;
  totalDuration: number;
  scenes: Scene[];
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

export async function generateScenePlan(
  prompt: string,
  availableTags: string[]
): Promise<ScenePlan> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const systemPrompt = `You are a video scene planner for animated explainer videos in the style of The Infographics Show or CGP Grey on YouTube. You create structured scene plans with real motion animations — objects sliding, bouncing, rotating across the screen, text animating in with effects, smooth transitions between scenes.

You will be given a topic and a list of available asset tags from the user's library. Create a scene plan that uses these assets with engaging animations.

IMPORTANT RULES:
- Create 4-8 scenes depending on topic complexity
- Each scene should be 3-6 seconds long
- Use available asset tags when possible, but you can suggest tags that might not exist yet
- Every scene must have at least one animated element with real motion (not just static display)
- Use varied animations: slides, bounces, fades, scales, spins — don't repeat the same one
- Text overlays should be concise (max 10 words per overlay)
- Use contrasting colors for text on backgrounds
- Background colors should be dark, professional tones (hex codes)
- Positions are percentages: x=0 is left edge, x=100 is right, y=0 is top, y=100 is bottom, center is x=50,y=50

RESPOND WITH ONLY VALID JSON matching this exact structure:
{
  "title": "Video Title",
  "totalDuration": <sum of all scene durations>,
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 4,
      "narrationText": "What the narrator would say during this scene",
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

  const userPrompt = `Topic: "${prompt}"

Available asset tags in the library: ${availableTags.length > 0 ? availableTags.join(", ") : "No assets uploaded yet — suggest tags the user should get"}

Create an animated explainer video scene plan for this topic.`;

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
      max_tokens: 4000,
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
