# Deployment

Deploys this app to a VPS over SSH, triggered manually from GitHub
Actions (`.github/workflows/deploy.yml`) — not from this session, and not
from any local machine: GitHub's runners do the actual work, so this
works regardless of what any one person's network allows.

## Why this shape

- The app is a FastAPI backend + a static React build served by nginx —
  Docker Compose (`docker-compose.yml`) runs both as containers on the
  target server.
- `.env` is written **on the server** by the deploy script, from GitHub
  Secrets/Variables — it is never committed, never stored in this repo,
  and never passed through this chat.
- The workflow is `workflow_dispatch`-only (a manual button in the Actions
  tab) rather than auto-deploy-on-push, since the project is still under
  active development. Switch it to `push: { branches: [main] }` once
  things stabilize — see the comment at the top of the workflow file.

## One-time server setup

On the target VM (Ubuntu/Debian assumed below — adjust for your distro):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# log out and back in for the group change to take effect
```

That's it — the deploy workflow handles cloning the repo and starting the
containers. Make sure these are open in the VM's firewall/security group:

- **Port 8080** (default — set by `WEB_PORT`) — the frontend (nginx). The
  frontend container binds to a host port other than 80 by default so it
  doesn't collide with an existing web server/reverse proxy already using
  80 on the VM. Set the `WEB_PORT` GitHub Variable to `80` if you've
  confirmed nothing else is bound to it (`sudo ss -tlnp | grep ':80 '` on
  the server).
- **Port 8000** — the backend API (the frontend calls it directly by
  absolute URL from the browser, not proxied through nginx — see
  `apps/web/src/lib/apiClient.ts`)
- **Port 22** — SSH, for the deploy itself (restrict to GitHub Actions'
  IP ranges if you want to tighten this; they're published at
  https://api.github.com/meta under `actions`)

## GitHub repository configuration

**Settings → Secrets and variables → Actions.** Add these directly in the
GitHub UI — never paste them into a chat or commit them to the repo.

### Secrets (sensitive)

| Name | Value |
| --- | --- |
| `SSH_HOST` | The VM's public IP or hostname |
| `SSH_USER` | SSH username |
| `SSH_PRIVATE_KEY` | The **private** key matching a public key already in the VM's `~/.ssh/authorized_keys`. Leave unset if using password auth. |
| `SSH_PASSWORD` | Root/user password, if not using key auth. The workflow passes both `key` and `password` to `appleboy/ssh-action`; it uses whichever is actually set. |
| `SSH_PORT` | Only if not 22 |
| `OPENROUTER_API_KEY` | From https://openrouter.ai/keys |

### Variables (not sensitive — config)

| Name | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://203.0.113.10:8000` | The VM's public address, port 8000. Baked into the frontend at **build** time — changing it requires a redeploy. |
| `FRONTEND_ORIGIN` | `http://203.0.113.10` | Must match where the frontend is actually served, or CORS blocks every API call — see `app/main.py`. |
| `AI_PROVIDER` | `openrouter` | `mock` (default) / `bedrock` / `openrouter` |
| `OPENROUTER_MODEL` | `anthropic/claude-3.5-haiku` | Any model slug OpenRouter serves |
| `ENABLE_POLYMARKET` | `true` | Off by default |
| `ENABLE_NEWS` | `false` | Not implemented yet — leave false |
| `API_PORT` | `8000` | Only if you need a non-default port |
| `WEB_PORT` | `8080` | Host port the frontend container binds to. Defaults to 8080 to avoid colliding with an existing service on port 80 — set to `80` once you've confirmed it's free. |
| `API_PUBLISH` | `127.0.0.1:18600` | Host side of the API port mapping. Default `8000` (public). |

### Shared host (current Timeweb VM)

The Timeweb VM (`5.129.243.18`) already runs other projects behind a host
nginx that owns ports 80/443, so this app binds to loopback only
(`API_PUBLISH=127.0.0.1:18600`, `WEB_PORT=127.0.0.1:13600`) and is
exposed through the vhost `/etc/nginx/sites-enabled/risk-copilot.conf`:

- `https://risk.5-129-243-18.sslip.io/` → web container
- `https://risk.5-129-243-18.sslip.io/api/` and `/health` → API container

So `VITE_API_BASE_URL` and `FRONTEND_ORIGIN` are both
`https://risk.5-129-243-18.sslip.io` (same origin, no CORS issues). TLS is
a Let's Encrypt cert managed by certbot on the host.

### Using password auth instead of a key

The workflow already passes both `key` and `password` to
`appleboy/ssh-action`; it uses whichever secret is actually set. To use
password auth, just add `SSH_PASSWORD` as a secret and leave
`SSH_PRIVATE_KEY` unset — no workflow edit needed. Key-based auth is
preferred where available; if you start with a password, consider
generating a keypair later, installing the public key on the server, and
switching to `SSH_PRIVATE_KEY`.

## Running a deploy

**Actions tab → Deploy → Run workflow.** Optionally set `ref` to a branch
other than `main` (e.g. to deploy a feature branch before merging).

The workflow:
1. SSHes into the server.
2. Clones the repo to `/opt/risk-copilot` on first run, or `git fetch` +
   `git reset --hard` to the chosen ref on subsequent runs.
3. Writes `.env` from the secrets/variables above.
4. `docker compose up -d --build`.
5. Polls `http://127.0.0.1:$API_PORT/health` on the server for up to 60s
   and fails the workflow run if the API never comes up — check
   `docker compose logs` on the server for why.

## Verifying it worked

From your own machine (not from this session — it can't reach your
server, see `docs/CURRENT_STATE.md` for why):

```bash
curl http://<VM_IP>:8000/health          # {"status": "ok"}
# then open http://<VM_IP>/ in a browser
```

## Rollback

```bash
ssh <user>@<VM_IP>
cd /opt/risk-copilot
git log --oneline -5          # find the commit to roll back to
git reset --hard <commit>
docker compose up -d --build
```

## Rotating credentials

If `OPENROUTER_API_KEY` or SSH credentials were ever shared outside
GitHub Secrets (chat, a doc, a screenshot), rotate them:

- OpenRouter: https://openrouter.ai/keys → revoke the old key, create a
  new one, update the `OPENROUTER_API_KEY` secret.
- SSH: generate a new keypair, add the new public key to the server's
  `~/.ssh/authorized_keys`, update `SSH_PRIVATE_KEY`, remove the old
  public key from the server.
