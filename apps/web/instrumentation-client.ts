// Runs on the client before the app hydrates (Next.js `instrumentation-client`), so `Temporal`
// exists before any @repo/shared date check can run.
// `temporal-polyfill/global` installs the polyfill only when the browser has no native `Temporal`.
import 'temporal-polyfill/global';
// apps/web is on TypeScript 5.9, which has no `esnext.temporal` lib (`packages/shared` and `apps/api`
// are on 6.0, which does), so load the polyfill's global types instead.
import 'temporal-polyfill/types/global';
