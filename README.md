# stats

> Request statistics middleware

[![build status](https://img.shields.io/travis/phil-r/stats/master.svg?style=flat-square)](https://travis-ci.org/phil-r/stats)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Installation

```bash
npm i @phil-r/stats
```

## API

```js
const initStats = require('@phil-r/stats');
const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});
```

### initStats([options])

Returns `statsMiddleware` middleware function and `getStats` function,
that returns current stats

#### Options

`initStats` accepts optional `options` object that may contain any of the following keys:

##### endpointStats

Defaults to `false`

Boolean that indicates whether to track per endpoint stats.

##### complexEndpoints

Defaults to `[]`

Used in conjunction with `endpointStats`

Use it in case your application has routes with params or wildcard routes

**Recommended** for applications that have endpoints like `/user/123`

##### customStats

Defaults to `false`

Adds `startMeasurement` and `finishMeasurement` functions to the request objects
and allows measuring any parts of the app.

**Usage:**

```js
function handler(req, res) {
  const measurement = req.startMeasurement('measurementName');
  // Some code...
  req.finishMeasurement(measurement);
}
```

##### addHeader

Defaults to `false`

Adds `X-Response-Time` header to all responses, can be used to replace
[`expressjs/response-time`](https://github.com/expressjs/response-time)

## Full example

Here is the example of usage in express app

```js
const app = require('express')();
const initStats = require('@phil-r/stats');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});

app.use(statsMiddleware);
app.get('/', (req, res) => res.end('Hello'));
app.get('/user/:id', (req, res) => res.end(`Hello ${req.params.id}`));
app.get('/long', async (req, res) => {
  const measurement = req.startMeasurement('long');
  await new Promise(resolve => {
    setTimeout(() => resolve(), 2000);
  });
  req.finishMeasurement(measurement);
  res.end(`Long job finished`);
});
app.get('/stats', (req, res) => res.send(getStats()));

app.listen(8080);
console.log('Server listens at http://localhost:8080');
```

Visiting http://localhost:8080/stats will give following result:

```json
{
  "uptime": 63881,
  "uptimeHumanReadable": "1m 4s",
  "statusCodes": {
    "200": 5,
    "404": 4
  },
  "uuid": "330d9cc6-7d40-4964-888c-4d2817905ee1",
  "pid": 90603,
  "totalTime": 4020.3912830000004,
  "averageTime": 446.7101425555556,
  "count": 9,
  "endpointStats": {
    "GET /long": {
      "totalTime": 4009.410922,
      "averageTime": 2004.705461,
      "count": 2,
      "statusCodes": {
        "200": 2
      }
    },
    "GET /favicon.ico": {
      "totalTime": 4.286955,
      "averageTime": 1.07173875,
      "count": 4,
      "statusCodes": {
        "404": 4
      }
    },
    "GET /stats": {
      "totalTime": 6.227342999999999,
      "averageTime": 6.227342999999999,
      "count": 1,
      "statusCodes": {
        "200": 1
      }
    },
    "GET /user/:id": {
      "totalTime": 0.466063,
      "averageTime": 0.2330315,
      "count": 2,
      "statusCodes": {
        "200": 2
      }
    }
  },
  "customStats": {
    "long": {
      "totalTime": 4005.556455,
      "averageTime": 2002.7782275,
      "started": 2,
      "count": 2
    }
  }
}
```

All time related results are in milliseconds

# [License](LICENSE)

This is a fork of [zenmate/stats](https://github.com/zenmate/stats)

# Inspired by

[`expressjs/response-time`](https://github.com/expressjs/response-time) and [`thoas/stats`](https://github.com/thoas/stats)
