/**
 * Local-id generation for rows created on-device before the Supabase swap.
 *
 * Deliberately NOT `crypto.randomUUID()`: Hermes (React Native's JS engine)
 * does not ship it without an extra polyfill dependency, and pulling one in
 * just for locally-scoped, soon-to-be-replaced ids is not worth it. These
 * ids never need to look like a Postgres uuid — every `*Id` type in
 * src/domain/types.ts is a plain `string` alias precisely so callers never
 * assume a particular id shape (see that file's header). Once a meal/save/
 * etc. is written to the real backend, its id becomes a server-generated
 * uuid and this generator is irrelevant to it.
 */

let counter = 0;

export function generateLocalId(prefix: string): string {
  counter += 1;
  const timePart = Date.now().toString(36);
  const counterPart = counter.toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timePart}-${counterPart}-${randomPart}`;
}
