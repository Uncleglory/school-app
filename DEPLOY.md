# Deploy to Vercel + Enable Email / SMS

This guide gets your School Management System live on Vercel with a free Postgres database, email alerts (Resend), and optional SMS (Africa’s Talking).

---

## 1. Database — Neon (free Postgres)

1. Go to [https://console.neon.tech](https://console.neon.tech) and sign up / log in.
2. **Create a project** (e.g. `school-app`).
3. Copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).

Keep this for Vercel env vars.

---

## 2. Email — Resend (free tier)

1. Go to [https://resend.com](https://resend.com) → sign up.
2. **API Keys** → Create API Key → copy it (`re_...`).
3. For testing you can send **to your own email** using `onboarding@resend.dev` as the from address.
4. For production: add and verify your domain under **Domains**, then set  
   `EMAIL_FROM="Your School <noreply@yourdomain.com>"`.

---

## 3. SMS — Africa’s Talking (optional)

1. [https://account.africastalking.com](https://account.africastalking.com) → sign up.
2. Use the **Sandbox** first (free).
3. Copy **API Key** and **Username** (`sandbox` for sandbox).
4. In sandbox, only numbers you whitelist can receive SMS.

---

## 4. Deploy on Vercel

### Option A — GitHub (recommended)

1. Push this project to a GitHub repo:
   ```bash
   cd school-app
   git init
   git add .
   git commit -m "School management app"
   # Create repo on GitHub, then:
   git remote add origin https://github.com/YOUR_USER/school-app.git
   git branch -M main
   git push -u origin main
   ```

2. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → import the repo.

3. **Environment Variables** — add these in the Vercel project settings:

   | Name | Value |
   |------|--------|
   | `DATABASE_URL` | Neon connection string |
   | `AUTH_SECRET` | Run `npx auth secret` locally and paste |
   | `AUTH_URL` | `https://YOUR-PROJECT.vercel.app` (after first deploy you can set this) |
   | `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |
   | `RESEND_API_KEY` | `re_...` |
   | `EMAIL_FROM` | `School App <onboarding@resend.dev>` |
   | `AT_API_KEY` | (optional) |
   | `AT_USERNAME` | (optional) `sandbox` |

4. Click **Deploy**.

5. After deploy, set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the real URL if you used a placeholder, then **Redeploy**.

### Option B — Vercel CLI

```bash
npm i -g vercel
cd school-app
vercel login
vercel
# Follow prompts, then add env vars in the dashboard and:
vercel --prod
```

---

## 5. Push the database schema

After the first successful deploy (so `DATABASE_URL` is available):

**Locally** (with your Neon URL in `.env`):

```bash
npx prisma db push
npm run db:seed
```

Or use Neon’s SQL editor / Prisma from your machine — both work.

---

## 6. Test

1. Open `https://YOUR-PROJECT.vercel.app`
2. Login: `admin@school.com` / `password123`
3. Mark a student **Absent** → check:
   - **Notifications** in the app
   - Your email inbox (if Resend is configured)
4. Record a fee payment → same checks

---

## 7. Important notes

- **Resend free tier**: limited to your own email until you verify a domain.
- **AUTH_SECRET** must be set in production or login will fail.
- **Prisma** runs `prisma generate` on `postinstall` — Vercel handles this automatically.
- If build fails on Prisma, ensure `DATABASE_URL` is set for the **Build** environment as well (Vercel → Settings → Environment Variables → Production + Preview + Development).

---

## Quick checklist

- [ ] Neon project + `DATABASE_URL`
- [ ] Resend API key + `EMAIL_FROM`
- [ ] `AUTH_SECRET` generated
- [ ] Repo on GitHub → imported to Vercel
- [ ] Env vars set on Vercel
- [ ] Deploy succeeded
- [ ] `npx prisma db push` + `npm run db:seed` against Neon
- [ ] Login works
- [ ] Absence / payment creates in-app notification + email

You’re live. 🚀
