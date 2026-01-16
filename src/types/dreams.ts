export type DreamVisibility = "private" | "unlisted" | "public";

export type Dream = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  dream_date: string;
  visibility: DreamVisibility;
  image_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
};


