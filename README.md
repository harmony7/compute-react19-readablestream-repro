# React 19 in Compute / MOZ_CRASH repro

2025-02-12 Katsuyuki Omuro (komuro@fastly.com)

The purpose of this GitHub repo is to provide a repro for a `MOZ_CRASH` error that occurs when attempting to stream out
of a `ReadableStream`.

> [!IMPORTANT]
> This was a bug that existed starting `@fastly/js-compute@3.28.0`, and has since been [fixed in `@fastly/js-compute@3.32.2`](https://github.com/fastly/js-compute-runtime/releases/tag/v3.32.2)

The code in this repo has been deployed using @fastly/js-compute@3.30.1 to the Fastly Service
at https://rsc-demo-compute.edgecompute.app.

## What is it?

The error that occurs is:
```
Hit MOZ_CRASH(Redirecting call to abort() to mozalloc_abort
) at /home/runner/work/spidermonkey-wasi-embedding/spidermonkey-wasi-embedding/gecko-dev/memory/mozalloc/mozalloc_abort.cpp:35
2025-02-12T06:35:13.787548Z ERROR request{id=9}: WebAssembly trapped: error while executing at wasm backtrace:
    0: 0x96399 - <unknown>!mozalloc_abort
    1: 0x9641b - <unknown>!abort
    2: 0x3b4b4 - <unknown>!api::AsyncTask::select(std::__2::vector<api::AsyncTask*, std::__2::allocator<api::AsyncTask*>>&)
    3: 0x2ab3a - <unknown>!core::EventLoop::run_event_loop(api::Engine*, double)
    4: 0x25df7 - <unknown>!api::Engine::run_event_loop()
    5: 0x5f1aab - <unknown>!fastly::runtime::handle_incoming(host_api::Request)
    6: 0x5f24aa - <unknown>!main
    7: 0x15c57c7 - <unknown>!__main_void
    8: 0x147f0 - <unknown>!__wizer_resume()

Caused by:
    wasm trap: wasm `unreachable` instruction executed
```
This is an intermittent error and does not occur every time.

Trapping the error in JavaScript leads to the time during which a `ReadableStream` is being read out of. It happens
regardless of how the reading occurred: whether the `ReadableStream` is passed to `new Response()`, piped into a
`TransformStream`, or even being read out of in code by using `stream.getReader()`.

The `ReadableStream` in question is a [BYOB stream](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_byte_streams)
(`type: bytes`) that is obtained from calling `ReactServerDOMServer.renderToReadableStream()` from React 19, which
is responsible for rendering a server-side React data structure into a streamable format called a "flight stream".
This is a new format of serializing data in React 19, which can include values and component trees. In React 19, a
server-side React component tree can include components whose render function can be `async`.

## The set-up

The `App` component in this project is such a component - it is written as an `async` function. It is written to
perform some tasks during its render function, some of which are themselves `async`.

The tasks are:
* `fetchTodos` - using fetch() to obtain a list of todos
* `kvstore` - reading a value from the KV Store
* `delay` - a 1ms delay

By default, these tasks are performed in this order: `fetchTodos,kvstore`.

When deployed to production, this causes the component to often (but not always) crash. If it does crash, this happens
after it logs `Before fetchTodos` but before it is able to log `After fetchtTodos`. The caller receives either an error
code `502` with the body `I/O error`, or sometimes code `200` with just a partial body that is not closed cleanly
(`PROTOCOL_ERROR`).

## Variations

This project allows you to run these tasks in any order by supplying the query parameter `actions=`. For example, by
specifying `?actions=kvstore,fetchTodos,delay`, it's possible to get the `App` component to perform the task of
attempting to read from the KV store first.

My findings are the following:

* On Viceroy
   - it can crash if you access the KV store first.
      ```
      curl "http://127.0.0.1:7676?actions=kvstore"
      curl "http://127.0.0.1:7676?actions=kvstore,fetchTodos"
      curl "http://127.0.0.1:7676?actions=kvstore,delay"
      curl "http://127.0.0.1:7676?actions=kvstore,fetchTodos,delay"
      curl "http://127.0.0.1:7676?actions=kvstore,delay,fetchTodos"
      ```
   - it won't crash if you do the fetch first.
      ```
      curl "http://127.0.0.1:7676?actions=fetchTodos"
      curl "http://127.0.0.1:7676?actions=fetchTodos,kvstore"
      curl "http://127.0.0.1:7676?actions=fetchTodos,delay"
      curl "http://127.0.0.1:7676?actions=fetchTodos,kvstore,delay"
      curl "http://127.0.0.1:7676?actions=fetchTodos,delay,kvstore"
      ```
   - it won't crash if you do the delay first.
      ```
      curl "http://127.0.0.1:7676?actions=delay"
      curl "http://127.0.0.1:7676?actions=delay,fetchTodos"
      curl "http://127.0.0.1:7676?actions=delay,kvstore"
      curl "http://127.0.0.1:7676?actions=delay,fetchTodos,kvstore"
      curl "http://127.0.0.1:7676?actions=delay,kvstore,fetchTodos"
      ```

* On production
   - it can crash if you do the fetch first.
      ```
      curl "https://rsc-demo-compute.edgecompute.app?actions=fetchTodos"
      curl "https://rsc-demo-compute.edgecompute.app?actions=fetchTodos,kvstore"
      curl "https://rsc-demo-compute.edgecompute.app?actions=fetchTodos,delay"
      curl "https://rsc-demo-compute.edgecompute.app?actions=fetchTodos,kvstore,delay"
      curl "https://rsc-demo-compute.edgecompute.app?actions=fetchTodos,delay,kvstore"
      ```
   - it won't crash if you do the KV store first.
      ```
      curl "https://rsc-demo-compute.edgecompute.app?actions=kvstore"
      curl "https://rsc-demo-compute.edgecompute.app?actions=kvstore,fetchTodos"
      curl "https://rsc-demo-compute.edgecompute.app?actions=kvstore,delay"
      curl "https://rsc-demo-compute.edgecompute.app?actions=kvstore,fetchTodos,delay"
      curl "https://rsc-demo-compute.edgecompute.app?actions=kvstore,delay,fetchTodos"
      ```
  - it won't crash if you do the delay first.
      ```
      curl "https://rsc-demo-compute.edgecompute.app?actions=delay"
      curl "https://rsc-demo-compute.edgecompute.app?actions=delay,fetchTodos"
      curl "https://rsc-demo-compute.edgecompute.app?actions=delay,kvstore"
      curl "https://rsc-demo-compute.edgecompute.app?actions=delay,fetchTodos,kvstore"
      curl "https://rsc-demo-compute.edgecompute.app?actions=delay,kvstore,fetchTodos"
      ```

## Summary

Reading from the `ReadableStream` resulting from `ReactServerDOMServer.renderToReadableStream()` from React 19
may sometimes crash while rendering a React Server Component that is `async`:

* On Viceroy, if it performs an async read of the KV Store as its first `await`.
* On Production, if it performs an async fetch from a backend as its first `await`.
* This may not be exhaustive, there may be other things that may cause crashes.
* On both platforms, if the first `await` is for a `Promise` that resolves after a short `setTimeout` delay, then
  there is no crash. 
* On both platforms, this only happens on `@fastly/js-compute` 3.28.0 or newer.
* On both platforms, this has been fixed in `@fastly/js-compute` 3.32.2 or newer.

## Resolution

This was discovered to be a [bug in the JavaScript SDK](https://github.com/fastly/js-compute-runtime/pull/1129), and
has been fixed by the team.

The [fix has been released in `@fastly/js-compute` 3.32.2](https://github.com/fastly/js-compute-runtime/releases/tag/v3.32.2)
