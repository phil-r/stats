# stats

> Request statistics middleware

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Installation

```bash
npm i @zenmate/stats
```

## API

```js
const initStats = require('@zenmate/stats');
const { statsMiddleware, getStats } = initStats({ endpointStats: true });
```

### initStats([options])

Returns `statsMiddleware` middleware function and `getStats` function,
that returns current stats

#### Options

`initStats` accepts optional `options` object that may contain any of the following keys:

##### endpointStats

Defaults to `false`

Boolean that indicates wether to track per endpoint stats.

**Not recommended** for complex applications and applications
that have endpoints like `/user/123`


## Example

Here is the example of usage in express app

```js
const app = require('express')();
const initStats = require('@zenmate/stats');

const { statsMiddleware, getStats } = initStats({ endpointStats: true });

app.use(statsMiddleware);
app.get('/', (req,res) => res.end('Hello'));
app.get('/stats', (req,res) => res.send(getStats()));

app.listen(8080);
console.log('Server listens at http://localhost:8080');
```

Visiting http://localhost:8080/stats will give following result:

```json
{
  "uptime": 10485,
  "statusCodes": {
    "200": 6,
    "404": 1
  },
  "uuid": "b6797718-eb11-48e4-941f-8348ccf8d9ed",
  "pid": 20797,
  "totalTime": 10.537291,
  "averageTime": 1.5053272857142856,
  "count": 7,
  "endpointStats": {
    "GET /": {
      "totalTime": 7.486513999999999,
      "averageTime": 1.2477523333333331,
      "count": 6,
      "statusCodes": {
        "200": 6
      }
    },
    "GET /favicon.ico": {
      "totalTime": 3.050777,
      "averageTime": 3.050777,
      "count": 1,
      "statusCodes": {
        "404": 1
      }
    }
  }
}
```

All time related results are in milliseconds


# [License](LICENSE)

# Inspired by
[`expressjs/response-time`](https://github.com/expressjs/response-time) and [`thoas/stats`](https://github.com/thoas/stats)
