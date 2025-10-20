// Serper web search integration
export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not set");
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Format search results
  const results = data.organic?.slice(0, 5).map((result: any) => ({
    title: result.title,
    link: result.link,
    snippet: result.snippet,
  })) || [];

  return JSON.stringify(results, null, 2);
}
