# heatmapper

A heatmap of your Strava data, designed for speed of loading.
This is live at https://heatmapper.charding.dev/.
Note that it probably requires a modern browser, and I have not tested it other than with versions of Chrome and Firefox from at least 2020.

[![Demo](https://user-images.githubusercontent.com/8607022/106386528-50cd2800-63cd-11eb-97b5-f2bb59162c35.png)](https://heatmapper.charding.dev/)

Required software for developing: [node](https://nodejs.org/en/download/) and [yarn](https://yarnpkg.com/en/docs/install/).

Recommended: an IDE such as [Visual Studio Code](https://code.visualstudio.com/), [tmux](https://github.com/tmux/tmux/wiki) if you would like to use [`yarn serve`](#yarn-serve), and [Docker](https://www.docker.com/products/docker-desktop) with [Docker Compose](https://docs.docker.com/compose/) for deploying locally.

## Setup

Please complete in full the [`.env`](.env) file, by copying [`sample.env`](sample.env).
When you are ready to deploy, please also complete [`dist/.env`](dist/.env), by copying [`dist/sample.env`](dist/sample.env).

## Scripts for running

### Development

#### Scripts to be run at the root

The following scripts are located at the root of the monorepo, and apply changes to both the frontend and backend.

##### yarn install-all

Install all dependencies needed for developing and running the code locally.

##### yarn serve

Run both servers together, using `tmux`.
Ctrl-C in either one will kill both.

See [`yarn serve`](#yarn-serve-1) below for more information about how these servers work.

To leave this running in the background, the default shortcut to detach from a tmux session is <kbd>^b</kbd> <kbd>d</kbd>.
It can then be reentered with `tmux attach`.

#### Scripts to be run inside each project

The following scripts can be run in either the frontend or the backend projects.

##### `yarn`

Install packages for this one project.

##### `yarn serve`

Run a development server for this project.
Note that the backend dev server will forward frontend requests to the latest local build of the frontend, and the frontend dev server will forward backend requests to the running backend server (on port 8080).

As this is a development server, the frontend will automatically recompile and reload on save.
The browser’s dev tools will allow for Vue to be inspected, unlike when it is build for production.

##### `yarn lint`

Front

### Building and serving for production

The server can be built to run in Docker using Docker Compose.

#### `yarn build`

This will build both the frontend and backend, and place them together in the `dist/` folder.
This is equivalent to running `yarn build` in both projects.

#### `yarn container`

Run the compiled Docker instance.
This will not reload the code; add the `--build` flag to do so, or see [`yarn build-container`](#yarn-build-container).
Add the `-d` flag to run in the background.

Run `docker-compose down -v` to stop the container permanently.

#### `yarn build-container`

Run `yarn build` followed by `yarn container --build`, so recompiling both the frontend and backend, and updating and rerunning the container.

Note that if the container was previously left running with `-d`, this will leave it running until it has been rebuilt, to minimise the downtime.

#### `yarn deploy`

Deploy the container to a remote server, and (re)start it.
This will use the configuration in [`dist/.env`](dist/.env) (see [`dist/sample.env`](dist/sample.env)).

#### `yarn build-deploy`

Run `yarn build` followed by `yarn deploy`, so recompiling both the frontend and backend, and updating and rerunning the container on the server.

#### `yarn connect`

Log in to your remote server.
If this fails, then `yarn deploy` will also likely fail, so it is useful for testing.
