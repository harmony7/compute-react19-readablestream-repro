/// <reference types="@fastly/js-compute" />

import { env } from 'fastly:env';

import * as React from 'react';
import ReactServerDOMServer from 'react-server-dom-webpack/server.edge';

import App from './app/App.js';

async function handleRequest(event) {

  // Log service version.
  console.log('FASTLY_SERVICE_VERSION: ', env('FASTLY_SERVICE_VERSION') || 'local');

  const request = event.request;
  const url = new URL(request.url);

  // Read the actions param
  const actions = url.searchParams.get('actions') || null;

  // Instantiate App
  const app = React.createElement(App, { actions });

  // Serialize to a stream
  const flightStream = ReactServerDOMServer.renderToReadableStream(app, {})

  return new Response(
    flightStream,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/x-component',
      },
    },
  );
}

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
