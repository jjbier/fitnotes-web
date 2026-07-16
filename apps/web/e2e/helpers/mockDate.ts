import type { Page } from "@playwright/test";

/**
 * Fija `Date`/`Date.now()` en el navegador a un instante concreto, para que
 * las páginas que calculan "hoy" con `new Date()` (dashboard, tools,
 * progress) operen sobre un día aislado del resto de la cuenta de test
 * compartida — evita que un test que finaliza "el entrenamiento de hoy"
 * rompa otros specs que asumen que hoy empieza sin entrenamiento.
 */
export async function mockFixedToday(page: Page, isoDateTime: string): Promise<void> {
  await page.addInitScript((fixedIso) => {
    const FIXED_NOW = new Date(fixedIso).getTime();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(FIXED_NOW);
        } else {
          super(...(args as []));
        }
      }
      static override now(): number {
        return FIXED_NOW;
      }
    }
    // @ts-expect-error — sustitución global de Date, solo para tests
    window.Date = FakeDate;
  }, isoDateTime);
}
