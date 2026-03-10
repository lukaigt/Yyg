const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "this", "that", "was", "are",
  "be", "has", "had", "not", "no", "do", "does", "did", "will", "would",
  "can", "could", "may", "might", "shall", "should", "must", "need",
  "img", "image", "photo", "pic", "picture", "file", "download",
  "copy", "final", "new", "old", "version", "edit", "edited",
  "untitled", "screenshot", "screen", "shot", "capture",
  "png", "jpg", "jpeg", "webp", "svg", "mp4", "webm", "gif", "bmp",
]);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  person: ["person", "people", "man", "woman", "boy", "girl", "human", "character", "avatar", "face", "body", "hand", "hands", "head", "figure", "standing", "sitting", "walking", "running", "pointing", "waving", "talking", "thinking", "working", "student", "teacher", "doctor", "chef", "worker", "business"],
  animal: ["animal", "dog", "cat", "bird", "fish", "horse", "lion", "tiger", "bear", "elephant", "rabbit", "mouse", "snake", "cow", "pig", "sheep", "chicken", "duck", "monkey", "pet", "puppy", "kitten", "wildlife"],
  nature: ["nature", "tree", "flower", "plant", "forest", "mountain", "ocean", "sea", "river", "lake", "sky", "cloud", "sun", "moon", "star", "rain", "snow", "leaf", "garden", "grass", "landscape"],
  background: ["background", "bg", "backdrop", "scene", "scenery", "wallpaper", "texture", "pattern", "gradient", "abstract"],
  icon: ["icon", "symbol", "logo", "badge", "emblem", "sign", "mark", "indicator", "button"],
  arrow: ["arrow", "pointer", "direction", "left", "right", "up", "down", "next", "previous", "forward", "back"],
  food: ["food", "fruit", "vegetable", "meal", "dish", "cooking", "kitchen", "recipe", "eat", "drink", "coffee", "tea", "pizza", "burger", "cake", "bread", "meat", "salad"],
  tech: ["tech", "computer", "phone", "laptop", "tablet", "screen", "monitor", "keyboard", "mouse", "code", "programming", "software", "hardware", "internet", "web", "digital", "data", "server", "robot", "ai"],
  education: ["education", "school", "book", "study", "learn", "teach", "class", "lesson", "pen", "pencil", "notebook", "library", "science", "math", "history", "geography"],
  health: ["health", "medical", "hospital", "doctor", "nurse", "medicine", "heart", "brain", "body", "fitness", "exercise", "sport", "gym", "yoga", "wellness"],
  transport: ["car", "bus", "train", "plane", "airplane", "bike", "bicycle", "ship", "boat", "truck", "vehicle", "transport", "road", "highway", "traffic"],
  business: ["business", "office", "work", "meeting", "presentation", "chart", "graph", "money", "finance", "bank", "economy", "market", "sales", "team", "strategy"],
  shape: ["circle", "square", "triangle", "rectangle", "star", "diamond", "oval", "line", "dot", "shape", "geometric"],
};

export function generateTags(filename: string): string[] {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
  const words = nameWithoutExt
    .replace(/[_\-\.]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const tags = new Set<string>(words);

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const word of words) {
      if (keywords.includes(word)) {
        tags.add(category);
        break;
      }
    }
  }

  const numMatch = nameWithoutExt.match(/\d+/);
  if (numMatch) {
    tags.delete(numMatch[0]);
  }

  return Array.from(tags).slice(0, 20);
}

export function detectFileType(mimeType: string): "image" | "video" {
  if (mimeType.startsWith("video/")) return "video";
  return "image";
}

export function isAllowedFile(mimeType: string): boolean {
  const allowed = [
    "image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif",
    "video/mp4", "video/webm",
  ];
  return allowed.includes(mimeType);
}
