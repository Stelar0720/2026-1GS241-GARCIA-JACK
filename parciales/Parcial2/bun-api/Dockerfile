FROM oven/bun:1.3

WORKDIR /app

COPY package.docker.json ./package.json
RUN bun install --production

COPY src/ ./src/

EXPOSE 4000

CMD ["bun", "run", "start"]
