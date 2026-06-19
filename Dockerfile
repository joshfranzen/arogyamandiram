FROM node:20-alpine
WORKDIR /app

# Build-time placeholders so `next build` succeeds without real secrets.
# Real values are injected at container runtime.
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV MONGODB_URI=mongodb://localhost:27017/arogyamandiram
ENV ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
ENV OPENAI_MODEL=build-placeholder
# NEXT_PUBLIC_* vars are inlined at build time by Next.js and must be present here
ARG NEXT_PUBLIC_DASHBOARD_TOUR_VERSION=1
ARG NEXT_PUBLIC_DEBUG_MODE=false
ENV NEXT_PUBLIC_DASHBOARD_TOUR_VERSION=${NEXT_PUBLIC_DASHBOARD_TOUR_VERSION}
ENV NEXT_PUBLIC_DEBUG_MODE=${NEXT_PUBLIC_DEBUG_MODE}
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY package.json package-lock.json ./
# Install all deps (including devDependencies needed for the build, e.g. tailwindcss)
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Copy static assets and public folder into the standalone output so the
# standalone server can serve /_next/static/* and /public/* correctly.
RUN cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public

# Switch to production mode after build
ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs \
 && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
