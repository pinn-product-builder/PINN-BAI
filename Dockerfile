# Frontend estático (Vite) — variáveis públicas do Supabase injetadas no build
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Usa `npm install --legacy-peer-deps` (não `npm ci`) porque o lockfile
# pode estar parcialmente fora de sync após merges grandes — mais resiliente,
# custa ~5s a mais por build.
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_URL
ARG VITE_MARI_SUPABASE_URL
ARG VITE_MARI_SUPABASE_KEY
ARG VITE_GOOGLE_MAPS_API_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MARI_SUPABASE_URL=$VITE_MARI_SUPABASE_URL
ENV VITE_MARI_SUPABASE_KEY=$VITE_MARI_SUPABASE_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
