FROM node:15

COPY . /usr/src/app/dist/

WORKDIR /usr/src/app/dist/server

RUN yarn global add pm2

RUN yarn --prod --no-lockfile
RUN yarn --prod --no-lockfile --cwd ../shared

EXPOSE 8080

CMD ["pm2-runtime","app.js"]
