import superjson from "superjson";
import { type InfiniteData } from "@tanstack/react-query";
import { type RouterOutputs } from "~/utils/api";

export const TASKS_CACHE_KEY = "tasks_page_data_cache";
export const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

type VideoGetAllOutput = RouterOutputs["video"]["getAll"];

export interface CachedData {
  timestamp: number;
  data: InfiniteData<VideoGetAllOutput>;
}

export const getTasksCache = (): CachedData | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const cachedString = localStorage.getItem(TASKS_CACHE_KEY);
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

export const setTasksCache = (data: InfiniteData<VideoGetAllOutput>, timestamp = Date.now()) => {
  if (typeof window === "undefined") return;
  try {
    const cacheData: CachedData = {
      timestamp,
      data,
    };
    localStorage.setItem(TASKS_CACHE_KEY, superjson.stringify(cacheData));
  } catch (e) {
    console.error("Failed to save cached data", e);
  }
};

export const invalidateTasksCache = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TASKS_CACHE_KEY);
};

export const updateTaskInCache = (
  videoId: string,
  updates: Partial<VideoGetAllOutput["items"][0]>
) => {
  const cached = getTasksCache();
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
    setTasksCache({ ...cached.data, pages: newPages }, cached.timestamp);
  }
};

export const removeTaskFromCache = (videoId: string) => {
  const cached = getTasksCache();
  if (!cached) return;

  const newPages = cached.data.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.id !== videoId),
  }));

  setTasksCache({ ...cached.data, pages: newPages }, cached.timestamp);
};
