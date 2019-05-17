function hrTimeToMs([s, ns]) {
  return s * 1e3 + ns * 1e-6; // convert to ms
}

module.exports = { hrTimeToMs };
