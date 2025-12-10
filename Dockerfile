# Use Node.js LTS version (full image, not slim)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Force development mode for npm ci to install devDependencies
# Zeabur sets NODE_ENV=production at build time which skips devDependencies
ENV NODE_ENV=development

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy all source code
COPY . .

# Build the frontend
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Expose port (Zeabur will set this via PORT env variable)
EXPOSE 3001

# Set production environment for runtime
ENV NODE_ENV=production

# Start the server
CMD ["npm", "run", "start:prod"]
