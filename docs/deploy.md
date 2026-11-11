# Deploying the API (Cloud Run)

The API image is the root `Dockerfile`. Cloud Run builds and deploys it through the GitHub connection set up in the Cloud Run console (continuous deployment), so there is no pipeline file in this repo. The gate before a new revision takes traffic is a **startup probe** set on the service.

## The startup probe

Set it on the service, not in the repo (Cloud Run console: the service, **Containers** tab, **Health checks**, **Add health check**, type **Startup check**, probe type **HTTP**; then **View diff & redeploy**). Docs: https://docs.cloud.google.com/run/docs/configuring/healthchecks.

| Setting | Value | Why |
|---|---|---|
| Path | `/api/health` | All routes are under the `/api` prefix. The route asks the app database (Prisma) and the queue database (`QUEUE_DATABASE_URL`, falling back to `DATABASE_URL`) and answers 500 if either fails. |
| Port | the container port the service uses (Cloud Run's `PORT`, 8080 unless changed) | The API listens on `PORT`. |
| Initial delay | 0 s | |
| Period | 10 s | |
| Timeout | 5 s | The docs: cannot exceed the period. |
| Failure threshold | 12 | Gives the container 120 s (threshold x period) to boot and let BullMQ create its schema on a first run. The docs cap that window at 600 s. |

The same, from the command line (the form on the docs page is for `gcloud run deploy`; `services update` is not documented there):

```bash
gcloud run deploy SERVICE --image=IMAGE_URL --startup-probe httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=10,timeoutSeconds=5,failureThreshold=12
```

A response of 2xx or 3xx counts as success; anything else, or no answer within the timeout, is a failure. If the probe has not succeeded after threshold x period, Cloud Run shuts the container down.

## What this does and does not prove

- It proves the container boots, can reach both databases with the environment the service actually has, and serves a request. A mistyped `DATABASE_URL` or `QUEUE_DATABASE_URL` in production fails here.
- **Not verified:** the Cloud Run page does not say what happens to traffic when a new revision fails its startup probe, in particular that the previous revision keeps serving. Confirm it once on a deliberately broken deploy (for example a wrong `QUEUE_DATABASE_URL` on a throwaway revision) before relying on it.
- It does not check that features work: sign-in, Google OAuth, mail and storage are not exercised.
- The Layer 3 embedder is not checked; with it down, scoring ends as "not scored" without breaking the API.
