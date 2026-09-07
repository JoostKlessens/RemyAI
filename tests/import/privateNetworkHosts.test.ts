/**
 * The blocklist that names the machine this app runs on and the private
 * network around it — and the require cycle its move out of
 * resolveShortLinkTarget.ts was made to end.
 *
 * WHY THIS SUITE EXISTS AT ALL, given the predicate did not change. It was
 * only ever tested through its two callers: `normalizeRecipeUrl` refusing a
 * pasted `http://127.0.0.1/...` and `resolveRedirectTarget` refusing a
 * `Location` that points there. Both of those tests still stand and are not
 * touched. What neither of them pins is the property the new module exists
 * for — that those two callers ask the SAME list — and the property that is
 * easiest to lose by accident, that the arrows still point one way.
 *
 * SO THERE ARE THREE GROUPS BELOW, and only the first is about addresses:
 *
 *   1. The predicate itself, including the boundaries just outside each
 *      private range. A blocklist that is too wide is a real defect, not a
 *      safe one: `172.15.0.1` and `192.167.0.1` are ordinary public
 *      addresses, and refusing them would turn "this page is unsupported"
 *      into a lie about somebody's recipe site.
 *   2. One list, two callers — the pasted URL and the redirect hop reach
 *      the same answer, and the name re-exported from
 *      resolveShortLinkTarget.ts is the SAME function object, not a second
 *      copy that happens to agree today. That copy is what the old cycle
 *      comment said it was avoiding; this asserts it is still avoided.
 *   3. The cycle stays gone. Read from the source, because no runtime
 *      assertion can see an import graph and nothing else in this repo
 *      fails when a cycle comes back — Metro only warns. Same technique
 *      and the same reason as tests/repository/mirrorBackfill.test.ts's
 *      ordering assertion.
 */

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isBlockedRedirectHost } from '@/domain/import/privateNetworkHosts';
import {
  isBlockedRedirectHost as isBlockedRedirectHostViaShortLinkModule,
  resolveRedirectTarget,
} from '@/domain/import/resolveShortLinkTarget';
import { normalizeRecipeUrl } from '@/domain/import/urlParsing';

/**
 * Written as URL authorities rather than bare hostnames so the same list
 * can be fed to all three entry points below — `normalizeRecipeUrl` and
 * `resolveRedirectTarget` both take a URL, and an IPv6 literal only
 * survives one in brackets.
 */
const BLOCKED_AUTHORITIES = [
  'localhost',
  '127.0.0.1',
  '10.0.0.5',
  '192.168.1.10',
  '172.16.0.9',
  '169.254.169.254',
  '[::1]',
  '[fd00::1]',
  '[fe80::1]',
] as const;

describe('isBlockedRedirectHost', () => {
  test('blocks localhost and anything under it', () => {
    expect(isBlockedRedirectHost('localhost')).toBe(true);
    expect(isBlockedRedirectHost('api.localhost')).toBe(true);
    expect(isBlockedRedirectHost('LOCALHOST')).toBe(true);
  });

  test('the localhost rule is a suffix, not a substring — a host that merely contains it is public', () => {
    expect(isBlockedRedirectHost('notlocalhost.example')).toBe(false);
    expect(isBlockedRedirectHost('localhost.evil.example')).toBe(false);
  });

  test('blocks IPv6 loopback and the unspecified address, bracketed or bare', () => {
    expect(isBlockedRedirectHost('::1')).toBe(true);
    expect(isBlockedRedirectHost('[::1]')).toBe(true);
    expect(isBlockedRedirectHost('::')).toBe(true);
  });

  test('blocks IPv6 unique-local (fc00::/7) and link-local (fe80::/10)', () => {
    for (const host of ['fc00::1', 'fd00::1', 'fdab::9', 'fe80::1', 'fe80::abcd', 'feb0::1']) {
      expect(isBlockedRedirectHost(host)).toBe(true);
    }
  });

  test('blocks every IPv4 range that names this host or the network around it', () => {
    for (const host of [
      '0.0.0.0',
      '10.0.0.5',
      '10.255.255.255',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.9',
      '172.31.255.255',
      '192.168.1.10',
    ]) {
      expect(isBlockedRedirectHost(host)).toBe(true);
    }
  });

  /**
   * The half of a blocklist nobody tests and everybody should. Each of
   * these sits one step outside a blocked range, and each is a perfectly
   * ordinary public address a Dutch recipe site could be served from.
   */
  test('allows the public addresses immediately outside each blocked range', () => {
    for (const host of [
      '1.1.1.1',
      '9.255.255.255',
      '11.0.0.1',
      '126.255.255.255',
      '128.0.0.1',
      '169.253.255.255',
      '169.255.0.1',
      '172.15.255.255',
      '172.32.0.1',
      '192.167.255.255',
      '192.169.0.1',
    ]) {
      expect(isBlockedRedirectHost(host)).toBe(false);
    }
  });

  test('refuses a dotted quad with an impossible octet rather than guessing what a resolver would make of it', () => {
    expect(isBlockedRedirectHost('999.1.1.1')).toBe(true);
    expect(isBlockedRedirectHost('256.256.256.256')).toBe(true);
  });

  test('allows an ordinary hostname, whatever its case', () => {
    expect(isBlockedRedirectHost('voorbeeldkeuken.nl')).toBe(false);
    expect(isBlockedRedirectHost('Voorbeeldkeuken.NL')).toBe(false);
    expect(isBlockedRedirectHost('www.tiktok.com')).toBe(false);
  });
});

describe('one list, two callers', () => {
  /**
   * The assertion the old import cycle was accepted to buy: a second copy
   * of this list would be free to drift, "and the weaker copy is always
   * the one that ends up being called". Identity, not agreement — two
   * functions that agree on nine addresses today prove nothing about the
   * tenth.
   */
  test('resolveShortLinkTarget.ts re-exports this exact function, never a second copy', () => {
    expect(isBlockedRedirectHostViaShortLinkModule).toBe(isBlockedRedirectHost);
  });

  test('a pasted URL on a blocked host is unsupported, every one of them', () => {
    for (const authority of BLOCKED_AUTHORITIES) {
      expect(normalizeRecipeUrl(`http://${authority}/recept`)).toEqual({ kind: 'unsupported_url' });
    }
  });

  test('a redirect hop onto a blocked host resolves to nothing, every one of them', () => {
    for (const authority of BLOCKED_AUTHORITIES) {
      expect(resolveRedirectTarget('https://vm.tiktok.com/ZMabcdef1/', `http://${authority}/recept`)).toBeNull();
    }
  });

  /**
   * Stated as its own test because it is the actual risk: a host refused
   * on the paste screen must not become reachable by arriving as a
   * redirect instead, or the pure gate is theatre.
   */
  test('neither route is a way around the other', () => {
    for (const authority of BLOCKED_AUTHORITIES) {
      const url = `http://${authority}/recept`;
      expect(normalizeRecipeUrl(url).kind).toBe('unsupported_url');
      expect(resolveRedirectTarget('https://vm.tiktok.com/ZMabcdef1/', url)).toBeNull();
    }
  });
});

/**
 * No runtime assertion can observe a require cycle: Metro warns, nothing
 * throws, and every test in this repo goes on passing. So these two read
 * the source, the way mirrorBackfill.test.ts reads createRepository.ts to
 * prove an ordering nothing else can see.
 */
describe('the cycle stays gone', () => {
  const sourceOf = (relativePath: string): string =>
    readFileSync(path.resolve(__dirname, '../../src/domain/import/', relativePath), 'utf8');

  test('urlParsing.ts does not import resolveShortLinkTarget.ts — that edge is the cycle', () => {
    const source = sourceOf('urlParsing.ts');
    expect(source).toContain("from './privateNetworkHosts.ts'");
    expect(source).not.toMatch(/^import[^\n]*from '\.\/resolveShortLinkTarget/m);
  });

  test('privateNetworkHosts.ts stays a leaf — a module with no imports cannot be half of a cycle', () => {
    expect(sourceOf('privateNetworkHosts.ts')).not.toMatch(/^\s*(?:import|export)[^\n]*from '/m);
  });
});
