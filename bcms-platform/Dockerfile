FROM node:20-alpine

WORKDIR /app

# Install dependencies first so Docker can cache this layer between builds
COPY package*.json ./
RUN npm install --omit=dev

# Now copy the rest of the app
COPY . .

# Uploads need to persist — see docker-compose.yml for the volume mount
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "app.js"]
