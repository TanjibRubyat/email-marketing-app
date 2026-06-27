FROM node:20-alpine
WORKDIR /app

# Copy package files first and install separately from the source copy -
# Docker caches this layer, so re-running a build after only changing
# application code (not dependencies) skips npm install entirely.
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000
CMD ["npm", "run", "dev"]
