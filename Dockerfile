# ---- Build frontend ----
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

# ---- Final image: nginx + Python ----
FROM python:3.12-slim

# Install nginx + supervisord
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements-sync.txt /app/requirements-sync.txt
RUN pip install --no-cache-dir -r /app/requirements-sync.txt

# Frontend from build stage
RUN rm -rf /var/www/html/*
COPY --from=builder /app/dist /var/www/html

# Nginx config
RUN printf 'server {\n\
    listen 3000;\n\
    root /var/www/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/sites-available/default

# Python app
COPY local_strava_sync.py /app/local_strava_sync.py
COPY .env.example /app/.env.example

WORKDIR /app

# Supervisord config
RUN printf '[supervisord]\nnodaemon=true\nlogfile=/dev/null\nlogfile_maxbytes=0\n\n\
[program:nginx]\ncommand=nginx -g "daemon off;"\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\n\
[program:api]\ncommand=python local_strava_sync.py\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\n\
' > /etc/supervisor/conf.d/mydash.conf

# Data volume
VOLUME /app/data

EXPOSE 3000 8765

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/mydash.conf"]
