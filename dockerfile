# 1) Choose a base image with Node installed
FROM node:16-alpine

# 2) Create a working directory inside the container
WORKDIR /app

# 3) Copy package.json and package-lock.json first (for efficient caching)
COPY package*.json ./

# 4) Install dependencies
RUN npm install
# If you're using Yarn: RUN yarn install

# 5) Copy the rest of the application code
COPY . .

# 6) Build your code if needed (e.g., React or TypeScript).
# For a simple Node/Express app, skip this.
# RUN npm run build

# 7) Expose the port (not strictly required, but good documentation)
EXPOSE 3000

# 8) Start the app
CMD ["npm", "start"]