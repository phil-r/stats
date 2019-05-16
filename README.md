# stats

> Request statistics middleware

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
  complexEndpoints: ['/user/:id']
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

## Example

Here is the example of usage in express app

```js
const app = require('express')();
const initStats = require('@phil-r/stats');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id']
});

app.use(statsMiddleware);
app.get('/', (req, res) => res.end('Hello'));
app.get('/user/:id', (req, res) => res.end(`Hello ${req.params.id}`));
app.get('/stats', (req, res) => res.send(getStats()));

app.listen(8080);
console.log('Server listens at http://localhost:8080');
```

Visiting http://localhost:8080/stats will give following result:

```json
{
  "uptime": 57977,
  "statusCodes": {
    "200": 14,
    "404": 13
  },
  "uuid": "2cea3742-a822-4bd4-89fb-5d8ddcfb52ed",
  "pid": 84476,
  "totalTime": 32.093976999999995,
  "averageTime": 1.1886658148148146,
  "count": 27,
  "endpointStats": {
    "GET /": {
      "totalTime": 11.413813,
      "averageTime": 2.2827626,
      "count": 5,
      "statusCodes": {
        "200": 5
      }
    },
    "GET /favicon.ico": {
      "totalTime": 15.848935,
      "averageTime": 1.2191488461538462,
      "count": 13,
      "statusCodes": {
        "404": 13
      }
    },
    "GET /user/:id": {
      "totalTime": 4.831229,
      "averageTime": 0.5368032222222223,
      "count": 9,
      "statusCodes": {
        "200": 9
      }
    }
  }
}
```

All time related results are in milliseconds

# [License](LICENSE)

This is a fork of [zenmate/stats](https://github.com/zenmate/stats)

# Inspired by

[`expressjs/response-time`](https://github.com/expressjs/response-time) and [`thoas/stats`](https://github.com/thoas/stats)
