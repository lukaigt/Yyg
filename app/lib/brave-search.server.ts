interface BraveSearchResult {
  title: string;
  description: string;
  url: string;
}

interface BraveWebResult {
  title?: string;
  description?: string;
  url?: string;
}

interface BraveResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

export async function searchBrave(query: string, count: number = 10): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("BRAVE_SEARCH_API_KEY not set, skipping web research");
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    text_decorations: "false",
    search_lang: "en",
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    console.error(`Brave Search error: ${response.status}`);
    return [];
  }

  const data: BraveResponse = await response.json();

  return (data.web?.results || [])
    .filter((r): r is Required<Pick<BraveWebResult, "title" | "description" | "url">> & BraveWebResult =>
      !!r.title && !!r.description && !!r.url
    )
    .map((r) => ({
      title: r.title,
      description: r.description,
      url: r.url,
    }));
}

export async function researchTopic(topic: string): Promise<string> {
  const queries = generateSearchQueries(topic);

  console.log(`Researching topic with ${queries.length} searches: ${queries.join(" | ")}`);

  const allResults: BraveSearchResult[] = [];
  for (const query of queries) {
    const results = await searchBrave(query, 5);
    allResults.push(...results);
  }

  if (allResults.length === 0) {
    return "";
  }

  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    const key = r.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summaries = unique
    .slice(0, 15)
    .map((r) => `- ${r.title}: ${r.description}`)
    .join("\n");

  return `RESEARCH FINDINGS (from web search — use these facts for accuracy):
${summaries}`;
}

function generateSearchQueries(topic: string): string[] {
  const clean = topic.trim();

  if (clean.length < 30) {
    return [
      clean,
      `${clean} key facts and history`,
    ];
  }

  const mainTopic = clean.substring(0, 80);
  return [
    mainTopic,
    `${mainTopic} key facts timeline`,
  ];
}
