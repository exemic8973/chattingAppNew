# Use Node.js LTS version (full image, not slim)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Debug: List copied files
RUN ls -la package*.json

# Debug: Show npm and node versions
RUN node --version && npm --version

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --verbose

# Debug: Check what was installed
RUN ls -la node_modules/ | head -20
RUN npm list --depth=0

# Copy all source code
COPY . .

# Build the frontend using npx to ensure vite is found
RUN npx vite build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Expose port (Zeabur will set this via PORT env variable)
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "run", "start:prod"]
