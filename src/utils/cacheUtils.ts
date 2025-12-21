import superjson from "superjson";
import { type InfiniteData } from "@tanstack/react-query";
import { type RouterOutputs } from "~/utils/api";

export const TASKS_CACHE_KEY_PREFIX = "tasks_page_data_cache";
export const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

type VideoGetAllOutput = RouterOutputs["video"]["getAll"];

export interface CachedData {
  timestamp: number;
  data: InfiniteData<VideoGetAllOutput>;
}

const getCacheKey = (userId?: string) => {
  if (!userId) return TASKS_CACHE_KEY_PREFIX;
  return `${TASKS_CACHE_KEY_PREFIX}_${userId}`;
};

export const getTasksCache = (userId?: string): CachedData | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const key = getCacheKey(userId);
    const cachedString = localStorage.getItem(key);
    if (!cachedString) return undefined;

    const cached = superjson.parse<CachedData>(cachedString);

    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached;
    }
  } catch (e) {
    console.error("Failed to load cached data", e);
  }
  return undefined;
};

export const setTasksCache = (
  data: InfiniteData<VideoGetAllOutput>,
  timestamp = Date.now(),
  userId?: string
) => {
  if (typeof window === "undefined") return;
  try {
    const key = getCacheKey(userId);
    const cacheData: CachedData = {
      timestamp,
      data,
    };
    localStorage.setItem(key, superjson.stringify(cacheData));
  } catch (e) {
    console.error("Failed to save cached data", e);
  }
};

export const invalidateTasksCache = (userId?: string) => {
  if (typeof window === "undefined") return;
  const key = getCacheKey(userId);
  localStorage.removeItem(key);
  
  // Also clear legacy cache if it exists
  if (userId) {
    localStorage.removeItem(TASKS_CACHE_KEY_PREFIX);
  }
};

export const updateTaskInCache = (
  videoId: string,
  updates: Partial<VideoGetAllOutput["items"][0]>,
  userId?: string
) => {
  const cached = getTasksCache(userId);
  if (!cached) return;

  let modified = false;
  const newPages = cached.data.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (item.id === videoId) {
        modified = true;
        return { ...item, ...updates };
      }
      return item;
    }),
  }));

  if (modified) {
    setTasksCache({ ...cached.data, pages: newPages }, cached.timestamp, userId);
  }
};

export const removeTaskFromCache = (videoId: string, userId?: string) => {
  const cached = getTasksCache(userId);
  if (!cached) return;

  const newPages = cached.data.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== videoId),
  }));

  setTasksCache({ ...cached.data, pages: newPages }, cached.timestamp, userId);
};
