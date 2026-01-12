# Deployment Guide

## Custom Domain Setup

### 1. Add Domain in Vercel
1. Go to your Vercel project → **Settings** → **Domains**
2. Add your domain (e.g., `dreamsatlas.com`)
3. Vercel will show DNS records to configure

### 2. Configure DNS at Your Domain Registrar
Add the DNS records Vercel provides:
- **Apex domain** (`dreamsatlas.com`): A record → Vercel's IP
- **www subdomain** (`www.dreamsatlas.com`): CNAME → `cname.vercel-dns.com`

### 3. Environment Variables in Vercel
Go to **Settings** → **Environment Variables** and ensure you have:

```
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
```

**Important**: Set `NEXT_PUBLIC_SITE_URL` to your custom domain for production.

### 4. Update Supabase Redirect URLs
In Supabase Dashboard → **Authentication** → **URL Configuration**:

**Site URL:**
```
https://yourdomain.com
```

**Redirect URLs** (add all of these):
```
https://yourdomain.com/**
https://yourdomain.com/app
https://yourdomain.com/login
https://yourdomain.com/signup
https://yourdomain.com/forgot-password
```

Also keep your Vercel preview URLs for development:
```
https://your-project.vercel.app/**
```

## Development Workflow

### Making Changes

1. **Local Development:**
   ```bash
   npm run dev
   ```
   - Runs on `http://localhost:3000`
   - Uses `.env.local` for environment variables
   - No custom domain needed locally

2. **Commit & Push:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

3. **Automatic Deployment:**
   - Vercel automatically deploys on push to `main`
   - Preview deployments use `*.vercel.app` URLs
   - Production uses your custom domain

4. **Testing:**
   - Test on Vercel preview URL first
   - Once verified, merge to `main` for production
   - Production automatically uses your custom domain

### Environment Variables

- **Local**: Use `.env.local` (not committed to git)
- **Vercel**: Set in project settings (applies to all deployments)
- **Production**: Uses custom domain automatically via `NEXT_PUBLIC_SITE_URL`

## Troubleshooting

### Domain Not Working
- Check DNS propagation: `dig yourdomain.com` or use [dnschecker.org](https://dnschecker.org)
- Verify DNS records match Vercel's requirements
- Wait up to 48 hours for full propagation

### Authentication Issues
- Ensure Supabase redirect URLs include your custom domain
- Check `NEXT_PUBLIC_SITE_URL` matches your domain
- Verify Supabase Site URL is set correctly

### Images Not Loading
- Check Supabase storage bucket is public
- Verify CORS settings if needed
- Check browser console for errors

