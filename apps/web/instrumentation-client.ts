// Runs on the client before the app hydrates (Next.js `instrumentation-client`), so `Temporal`
// exists before any @repo/shared date check can run.
// `temporal-polyfill/global` installs the polyfill only when the browser has no native `Temporal`.
import 'temporal-polyfill/global';
// TypeScript 5.9 has no `esnext.temporal` lib, so load the polyfill's global types instead.
import 'temporal-polyfill/types/global';
