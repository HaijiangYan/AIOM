# select your base image to start with
FROM node:22.9.0-alpine3.20
LABEL org.opencontainers.image.authors="haijiang.r.yan@gmail.com"
# Create app directory
# this is the location where you will be inside the container
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
# copying packages first helps take advantage of docker layers
COPY package*.json ./

ENV NODE_ENV=production

RUN npm install

# Bundle app source
COPY . .

# ENV PORT=8080
# # Make port accessible
# EXPOSE $PORT

# Command to run when the container is ready
# Separate arguments as separate values in the array
CMD [ "npm", "start" ]