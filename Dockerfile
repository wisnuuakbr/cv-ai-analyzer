# Use node 20 as base image
FROM node:20-alpine

# Set work directory
WORKDIR /app

# Copy file package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project to container
COPY . .

# Create necessary directories
RUN mkdir -p uploads logs docs

# Expose port to 3000
EXPOSE 3000

# Command to run application
CMD ["npm", "run", "dev"]
