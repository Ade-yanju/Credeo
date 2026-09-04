export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export function readingTime(content: string) {
  return `${Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 220))} min read`;
}
