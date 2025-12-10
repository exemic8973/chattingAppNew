# Complete Zeabur Deployment Guide

This guide will walk you through deploying your chat application to Zeabur with PostgreSQL.

## Prerequisites

- GitHub account with your code pushed to a repository
- Zeabur account (sign up at https://zeabur.com)
- Your repository must have the `production` branch

## Step-by-Step Deployment

### Step 1: Sign Up / Log In to Zeabur

1. Go to https://zeabur.com
2. Click "Sign In" or "Get Started"
3. Sign in with your GitHub account
4. Authorize Zeabur to access your GitHub repositories

### Step 2: Create a New Project

1. Once logged in, you'll see the Zeabur dashboard
2. Click the **"Create Project"** button (or "New Project")
3. Give your project a name (e.g., "chatting-app-production")
4. Select a region closest to your users (e.g., US, Europe, Asia)
5. Click **"Create"**

### Step 3: Add PostgreSQL Database Service

**Important: Add the database FIRST before deploying your app**

1. In your newly created project, click **"Add Service"** or **"+"**
2. Select **"Marketplace"** or **"Prebuilt"**
3. Find and select **"PostgreSQL"**
4. Click **"Deploy"**
5. Wait for PostgreSQL to finish deploying (you'll see a green checkmark when ready)
6. Zeabur will automatically create a `DATABASE_URL` environment variable

### Step 4: Deploy Your Application

1. Click **"Add Service"** again (or the **"+"** button)
2. Select **"Git"** or **"GitHub"**
3. You'll see a list of your repositories
4. Find and select your repository: `chattingAppNew` (or whatever you named it)
5. **IMPORTANT:** Select the **"production"** branch (NOT main)
6. Click **"Deploy"**

### Step 5: Configure Environment Variables

1. Click on your deployed application service (not the database)
2. Go to the **"Variables"** or **"Environment"** tab
3. Add the following environment variable:

   **Variable Name:** `NODE_ENV`
   **Value:** `production`

4. Click **"Save"** or **"Confirm"**

**Note:** You don't need to manually set `DATABASE_URL` - Zeabur automatically connects it from the PostgreSQL service.

### Step 6: Link Database to Application

1. Make sure both services (PostgreSQL and your app) are in the same project
2. Zeabur should automatically link them
3. To verify:
   - Click on your app service
   - Go to "Variables" tab
   - You should see `DATABASE_URL` listed (with a value starting with `postgresql://`)

### Step 7: Wait for Deployment

1. Zeabur will now:
   - Clone your repository
   - Run `npm install`
   - Start your application with `npm run start:prod`
2. Watch the **"Logs"** tab to see deployment progress
3. Wait for the message: "Deployment successful" or similar
4. You should see: `SERVER RUNNING ON PORT XXXX` in the logs

### Step 8: Get Your Application URL

1. Once deployed, click on your application service
2. Go to the **"Networking"** or **"Domains"** tab
3. Zeabur will provide a default domain like: `your-app-xxx.zeabur.app`
4. Copy this URL - this is your public chat application URL!

### Step 9: Test Your Application

1. Open the provided URL in your browser
2. You should see your chat application login page
3. Try creating an account and logging in
4. Test sending messages

## Troubleshooting

### If deployment fails:

1. **Check the logs:**
   - Go to your app service
   - Click "Logs" tab
   - Look for error messages

2. **Common issues:**

   **Issue:** `DATABASE_URL not found`
   - **Solution:** Make sure PostgreSQL service is deployed BEFORE your app
   - Check that both services are in the same project
   - Restart your app service

   **Issue:** `Port already in use`
   - **Solution:** Make sure you're using `process.env.PORT` in your code
   - This is already configured in your production branch

   **Issue:** `Module not found`
   - **Solution:** Make sure all dependencies are in `package.json`
   - Try redeploying

   **Issue:** SSL/Certificate errors
   - **Solution:** Already handled - production branch uses HTTP (Zeabur handles HTTPS)

### Viewing Logs

1. Click on your app service
2. Click **"Logs"** tab
3. View real-time logs to debug issues

### Restarting the Application

1. Click on your app service
2. Click **"Restart"** button
3. Wait for the service to restart

### Updating Your Application

When you push changes to the `production` branch:

1. Go to your repository on GitHub
2. Switch to `production` branch
3. Push your changes: `git push origin production`
4. Zeabur will **automatically** detect changes and redeploy
5. Watch the logs to see the redeployment

## Managing Your Database

### View PostgreSQL Connection Info

1. Click on the PostgreSQL service
2. Go to "Instructions" or "Connection" tab
3. You'll see:
   - Host
   - Port
   - Database name
   - Username
   - Password

### Connect to Database (Optional)

You can connect using a PostgreSQL client:
- **pgAdmin** (GUI tool)
- **psql** (command line)
- Use the connection details from above

## Environment Variables Reference

Your production environment automatically has:

| Variable | Value | Source |
|----------|-------|--------|
| `NODE_ENV` | `production` | You set this manually |
| `DATABASE_URL` | `postgresql://...` | Auto-set by Zeabur |
| `PORT` | Dynamic (e.g., 8080) | Auto-set by Zeabur |

## Cost Information

- **Free Tier:** Zeabur offers a free tier for testing
- **PostgreSQL:** May have usage limits on free tier
- Check Zeabur's pricing page for current rates

## Custom Domain (Optional)

To use your own domain:

1. Click on your app service
2. Go to "Domains" tab
3. Click "Add Custom Domain"
4. Follow instructions to configure DNS

## Security Best Practices

1. **Never commit** `.env` files or secrets to GitHub
2. **Use environment variables** for sensitive data (already configured)
3. **Enable HTTPS** (Zeabur handles this automatically)
4. **Regular backups:** Export your PostgreSQL database periodically

## Support

- **Zeabur Documentation:** https://zeabur.com/docs
- **Zeabur Discord:** Join their community for help
- **GitHub Issues:** Report bugs in your repository

## Summary Checklist

- [ ] Created Zeabur account
- [ ] Created new project
- [ ] Deployed PostgreSQL service
- [ ] Deployed application from `production` branch
- [ ] Set `NODE_ENV=production`
- [ ] Verified `DATABASE_URL` is linked
- [ ] Got public URL
- [ ] Tested application
- [ ] Application is live!

---

**Your application is now live on Zeabur!** 🎉

Access it at: `https://your-app-xxx.zeabur.app`
