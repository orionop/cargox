FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 18 from NodeSource
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

EXPOSE 5173

CMD ["npm","start","--host","0.0.0.0"]