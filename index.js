const onHeaders = require('on-headers');
const uuidv4 = require('uuid/v4');

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

  function getStats() {
    const result = {
      uptime: process.uptime() * 1e3, // convert to ms
      statusCodes,
      ...stats
    };
    if (opts.endpointStats) {
      result.endpointStats = endpointStats;
    }
    return result;
  }

  function statsMiddleware(req, res, next) {
    const requestStart = process.hrtime();

    onHeaders(res, () => {
      const [s, ns] = process.hrtime(requestStart);
      const time = s * 1e3 + ns * 1e-6; // convert to ms
      const endpoint = `${req.method} ${req.path}`;

      stats.totalTime += time;
      stats.count++;
      stats.averageTime = stats.totalTime / stats.count;
      statusCodes[res.statusCode] = statusCodes[res.statusCode]
        ? statusCodes[res.statusCode] + 1
        : 1;

      if (opts.endpointStats) {
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
