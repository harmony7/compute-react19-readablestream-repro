import React from 'react';
import { KVStore } from 'fastly:kv-store';

import Container from './Container.js';

// This is an 'async' React Server Component
export default async function App({actions}) {

  let todos = [];
  let serverState = null;

  // The prop 'actions' is a comma-delimited string, the segments describe what
  // actions to perform and in what order.

  const actionsString = actions ?? 'fetchTodos,kvstore,delay';
  console.log('actionsString', actionsString);

  for (const seg of actionsString.split(',')) {
    const segValue = seg.trim();
    if (segValue === 'delay') {
      console.log('Before waiting for 1ms');
      await delay();
      console.log('After waiting for 1ms');
    } else if (segValue === 'fetchTodos') {
      console.log('Before fetchTodos');
      todos = await fetchTodos();
      console.log('After fetchTodos');
    } else if (segValue === 'kvstore') {
      console.log('Before getKvStoreValue');
      serverState = await getKvStoreValue();
      console.log('After getKvStoreValue');
    } else {
      console.log(`Unknown actions ${segValue}`);
    }
  }

  return (
    <html lang="en">
    <head>
      <meta charSet="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>React 19 Server Components</title>
    </head>
    <body>
      <Container>
        <h1>{serverState}</h1>
        <ul>
          {todos.map(todo => (
            <li key={todo.id}>{todo.completed ? '✅' : '◻︎'}{todo.todo}</li>
          ))}
        </ul>
      </Container>
    </body>
    </html>
  );
}

async function delay() {
  await new Promise(resolve => {
    setTimeout(() => { resolve(); }, 1);
  });
}

async function getKvStoreValue() {
  const store = new KVStore('my-app-data');
  const kvValue = (await store.get('serverState')) ?? null;
  return kvValue != null ? await kvValue.text() : 'Hello, World!';
}

async function fetchTodos() {
  const res = await fetch('https://dummyjson.com/todos');
  const json = await res.json();
  return json.todos.slice(0, 5);
}
