# affolter-nas — Docker, nginx, Samba

Host: Ubuntu 24.04.5 LTS · `affolter-nas` · `192.168.1.11` (`eno1`)  
SSH: `administrator@192.168.1.11` (not `admin`)  
App URL: `http://192.168.1.11/qrcode/`

Samba stays on the host under `/mnt/nas/`. The web stack is Docker-only under `/srv/docker/`. Do not mix the two.

---

## Layout

```
LAN 192.168.1.0/24
        │
        ▼
 Ubuntu  192.168.1.11
 ├── Samba     /mnt/nas/…          host, not Docker
 ├── UFW       LAN only
 ├── DOCKER-USER  eno1 ← 192.168.1.0/24 only
 └── Docker
      └── network qrcode (internal)
           ├── proxy      nginx    host bind 192.168.1.11:80 → :80
           └── frontend   nginx    internal :80 only
                └── later: backend, postgres (never publish ports)
```

```
Laptop  →  http://192.168.1.11/qrcode/
              │
              ▼
       192.168.1.11:80     (only published web port)
              │
              ▼
       qrcode-proxy-1      nginx
              │  /qrcode/  prefix stripped
              ▼
       qrcode-frontend-1   nginx :80 internal
```

| URL / port | Result |
|---|---|
| `http://192.168.1.11/qrcode/` | Welcome page (later: Vite app) |
| `http://192.168.1.11/` | 404 on purpose |
| `127.0.0.1:80` | fails — port is bound to `192.168.1.11`, not localhost |
| `:3000` / `:5432` | closed — do not publish |

---

## Paths

```
/mnt/nas/share
/mnt/nas/fabian | markus | rita | …     Samba — do not mount into containers

/srv/docker/qrcode/
  compose.yml
  .dockerignore
  proxy/default.conf                    reverse proxy
  frontend/nginx.conf
  frontend/html/index.html              current welcome page
  frontend/Dockerfile                   later Vite build
  data/postgres/                        later, empty
  src/                                  later, via GitHub CLI
```

Work as `administrator` from `/srv/docker/qrcode`. Docker always with `sudo`.

---

## Users

| Account | Role |
|---|---|
| `administrator` | SSH, sudo, NAS admin, group `deploy` |
| `deploy` | owns `/srv/docker` — no password, shell `nologin`, no sudo, no Samba, no `docker` group |
| Samba users | unchanged (`admin`, `fabian`, …) |

`docker` group is equivalent to root. Keep it empty. Never add `administrator` or `deploy`.

`/srv/docker` is `deploy:deploy`, dirs `2770`, files `660`.  
Exception: files nginx must read inside a container need `644` and dirs `755` (the welcome HTML). Container UID `nginx` is not `deploy`.

---

## Firewall

UFW default: deny incoming, allow outgoing, deny routed.  
Allow **only** from `192.168.1.0/24`:

| Port | Service |
|---|---|
| 22/tcp | SSH |
| 80/tcp | HTTP (proxy) |
| 443/tcp | HTTPS (unused yet) |
| 137/udp, 138/udp, 139/tcp, 445/tcp | Samba |

No `Anywhere`, no IPv6 allow.

VPN still works if the client arrives as `192.168.1.x` (typical router VPN). A separate VPN subnet (`10.x`, Tailscale `100.x`) needs extra UFW rules for that source — do not open `Anywhere` again.

UFW does **not** reliably filter published Docker ports. That is `DOCKER-USER` in `/etc/ufw/after.rules` (after the first `COMMIT`):

- `RELATED,ESTABLISHED` → RETURN
- `eno1` + `192.168.1.0/24` → RETURN
- rest of `eno1` → DROP
- `eno2` → DROP

Backup: `/etc/ufw/after.rules.bak`

```bash
sudo ufw status verbose
sudo iptables -L DOCKER-USER -n -v
```

---

## nginx routing

Proxy `location /qrcode/` → `proxy_pass http://frontend:80/;`  
Trailing slash on `proxy_pass` strips `/qrcode/`. Frontend sees `/`.

- `/qrcode` → 301 → `/qrcode/`
- `/` → 404

Later: `/api/` → backend (internal). Postgres never on the LAN.

App build later must use `npm run build -- --base /qrcode/` so assets load under `/qrcode/assets/…`.

The log line `can not modify default.conf (read-only file system?)` is harmless. The IPv6 entrypoint script cannot patch a read-only bind-mount; nginx still starts.

---

## Cheatsheet

### Status

```bash
cd /srv/docker/qrcode

sudo docker compose ps
sudo docker compose logs -f
sudo docker compose logs -f proxy
sudo docker compose logs -f frontend

sudo docker ps -a
sudo docker images
sudo docker network ls
sudo docker network inspect qrcode_qrcode

sudo ss -tulpn | grep -E ':80|:22|:445|:139'
curl -sI http://192.168.1.11/qrcode/
```

Expect host port `192.168.1.11:80` only. Frontend has no host port.

### Start / stop

```bash
cd /srv/docker/qrcode
sudo docker compose up -d
sudo docker compose down
sudo docker compose restart proxy
sudo docker compose pull
```

`restart: unless-stopped` — containers come back after reboot.

After `compose.yml` or volume changes: `sudo docker compose up -d`.

### nginx inside the containers

```bash
sudo docker compose exec proxy nginx -t
sudo docker compose exec proxy nginx -s reload
sudo docker compose exec proxy cat /etc/nginx/conf.d/default.conf
sudo docker compose exec frontend wget -qO- http://127.0.0.1/ | head
```

If `exec` fails because of `read_only`: `sudo docker compose restart proxy`.

Host copies:

```bash
cat /srv/docker/qrcode/proxy/default.conf
cat /srv/docker/qrcode/frontend/nginx.conf
```

### Errors

| Symptom | Meaning |
|---|---|
| **502** | proxy up, frontend unreachable |
| **403** | nginx up, file permissions (needs `644` for HTML) |
| **404** | wrong path (`/qrcode/` vs `/`) |
| **connection refused** on `:80` from localhost | bind is `192.168.1.11` only |

### Permissions

```bash
ls -laR /srv/docker/qrcode
id                    # must include group deploy
```

```bash
sudo chown -R deploy:deploy /srv/docker
sudo find /srv/docker/qrcode -type d -exec chmod 2770 {} \;
sudo find /srv/docker/qrcode -type f -exec chmod 660 {} \;
# then, for HTML nginx must serve:
sudo chmod 0755 /srv/docker/qrcode/frontend/html
sudo chmod 0644 /srv/docker/qrcode/frontend/html/index.html
```

---

## Decisions

- File server on the host, web stack in Docker
- One published port (proxy); backend/DB stay on the Docker network
- User `deploy` (generic), not a project-specific `qrweb`
- nginx, not Caddy
- Welcome HTML first; real app later via GitHub CLI into `src/` — not copied onto a Samba share

---

## Next

1. GitHub CLI on the NAS, clone into `/srv/docker/qrcode/src/`
2. Point the frontend service at `frontend/Dockerfile` (Vite build, `--base /qrcode/`)
3. Backend + Postgres on the same network, **no** `ports:`
4. Optional: LAN DNS names and HTTPS on 443
