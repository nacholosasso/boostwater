FROM node:18-slim
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production --no-audit --no-fund

# Copy source
COPY . .

ENV PORT 8080
EXPOSE 8080
CMD ["npm", "start"]
