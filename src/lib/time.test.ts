import { describe, expect, it } from "vitest";
import { formatClock, formatLeft } from "./time";

describe("formatLeft", () => {
  it("words the time left in the largest whole unit", () => {
    expect(formatLeft(500)).toBe("1초");
    expect(formatLeft(30_000)).toBe("30초");
    expect(formatLeft(90_000)).toBe("1분");
    expect(formatLeft(2 * 3_600_000 + 59 * 60_000)).toBe("2시간");
    expect(formatLeft(3 * 86_400_000)).toBe("3일");
  });

  it("has nothing to say once the deadline passed, or for a bad date", () => {
    expect(formatLeft(0)).toBeNull();
    expect(formatLeft(-5000)).toBeNull();
    expect(formatLeft(Number.NaN)).toBeNull();
  });
});

describe("formatClock", () => {
  it("shows minutes and seconds, and stops at zero", () => {
    expect(formatClock(595_000)).toBe("9:55");
    expect(formatClock(5_500)).toBe("0:06");
    expect(formatClock(-1)).toBe("0:00");
  });
});
