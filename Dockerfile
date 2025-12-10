# Use Node.js LTS version (full image, not slim)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Verify vite is installed
RUN ls -la node_modules/.bin/vite || echo "Vite not found in node_modules/.bin"
RUN npm list vite || echo "Vite not in npm list"

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
