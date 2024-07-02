# syntax = docker/dockerfile:1

# Adjust BUN_VERSION as desired
FROM node:20 as base

LABEL fly_launch_runtime="SvelteKit"

# SvelteKit app lives here
WORKDIR /app

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

# Install node modules
COPY --link .npmrc bun.lockb package.json ./
RUN yarn install

# Copy application code
COPY --link . .

# Build application
RUN yarn build

# Remove development dependencies
RUN rm -rf node_modules && \
    yarn install --ci

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app

# Set production environment
ENV NODE_ENV="production"

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "yarn", "start" ]