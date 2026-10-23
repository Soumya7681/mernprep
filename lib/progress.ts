import { useSyncExternalStore } from "react";

// Client-side study progress, persisted in localStorage and exposed as external
// stores. Shared by the DSA checklist, the roadmap maps, and the dashboards, so
// a tick in one view is reflected in the others (and across browser tabs).

export const DSA_KEY = "dsa-progress-v1";
export const ROADMAP_KEY = "roadmap-progress-v1";

/**
 * One persisted Set per storage key. Two shapes are in use: numeric ids for DSA
 * questions and string ids for roadmap nodes, so the factory is generic over
 * the id type and takes the parser that validates what came out of storage.
 */
function createProgressStore<T>(key: string, isValidId: (v: unknown) => v is T) {
  const EMPTY: ReadonlySet<T> = new Set<T>();
  const listeners = new Set<() => void>();
  let cache: Set<T> | null = null;

  function readStorage(): Set<T> {
    if (typeof window === "undefined") return new Set<T>();
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return new Set<T>();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set<T>(arr.filter(isValidId)) : new Set<T>();
    } catch {
      return new Set<T>();
    }
  }

  function emit() {
    for (const l of listeners) l();
  }

  function handleStorage(e: StorageEvent) {
    if (e.key === key) {
      cache = null; // invalidate; next getSnapshot re-reads
      emit();
    }
  }

  function subscribe(cb: () => void): () => void {
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
      if (listeners.size === 0 && typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }

  // Must return a stable reference between renders unless the data changed,
  // otherwise useSyncExternalStore loops. `cache` is only replaced on mutation.
  function getSnapshot(): ReadonlySet<T> {
    if (cache === null) cache = readStorage();
    return cache;
  }

  function getServerSnapshot(): ReadonlySet<T> {
    return EMPTY;
  }

  function persist(next: Set<T>) {
    cache = next;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        /* storage full or unavailable — fail silently */
      }
    }
    emit();
  }

  return {
    toggle(id: T) {
      const next = new Set(getSnapshot());
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
    },
    /** Mark every given id done, or clear them all if they already are. */
    setMany(ids: readonly T[], done: boolean) {
      const next = new Set(getSnapshot());
      for (const id of ids) {
        if (done) next.add(id);
        else next.delete(id);
      }
      persist(next);
    },
    clear() {
      persist(new Set<T>());
    },
    use(): ReadonlySet<T> {
      return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    },
  };
}

const isNumberId = (v: unknown): v is number => typeof v === "number";
const isStringId = (v: unknown): v is string => typeof v === "string";

const dsaStore = createProgressStore<number>(DSA_KEY, isNumberId);
const roadmapStore = createProgressStore<string>(ROADMAP_KEY, isStringId);

export function toggleDsa(id: number) {
  dsaStore.toggle(id);
}

export function clearDsa() {
  dsaStore.clear();
}

/** Subscribe a component to the persisted DSA progress set. */
export function useDsaProgress(): ReadonlySet<number> {
  return dsaStore.use();
}

export function toggleRoadmapNode(id: string) {
  roadmapStore.toggle(id);
}

/** Bulk tick or untick a stage's nodes. */
export function setRoadmapNodes(ids: readonly string[], done: boolean) {
  roadmapStore.setMany(ids, done);
}

export function clearRoadmapProgress() {
  roadmapStore.clear();
}

/** Subscribe a component to the persisted roadmap node progress set. */
export function useRoadmapProgress(): ReadonlySet<string> {
  return roadmapStore.use();
}
