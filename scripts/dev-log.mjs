/**
 * `expo start`, with everything it prints also written to a file.
 *
 * ============================================================================
 * WHY THIS EXISTS, AND WHY IT IS NOT AN MCP
 * ============================================================================
 *
 * The owner asked on 9 September 2026: "are we using xcode mcp? I think it
 * would help a lot with looking at logs for the ios app."
 *
 * IT CANNOT BE ONE. Every Xcode MCP server is a wrapper around `xcrun
 * simctl`, `xcodebuild` and macOS `log stream`; this project is developed on
 * Windows (measured: no `xcrun` on PATH), so such a server would fail on
 * every call. And it would be the wrong instrument even on a Mac: this app
 * has no development build and no EAS pipeline (OPS-02), so there is no
 * `.app` for a simulator to run. The iPhone runs Expo Go over wifi, and Expo
 * Go's logs are JAVASCRIPT logs arriving over the Metro connection — not
 * device syslog.
 *
 * THE LOGS THAT MATTER ALREADY REACH THE TERMINAL, and this repo's own
 * history proves it: OPS-10 was found from nine "Route … is missing the
 * required default export" lines at startup, OPS-11 from a require-cycle
 * warning, and OPS-12 from an `expo-notifications` throw. All three came out
 * of `expo start`'s output. The gap was never the log; it was that the log
 * lived in a terminal the assistant could not read.
 *
 * SO THIS SCRIPT CLOSES THAT ONE GAP AND NOTHING ELSE. It runs the same
 * `expo start` and tees stdout and stderr to `dev-server.log` in the repo
 * root, so whoever starts the server, the output sits at a path anybody — or
 * any assistant — can read afterwards. `*.log` is already gitignored, which
 * matters here: Expo prints the LAN URL for the dev server.
 *
 * ⚠ WHAT IT STILL DOES NOT GIVE YOU: native crash reports. If the app dies
 * below the JS layer, Metro sees nothing and neither will this file. That
 * genuinely needs macOS + Xcode, or `libimobiledevice`'s `idevicesyslog` on
 * Windows with Apple's device drivers — a whole-device syslog, noisy, and
 * outside what this script pretends to do.
 *
 * IT PROXIES STDIN, so Expo's interactive keys (r to reload, j for the
 * debugger, m for the menu) keep working exactly as they do today. A logger
 * that cost you the dev menu would not be worth the file.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';

const LOG_PATH = join(process.cwd(), 'dev-server.log');

// Truncated per run, not appended. A log spanning sessions makes "did this
// warning appear on THIS start" unanswerable, which is the exact question
// every finding named above was an answer to.
const logFile = createWriteStream(LOG_PATH, { flags: 'w' });

const header = `--- expo start ${new Date().toISOString()} ---\n`;
logFile.write(header);
process.stdout.write(header);

// `shell: true` is what makes this work on Windows, where the npx entry is a
// .cmd shim. Extra arguments are forwarded, so `npm run start:log -- --web`
// behaves like `expo start --web`.
const child = spawn('npx expo start', process.argv.slice(2), {
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    process.stdout.write(chunk);
    logFile.write(chunk);
  });
}

child.on('exit', (code, signal) => {
  const footer = `--- exit code=${code} signal=${signal ?? 'none'} ---\n`;
  logFile.write(footer, () => logFile.end());
  process.stdout.write(footer);
  process.exit(code ?? 0);
});
