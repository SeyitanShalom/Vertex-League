import { afterEach, describe, expect, it, vi } from "vitest";
import { createDraftAutosave, type DraftSaveStatus } from "@/lib/registration/draft-autosave";

afterEach(() => vi.useRealTimers());

describe("registration draft autosave", () => {
  it("saves the latest value after typing pauses", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => true);
    const statuses: DraftSaveStatus[] = [];
    const autosave = createDraftAutosave(save, (status) => statuses.push(status), 1000);

    autosave.schedule({ team: "First" });
    await vi.advanceTimersByTimeAsync(500);
    autosave.schedule({ team: "Final" });
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledExactlyOnceWith({ team: "Final" });
    expect(statuses.at(-1)).toBe("saved");
  });

  it("flushes on blur and serializes writes so an old value cannot win", async () => {
    let finishFirst!: (saved: boolean) => void;
    const first = new Promise<boolean>((resolve) => {
      finishFirst = resolve;
    });
    const save = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(true);
    const statuses: DraftSaveStatus[] = [];
    const autosave = createDraftAutosave(save, (status) => statuses.push(status));

    const firstFlush = autosave.flush({ team: "Old" });
    await Promise.resolve();
    const finalFlush = autosave.flush({ team: "New" });
    expect(save).toHaveBeenCalledTimes(1);
    finishFirst(true);
    await Promise.all([firstFlush, finalFlush]);

    expect(save.mock.calls.map(([value]) => value)).toEqual([{ team: "Old" }, { team: "New" }]);
    expect(statuses.at(-1)).toBe("saved");
  });

  it("reports a failed save and retries the same value", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const statuses: DraftSaveStatus[] = [];
    const autosave = createDraftAutosave(save, (status) => statuses.push(status));

    await autosave.flush({ team: "United" });
    expect(statuses.at(-1)).toBe("error");
    await autosave.flush({ team: "United" });
    expect(save).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe("saved");
    await autosave.flush({ team: "United" });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending draft after successful registration", async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => true);
    const autosave = createDraftAutosave(save, () => {});

    autosave.schedule({ team: "Registered" });
    autosave.stop();
    await vi.advanceTimersByTimeAsync(2000);
    await autosave.flush({ team: "Registered" });
    expect(save).not.toHaveBeenCalled();
  });
});
