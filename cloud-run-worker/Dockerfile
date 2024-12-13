# Use the official Node.js 20 LTS image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source code
COPY . .

# Expose the port
EXPOSE 8080

# Define environment variable
ENV PORT 8080

# Start the server
CMD [ "node", "server.js" ]
