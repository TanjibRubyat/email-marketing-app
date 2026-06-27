FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173
# --host 0.0.0.0 is required: Vite's dev server binds to localhost by
# default, which inside a container means "this container only" - the host
# machine couldn't reach it even with the port mapped.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
