# Runtime-only: контейнер только отдаёт статику (без npm install внутри)
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Ожидаем, что dist уже собран локально (npm install && npm run build)
COPY dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


