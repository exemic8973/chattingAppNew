# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies using npm ci (more reliable in Docker)
# npm ci installs from lockfile and includes devDependencies by default
RUN npm ci

# Copy all source code
COPY . .

# Build the frontend
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Expose port (Zeabur will set this via PORT env variable)
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "run", "start:prod"]
