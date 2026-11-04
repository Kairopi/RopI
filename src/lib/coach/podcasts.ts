/**
 * Podcast picks from the Apple Podcasts public search API (itunes.apple.com,
 * no key, CORS *; checked 2026-11-04). Returns shows plus their latest episode
 * with a playable audio URL, so Ropi can play it right there.
 */

export interface PodcastPick {
  show: string;
  author: string;
  showUrl: string;
  artwork?: string;
  episode?: { title: string; released: string; minutes: number; audioUrl?: string; url: string };
}

export async function findPodcasts(topic: string, count = 3): Promise<PodcastPick[]> {
  const search = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(topic)}&media=podcast&entity=podcast&limit=8`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!search.ok) throw new Error('Podcast search is unavailable right now');
  const shows: any[] = (await search.json()).results ?? [];

  const picks = await Promise.all(
    shows.slice(0, 6).map(async (s): Promise<PodcastPick> => {
      const base: PodcastPick = { show: s.collectionName, author: s.artistName, showUrl: s.collectionViewUrl, artwork: s.artworkUrl100 };
      try {
        const r = await fetch(`https://itunes.apple.com/lookup?id=${s.collectionId}&media=podcast&entity=podcastEpisode&limit=1`, { signal: AbortSignal.timeout(10000) });
        const ep = ((await r.json()).results ?? []).find((x: any) => x.wrapperType === 'podcastEpisode');
        if (ep)
          base.episode = {
            title: ep.trackName,
            released: ep.releaseDate,
            minutes: Math.round((ep.trackTimeMillis ?? 0) / 60000),
            audioUrl: ep.episodeUrl,
            url: ep.trackViewUrl ?? s.collectionViewUrl,
          };
      } catch {
        // show without its latest episode is still a pick
      }
      return base;
    })
  );
  // Prefer shows that are still publishing (latest episode in the last 6 months)
  const fresh = (p: PodcastPick) => (p.episode ? Date.now() - new Date(p.episode.released).getTime() < 183 * 86_400_000 : false);
  return [...picks.filter(fresh), ...picks.filter((p) => !fresh(p))].slice(0, count);
}
