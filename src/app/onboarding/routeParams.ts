/**
 * expo-router search params are strings (or arrays of strings for repeated
 * keys), never structured data. PD-006's onboarding flow needs to pass a
 * small string array — seeded meal titles, then a household's allergen
 * tags — from one onboarding screen to the next (Rotation Seeding ->
 * Household setup -> the allergen-check screen). This is the one shared
 * encode/decode convention for that, kept out of the screens themselves so
 * it isn't duplicated three times.
 */

export function encodeStringArrayParam(values: readonly string[]): string {
  return JSON.stringify(values);
}

/** Never throws: malformed or missing input decodes to an empty array rather than crashing a screen mid-onboarding. */
export function parseStringArrayParam(raw: string | undefined): readonly string[] {
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}
