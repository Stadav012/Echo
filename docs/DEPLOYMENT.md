# Deployment + CI/CD Setup

This repository is now prepared for:

- CI on every push/PR via GitHub Actions
- Frontend deployment to Vercel
- Voice backend deployment to Railway
- Local production-like smoke testing via Docker Compose

## 1) Workflows Added

- `.github/workflows/ci.yml`
  - Frontend: `npm ci`, `npm run lint`, `npm run build`
  - Voice backend: install requirements and `py_compile` checks
- `.github/workflows/deploy.yml`
  - Frontend deploy job (Vercel)
  - Voice backend deploy job (Railway)
  - Deploy jobs run only when required secrets are present

## 2) Containerization Added

- `frontend/Dockerfile`
- `backend/voicecall-module/Dockerfile`
- `frontend/.dockerignore`
- `backend/voicecall-module/.dockerignore`
- `docker-compose.deploy.yml`

Run local production-like stack:

```bash
docker compose -f docker-compose.deploy.yml up --build
```

## 3) Required GitHub Secrets

Set these in `Settings -> Secrets and variables -> Actions`.

### Vercel

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Railway

- `RAILWAY_TOKEN`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_SERVICE_ID`

## 4) Runtime Environment Variables

### Frontend (Vercel)

At minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VOICE_SERVICE_URL` (URL of deployed voice backend)
- `VOICE_SERVICE_API_KEY`
- `VOICE_SERVICE_CALLBACK_SECRET`
- `LLM_PROVIDER=qwen`
- `QWEN_API_KEY`
- `QWEN_MODEL=qwen-vl-max`
- `GEMINI_API_KEY` (fallback)
- `GEMINI_MODEL=gemini-2.5-flash`

### Voice backend (Railway)

At minimum:

- `DEEPGRAM_API_KEY`
- `CARTESIA_API_KEY`
- `CARTESIA_VOICE_ID`
- `API_KEY`
- `CALLBACK_SECRET`
- `BASE_URL` (public Railway URL)
- `LLM_PROVIDER=qwen`
- `QWEN_API_KEY`
- `QWEN_MODEL=qwen-vl-max`
- `GEMINI_API_KEY` (fallback)
- `GEMINI_MODEL=gemini-2.5-flash`
- `LLM_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- `LLM_MODEL=qwen-vl-max`
- `LLM_API_KEY=<same as QWEN_API_KEY>`

Optional:

- `REDIS_URL`
- `SESSION_TIMEOUT_SECONDS`

## 5) Deployment Order

1. Deploy voice backend (Railway) first.
2. Copy backend public URL into frontend `VOICE_SERVICE_URL`.
3. Deploy frontend (Vercel).
4. Validate health:
   - voice: `GET /health`
   - frontend: create a call link and complete one full conversation.

