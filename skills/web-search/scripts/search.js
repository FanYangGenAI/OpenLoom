#!/usr/bin/env node
/**
 * web-search skill script
 * Uses DuckDuckGo Instant Answer API — no API key required.
 *
 * Usage: node search.js "<query>" [--num=N]
 * Output: JSON to stdout
 */

const query = process.argv.slice(2).find((a) => !a.startsWith('--'));
const numArg = process.argv.find((a) => a.startsWith('--num='));
const num = numArg ? parseInt(numArg.split('=')[1], 10) : 3;

if (!query) {
  console.error(JSON.stringify({ error: 'Usage: node search.js "<query>" [--num=N]' }));
  process.exit(1);
}

const url =
  `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

fetch(url)
  .then((r) => r.json())
  .then((data) => {
    const results = (data.RelatedTopics ?? [])
      .filter((t) => t.Text && t.FirstURL)
      .slice(0, num)
      .map((t) => ({
        title: t.Text.split(' - ')[0] ?? t.Text,
        snippet: t.Text,
      }));

    const output = {
      query,
      abstract: data.AbstractText || null,
      abstract_url: data.AbstractURL || null,
      results,
    };

    console.log(JSON.stringify(output, null, 2));
  })
  .catch((err) => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
