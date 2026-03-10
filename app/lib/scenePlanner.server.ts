import { assets as assetsDb, type Asset } from "./db.server";
import { generateScenePlan, type ScenePlan, type Scene } from "./openrouter.server";

export interface MatchedScene extends Scene {
  matchedAssets: Asset[];
}

export interface MatchedScenePlan extends ScenePlan {
  scenes: MatchedScene[];
}

function findMatchingAssets(tags: string[], allAssets: Asset[]): Asset[] {
  if (tags.length === 0) return [];

  const scored = allAssets.map((asset) => {
    let score = 0;
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      for (const assetTag of asset.tags) {
        if (assetTag === tagLower) {
          score += 3;
        } else if (assetTag.includes(tagLower) || tagLower.includes(assetTag)) {
          score += 1;
        }
      }
    }
    return { asset, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.asset);
}

export async function createScenePlan(prompt: string): Promise<MatchedScenePlan> {
  const allTags = assetsDb.getAllTags();
  const allAssets = assetsDb.getAll();

  const plan = await generateScenePlan(prompt, allTags);

  const matchedScenes: MatchedScene[] = plan.scenes.map((scene) => {
    const matchedAssets = findMatchingAssets(scene.assetTags, allAssets);
    return {
      ...scene,
      matchedAssets,
    };
  });

  return {
    ...plan,
    scenes: matchedScenes,
  };
}
