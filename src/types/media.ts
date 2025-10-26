export interface MediaItem {
  id: string;
  title: string;
  category: "live" | "movie" | "series";
  stream_url: string;
  poster?: string;
  logo?: string;
  genres?: string[];
}