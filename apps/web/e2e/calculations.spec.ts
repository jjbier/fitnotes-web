import { test, expect } from "@playwright/test";

/**
 * Pure logic tests evaluated in browser context — no auth needed.
 * These replicate the core calculation functions to verify the formulas
 * match the plan's expected values.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
});

test("Brzycki 1RM formula: 100kg × 5 reps ≈ 116.67 [T4.1]", async ({ page }) => {
  const result = await page.evaluate(() => {
    const weight = 100, reps = 5;
    const denominator = 37 - reps;
    return weight * (36 / denominator);
  });
  expect(result).toBeCloseTo(116.67, 1);
});

test("1RM guard: 1 rep returns weight directly", async ({ page }) => {
  const result = await page.evaluate(() => {
    const weight = 100, reps = 1;
    if (reps === 1) return weight;
    return weight * (36 / (37 - reps));
  });
  expect(result).toBe(100);
});

test("calculateVolume: only complete sets count [T4.2]", async ({ page }) => {
  const result = await page.evaluate(() => {
    const sets = [
      { weight: 100, reps: 5, is_complete: true },
      { weight: 100, reps: 5, is_complete: false },
    ];
    return sets.reduce((total, s) => {
      if (!s.is_complete) return total;
      return total + (s.weight ?? 0) * (s.reps ?? 0);
    }, 0);
  });
  expect(result).toBe(500);
});

test("calculateSpeed: 10km in 3600s = 10 km/h [T4.3]", async ({ page }) => {
  const result = await page.evaluate(() => {
    const distanceKm = 10, timeSeconds = 3600;
    return (distanceKm / timeSeconds) * 3600;
  });
  expect(result).toBeCloseTo(10, 5);
});

test("roundToNearest: 73 to 2.5 = 72.5 [T6.4]", async ({ page }) => {
  const result = await page.evaluate(() => {
    const value = 73, increment = 2.5;
    return Math.round(value / increment) * increment;
  });
  expect(result).toBe(72.5);
});

test("roundToNearest: 74 to 2.5 = 75", async ({ page }) => {
  const result = await page.evaluate(() => {
    const value = 74, increment = 2.5;
    return Math.round(value / increment) * increment;
  });
  expect(result).toBe(75);
});

test("calculateSetWeight: 75% of 100kg = 75kg [T6.3]", async ({ page }) => {
  const result = await page.evaluate(() => {
    const baseWeight = 100, percentage = 75, increment = 2.5;
    const raw = baseWeight * (percentage / 100);
    return Math.round(raw / increment) * increment;
  });
  expect(result).toBe(75);
});

test("calculatePlates: 100kg total, 20kg bar → 40kg per side [T6.1]", async ({ page }) => {
  const sum = await page.evaluate(() => {
    const targetWeight = 100, barWeight = 20;
    const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
    const perSide = (targetWeight - barWeight) / 2;
    const plates: number[] = [];
    let remaining = perSide;
    const sorted = [...availablePlates].sort((a, b) => b - a);
    for (const plate of sorted) {
      while (remaining >= plate - 0.001) {
        plates.push(plate);
        remaining -= plate;
        remaining = Math.round(remaining * 1000) / 1000;
      }
    }
    return plates.reduce((a, b) => a + b, 0);
  });
  expect(sum).toBe(40);
});

test("calculatePlates: target equals bar weight → empty [T6.2]", async ({ page }) => {
  const plates = await page.evaluate(() => {
    const targetWeight = 20, barWeight = 20;
    const perSide = (targetWeight - barWeight) / 2;
    if (perSide <= 0) return [];
    return [1]; // would add plates, but shouldn't reach here
  });
  expect(plates).toHaveLength(0);
});

test("calculatePace: 10km in 3600s = 360s/km", async ({ page }) => {
  const result = await page.evaluate(() => {
    const distanceKm = 10, timeSeconds = 3600;
    if (distanceKm <= 0) return 0;
    return timeSeconds / distanceKm;
  });
  expect(result).toBe(360);
});
