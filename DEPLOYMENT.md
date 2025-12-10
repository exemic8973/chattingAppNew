# Production Deployment Guide - Zeabur

This guide explains how to deploy the chat application to Zeabur using PostgreSQL.

## Prerequisites

- Zeabur account
- GitHub repository with production branch

## Database Configuration

The production branch uses PostgreSQL instead of SQLite for better scalability and reliability.

### Environment Variables

The following environment variables need to be set in Zeabur:

- `NODE_ENV=production` - Enables production mode
- `DATABASE_URL` - PostgreSQL connection string (automatically provided by Zeabur PostgreSQL service)
- `PORT` - Server port (automatically set by Zeabur)

## Deployment Steps

### 1. Create a Zeabur Project

1. Log in to [Zeabur](https://zeabur.com)
2. Create a new project
3. Click "Deploy New Service"

### 2. Add PostgreSQL Database

1. In your Zeabur project, click "Add Service"
2. Select "PostgreSQL"
3. Wait for the database to be provisioned
4. Zeabur will automatically set the `DATABASE_URL` environment variable

### 3. Deploy the Application

1. Click "Add Service" again
2. Select "GitHub" and connect your repository
3. Select the **production** branch
4. Zeabur will automatically detect the Node.js application
5. The application will build and deploy

### 4. Configure Environment Variables

Zeabur automatically sets:
- `DATABASE_URL` (from PostgreSQL service)
- `PORT`

You only need to set:
- `NODE_ENV=production`

### 5. Access Your Application

Once deployed, Zeabur will provide a public URL to access your application.

## Development vs Production

- **Development (main branch)**: Uses SQLite database
- **Production (production branch)**: Uses PostgreSQL database

The application automatically detects the environment based on `NODE_ENV` and uses the appropriate database.

## SSL/HTTPS Certificates

Note: The production code still references local SSL certificates (`key.pem`, `cert.pem`). For Zeabur deployment:
- Zeabur handles SSL/TLS termination automatically
- You may want to modify the server to use HTTP in production and let Zeabur handle HTTPS
- Alternatively, remove the SSL certificate requirements for production deployment

## Troubleshooting

- Check Zeabur logs if deployment fails
- Ensure PostgreSQL service is running and connected
- Verify `NODE_ENV=production` is set
- Check that `DATABASE_URL` is properly configured
