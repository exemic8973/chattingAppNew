# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including production dependencies)
RUN npm install --omit=dev

# Copy server code
COPY server/ ./server/

# Expose port (Zeabur will set this via PORT env variable)
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "run", "start:prod"]
