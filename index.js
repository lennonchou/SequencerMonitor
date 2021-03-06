#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('./app');
var settings = require('./settings');
// var system = require('./webRouter/system.js');

var log = require('./log');
var debug = require('debug')('CFDA:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3100');
app.set('port', port);

app.set('env', settings.env);
/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  log.d('Listening on ' + bind);
  // debug('Listening on ' + bind);
}

// var SMS = require('./ServerAPI');
// var sms = new SMS('b29e3cc6cd58dd161d705e99886f3547', 'ee700a33e2ac');
// sms.verifycode({mobile: '1355555555', code: '12345'}, function(code) {
//   console.log(code);
// });
