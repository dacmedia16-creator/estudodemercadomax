import type { StudyResult } from "./study-types";

const KEY = "rip:studies";

function read(): StudyResult[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(list: StudyResult[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const studyStore = {
  all: () => read(),
  get: (id: string) => read().find((s) => s.id === id),
  save: (s: StudyResult) => {
    const list = read().filter((x) => x.id !== s.id);
    list.unshift(s);
    write(list);
  },
  remove: (id: string) => write(read().filter((s) => s.id !== id)),
};