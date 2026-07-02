FROM node:18-alpine
RUN apk add --no-cache vips-dev fftw-dev gcc g++ make python3
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY src ./src
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
