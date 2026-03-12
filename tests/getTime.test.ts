/**
 * Unit Tests for getTime.ts
 *
 * KEY CONCEPTS:
 *
 * - `vi.useFakeTimers()` / `vi.useRealTimers()` — MOCKING time
 *   The getTime function depends on `new Date()` (the current time).
 *   Without fake timers, tests would give different results depending
 *   on when you run them. Fake timers let us freeze "now" to a fixed point.
 *
 * - `beforeEach` / `afterEach` — Setup/teardown hooks
 *   Code that runs before/after EACH test. Used here to install/remove
 *   fake timers so each test starts fresh.
 *
 * - Testing BOUNDARY CONDITIONS: "just now" vs "1 min ago" vs "2 mins ago"
 *   These tests check the exact boundaries where output changes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTime } from "../src/utils/getTime";

describe("getTime", () => {
  // Freeze "now" to a known date so tests are deterministic
  const NOW = new Date("2026-03-12T12:00:00Z");

  beforeEach(() => {
    // Install fake timers — Date.now() and new Date() will return our fixed time
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    // Always restore real timers so other tests aren't affected
    vi.useRealTimers();
  });

  // Helper: create a Date that is `secondsAgo` seconds before NOW
  const timeAgo = (secondsAgo: number) =>
    new Date(NOW.getTime() - secondsAgo * 1000);

  // ----- "Just now" (< 60 seconds) -----

  it('should return "Created just now" for timestamps less than 60 seconds ago', () => {
    expect(getTime(timeAgo(0))).toBe("Created just now");
    expect(getTime(timeAgo(30))).toBe("Created just now");
    expect(getTime(timeAgo(59))).toBe("Created just now");
  });

  // ----- Minutes -----

  it('should return "1 min ago" for 60-119 seconds ago', () => {
    expect(getTime(timeAgo(60))).toBe("1 min ago");
    expect(getTime(timeAgo(90))).toBe("1 min ago");
    expect(getTime(timeAgo(119))).toBe("1 min ago");
  });

  it('should return "X mins ago" for 2-59 minutes ago', () => {
    expect(getTime(timeAgo(120))).toBe("2 mins ago");
    expect(getTime(timeAgo(300))).toBe("5 mins ago");
    expect(getTime(timeAgo(59 * 60))).toBe("59 mins ago");
  });

  // ----- Hours -----

  it('should return "1 hour ago" for 1 hour ago', () => {
    expect(getTime(timeAgo(3600))).toBe("1 hour ago");
    expect(getTime(timeAgo(3600 + 1800))).toBe("1 hour ago"); // 1.5 hours rounds down
  });

  it('should return "X hours ago" for 2-23 hours ago', () => {
    expect(getTime(timeAgo(2 * 3600))).toBe("2 hours ago");
    expect(getTime(timeAgo(12 * 3600))).toBe("12 hours ago");
    expect(getTime(timeAgo(23 * 3600))).toBe("23 hours ago");
  });

  // ----- Days -----

  it('should return "Created yesterday" for 24-47 hours ago', () => {
    expect(getTime(timeAgo(24 * 3600))).toBe("Created yesterday");
    expect(getTime(timeAgo(36 * 3600))).toBe("Created yesterday");
  });

  it('should return "X days ago" for 2-6 days ago', () => {
    expect(getTime(timeAgo(2 * 24 * 3600))).toBe("2 days ago");
    expect(getTime(timeAgo(6 * 24 * 3600))).toBe("6 days ago");
  });

  // ----- Formatted date (7+ days ago) -----

  it("should return formatted date for 7+ days ago", () => {
    // 10 days before March 12, 2026 12:00 UTC = March 2, 2026 12:00 UTC
    const result = getTime(timeAgo(10 * 24 * 3600));

    // Should contain month abbreviation and year
    expect(result).toContain("Mar");
    expect(result).toContain("2026");
    expect(result).toContain("at");
  });

  it("should zero-pad hours and minutes in formatted dates", () => {
    // Create a date at 09:05 — both need zero-padding
    const date = new Date("2025-01-15T09:05:00Z");
    const result = getTime(date);

    // The exact output depends on timezone, but we can check the format
    expect(result).toMatch(/at \d{2}:\d{2}$/); // "at HH:MM"
  });
});
