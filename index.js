const urlParse = require('url').parse;
const onHeaders = require('on-headers');
const uuidv4 = require('uuid/v4');
const regexparam = require('regexparam');
const prettyTime = require('pretty-time');

function hrTimeToMs([s, ns]) {
  return s * 1e3 + ns * 1e-6; // convert to ms
}

function initMiddleware(opts = {}) {
  const stats = {
    uuid: uuidv4(),
    pid: process.pid,
    totalTime: 0,
    averageTime: 0,
    count: 0
  };

  const statusCodes = {};
  const endpointStats = {};
  const complexEndpoints =
    (opts.complexEndpoints &&
      opts.complexEndpoints.map(path => ({ ...regexparam(path), path }))) ||
    [];
  const customStats = {};

  function getStats() {
    const result = {
      uptime: process.uptime() * 1e3, // convert to ms
      uptimeHumanReadable: prettyTime(Math.floor(process.uptime() * 1e9)),
      statusCodes,
      ...stats
    };
    if (opts.endpointStats) {
      result.endpointStats = endpointStats;
    }
    if (opts.customStats) {
      result.customStats = customStats;
    }
    return result;
  }

  function startMeasurement(name) {
    if (!customStats[name]) {
      customStats[name] = {
        totalTime: 0,
        averageTime: 0,
        started: 0,
        count: 0
      };
    }
    customStats[name].started++;
    return { start: process.hrtime(), name };
  }

  function finishMeasurement({ name, start }) {
    const time = hrTimeToMs(process.hrtime(start));
    customStats[name].totalTime += time;
    customStats[name].count++;
    customStats[name].averageTime =
      customStats[name].totalTime / customStats[name].count;
  }

  function statsMiddleware(req, res, next) {
    const requestStart = process.hrtime();

    if (opts.customStats) {
      req.startMeasurement = startMeasurement;
      req.finishMeasurement = finishMeasurement;
    }

    onHeaders(res, () => {
      const time = hrTimeToMs(process.hrtime(requestStart));

      if (opts.addHeader) {
        if (!res.getHeader('X-Response-Time')) {
          res.setHeader('X-Response-Time', `${time.toFixed(0)}ms`);
        }
      }

      stats.totalTime += time;
      stats.count++;
      stats.averageTime = stats.totalTime / stats.count;
      statusCodes[res.statusCode] = statusCodes[res.statusCode]
        ? statusCodes[res.statusCode] + 1
        : 1;

      if (opts.endpointStats) {
        // prefer using `req.originalUrl` as some frameworks replace `req.url`
        const url = req.originalUrl || req.url;
        let path = urlParse(url).pathname;
        const complexPath = complexEndpoints.find(endpoint =>
          endpoint.pattern.test(path)
        );
        path = complexPath ? complexPath.path : path;
        const endpoint = `${req.method} ${path}`;

        if (!endpointStats[endpoint]) {
          endpointStats[endpoint] = {
            totalTime: 0,
            averageTime: 0,
            count: 0,
            statusCodes: {}
          };
        }

        endpointStats[endpoint].totalTime += time;
        endpointStats[endpoint].count++;
        endpointStats[endpoint].averageTime =
          endpointStats[endpoint].totalTime / endpointStats[endpoint].count;
        const eStatusCodes = endpointStats[endpoint].statusCodes;
        eStatusCodes[res.statusCode] = eStatusCodes[res.statusCode]
          ? eStatusCodes[res.statusCode] + 1
          : 1;
      }
    });

    next();
  }
  return { getStats, statsMiddleware };
}

module.exports = initMiddleware;
