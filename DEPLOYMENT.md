# 🚀 Deployment Guide for CJ Chat

## Overview
This application consists of two parts:
1. **Frontend (Client)** - Deploy to Netlify
2. **Backend (Server)** - Deploy to a server hosting service

## Step 1: Deploy Backend Server

### Option A: Deploy to Heroku (Recommended)

1. **Create a Heroku account** at [heroku.com](https://heroku.com)

2. **Install Heroku CLI** and login:
   ```bash
   npm install -g heroku
   heroku login
   ```

3. **Create a new Heroku app**:
   ```bash
   cd server
   heroku create your-chat-app-name
   ```

4. **Set environment variables**:
   ```bash
   heroku config:set SUPABASE_URL=https://zbtvkqjbpvckyxhacfek.supabase.co
   heroku config:set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidHZrcWpicHZja3l4aGFjZmVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0NTYyNzAsImV4cCI6MjA3MTAzMjI3MH0.LUuLlq30F9MTq8U8tB-fRW8vyJDYjQ95-U05Q6JaRyE
   heroku config:set ADMIN_SECRET=your-secure-admin-secret
   ```

5. **Deploy to Heroku**:
   ```bash
   git add .
   git commit -m "Deploy chat server"
   git push heroku main
   ```

6. **Get your server URL**:
   ```bash
   heroku info
   ```
   Note the URL (e.g., `https://your-chat-app-name.herokuapp.com`)

### Option B: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Set environment variables in Railway dashboard
4. Deploy automatically

### Option C: Deploy to Render

1. Go to [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set environment variables
5. Deploy

## Step 2: Deploy Frontend to Netlify

### Method 1: Deploy via Netlify UI (Easiest)

1. **Go to [netlify.com](https://netlify.com)** and sign up/login

2. **Drag and drop your `dist` folder**:
   - Run `npm run build` locally
   - Drag the `dist` folder to Netlify's deploy area

3. **Set environment variables**:
   - Go to Site Settings > Environment Variables
   - Add: `VITE_SERVER_URL` = your server URL from Step 1

4. **Your site is live!** (e.g., `https://your-app-name.netlify.app`)

### Method 2: Deploy via Git (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy to Netlify"
   git push origin main
   ```

2. **Connect to Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository

3. **Configure build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Set environment variables**:
   - Go to Site Settings > Environment Variables
   - Add: `VITE_SERVER_URL` = your server URL from Step 1

5. **Deploy!**

## Step 3: Update Environment Variables

### For Netlify Frontend:
- `VITE_SERVER_URL` = your deployed server URL

### For Server Backend:
- `SUPABASE_URL` = https://zbtvkqjbpvckyxhacfek.supabase.co
- `SUPABASE_ANON_KEY` = your anon key
- `ADMIN_SECRET` = your admin secret

## Step 4: Test Your Deployment

1. **Test the frontend**: Visit your Netlify URL
2. **Test room creation**: Click "Create New Room"
3. **Test messaging**: Send messages in the room
4. **Test admin panel**: Use your admin secret

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your server allows your Netlify domain
2. **Environment Variables**: Double-check all environment variables are set
3. **Build Errors**: Check the build logs in Netlify
4. **Server Connection**: Verify your server URL is correct

### Environment Variables Checklist:

**Frontend (Netlify):**
- ✅ `VITE_SERVER_URL`

**Backend (Heroku/Railway/Render):**
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `ADMIN_SECRET`

## Quick Deploy Commands

```bash
# Build for production
npm run build

# Deploy to Heroku (from server directory)
cd server
heroku create your-app-name
heroku config:set SUPABASE_URL=https://zbtvkqjbpvckyxhacfek.supabase.co
heroku config:set SUPABASE_ANON_KEY=your-anon-key
heroku config:set ADMIN_SECRET=your-admin-secret
git push heroku main

# Get server URL
heroku info

# Deploy frontend to Netlify
# Then set VITE_SERVER_URL in Netlify environment variables
```

Your app will be live at your Netlify URL! 🎉 