# Use the official node image as base
FROM node:20-alpine3.18
RUN apk add python3
RUN apk add --no-cache --virtual .gyp \
        make \
        curl \
        g++ \
        libpcap-dev

# Set the working directory inside the container
WORKDIR /app

# Install necessary packages
RUN apk add --update --no-cache \
    git

# Clone the GitHub repository into the container
RUN git clone https://github.com/parv-jain/redis-traffic-monitor .

# Download and install any dependencies
RUN npm ci

ENV REDIS_PORT=6379
ENV INFLUX_DB_URL=https://influxdb-jkt.pluang.org
ENV INFLUX_DB_TOKEN=W9NByzMcI17agSTVbpEd
ENV INFLUX_DB_ORG=primary
ENV INFLUX_DB_BUCKET=redis-metrics
ENV NETWORK_INTERFACE=eth0

CMD ["node", "index.js"]