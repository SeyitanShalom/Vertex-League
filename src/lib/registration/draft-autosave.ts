export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

export function createDraftAutosave<T>(
  save: (value: T) => Promise<boolean>,
  onStatus: (status: DraftSaveStatus) => void,
  delay = 1500,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = Promise.resolve();
  let lastSaved: string | undefined;
  let latest: string | undefined;
  let stopped = false;

  function enqueue(value: T, snapshot: string) {
    latest = snapshot;
    onStatus("saving");
    pending = pending.then(async () => {
      if (stopped) return;
      if (snapshot === lastSaved) {
        if (snapshot === latest) onStatus("saved");
        return;
      }
      try {
        if (!(await save(value))) throw new Error("Draft save failed");
        lastSaved = snapshot;
        if (!stopped && snapshot === latest) onStatus("saved");
      } catch {
        if (!stopped && snapshot === latest) onStatus("error");
      }
    });
    return pending;
  }

  return {
    schedule(value: T) {
      if (stopped) return;
      clearTimeout(timer);
      const snapshot = JSON.stringify(value);
      latest = snapshot;
      onStatus("saving");
      timer = setTimeout(() => {
        timer = undefined;
        void enqueue(value, snapshot);
      }, delay);
    },
    flush(value: T) {
      clearTimeout(timer);
      timer = undefined;
      return stopped ? pending : enqueue(value, JSON.stringify(value));
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
