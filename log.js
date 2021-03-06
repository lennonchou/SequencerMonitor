var log4js = require('log4js');
var os = require('os');
//console log is loaded by default, so you won't normally need to do this
//log4js.loadAppender('console');
log4js.loadAppender('file');
//log4js.addAppender(log4js.appenders.console());
log4js.addAppender(log4js.appenders.file('cfda.log'), 'CFDA');

var logger = log4js.getLogger('CFDA');
// var reflection = {
//   'trace' : logger.trace,'debug' : logger.debug,'info' : logger.info,'warn' : logger.warn,'error' : logger.error,'fatal' : logger.fatal
// };
var level = 'trace';
logger.setLevel(level);
var getLocation = function() {
  const myObject = {};
  Error.captureStackTrace(myObject);
  var location = myObject.stack.split(os.EOL)[3];
  return location;
};
module.exports = {
  d: function(msg) {
    logger.debug(msg + getLocation());
  },
  e: function(msg) {
    logger.error(msg + getLocation());
  },
  i: function(msg) {
    logger.info(msg + getLocation());
  }
};
