
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var router = require('./urls.js');
var cors = require('cors');
var log = require('./log.js');
var app = express();


// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
// app.use(bodyParser.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/pdf', express.static(path.join(__dirname, 'pdf')));
app.use('/manual', express.static(path.join(__dirname, 'manual')));
// console.log(path.join(__dirname, 'img'));

app.options('*', cors());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(function (req, res, next) {
  if (req.method === 'POST') {
    log.d('POST Body: ');
    log.d(JSON.stringify(req.body));
  }

  // if ((typeof req.body) == 'string') {
  //   var text = req.body;
  //   if (text && text.length) {
  //     try {
  //       req.body = JSON.parse(text);
  //     } catch (e) {
  //       log.d('Error when parsing the body');
  //       res.status(500).json({ success: false, error: e.code });
  //     }
  //     console.log('req.body = '+req.body)
  //   }
  // }
  next();
});
// for batch upload testing only
app.get('/', function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.use('/api', router);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  // log.d('No page is found');
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers


if (app.get('env') === 'development') {
  // development error handler will print stacktrace
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      info: err.stack,
      status: err.status
    });
  });
} else {
  // production error handler no stacktraces leaked to user
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      status: err.status
    });
  });
}




module.exports = app;
