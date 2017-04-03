var express = require('express');
var router = express.Router();
var log = require('./log.js');
var jwt = require('jsonwebtoken');
var settings = require('./settings');
var path = require('path');

var patient = require('./webRouter/patient.js');
var sample = require('./webRouter/sample.js');
var user = require('./webRouter/user.js');
var file = require('./webRouter/file.js');
var system = require('./webRouter/system.js');
var download = require('./webRouter/downloadable.js');

router.post('/user/sign_in', user.signIn);
router.get('/system/version', system.getVersion);

// router middleware to verify a token
if (settings.authON) {
  log.d('Auth is on');
  router.use(function (req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    // decode token
    if (token) {
      log.d('Has token: ' + token);
      // verifies secret and checks exp
      jwt.verify(token, settings.secretKey, function (err, payload) {

        if (err) {
          // handle error
          log.d('Error when decrypting token');
          return res.status(401).json({
            success: false,
            error: 'Invalid token'
          });
        } else {
          // if everything is good, save to request for use in other routes
          log.d('PAYLOAD: ' + JSON.stringify(payload));
          req.payload = payload;
          next();
        }
      });

    } else {
      log.d('Has no token')
      // if there is no token
      // return an error
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });

    }
  });
} else {
  log.d('Auth is off')
  router.use(function (req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    // decode token
    if (token) {
      log.d('Has token: ' + token);
      // verifies secret and checks exp
      jwt.verify(token, settings.secretKey, function (err, payload) {

        if (err) {
          // handle error
          log.d('Error when decrypting token');
          return res.status(401).json({
            success: false,
            error: 'Invalid token'
          });
        } else {
          // if everything is good, save to request for use in other routes
          log.d('PAYLOAD: ' + JSON.stringify(payload));
          req.payload = payload;
          next();
        }
      });

    } else {
      log.d('Has no token, making fake payload')
      // if there is no token
      // return an error
      req.payload = {
        user: {
          userId: 1,
          level: 0,
          username: 'admin'
        }
      };
      next();
    }
  });
}

router.use(function (req, res, next) {
  switch (req.payload.user.level) {
    case 0:
      router.post('/user/create', user.create);
      router.post('/user/edit', user.edit);
      router.post('/user/delete', user.delete);
      router.get('/user/search', user.search);
      router.get('/user/retrieve', user.retrieve);

      router.post('/patient/edit', patient.edit);
      router.post('/patient/delete', patient.delete);
      // router.get('/patient/list', patient.list);

      router.post('/sample/edit', sample.edit);
      router.post('/sample/delete', sample.delete);
      router.post('/sample/confirm', sample.confirm);
    case 1:
      router.post('/patient/create', patient.create);
      router.post('/sample/create', sample.create);
      router.post('/sample/batch_create', sample.batchCreate);
    case 2:
      router.post('/user/reset_password', user.resetPwd);

      router.get('/patient/retrieve', patient.retrieve);
      router.get('/patient/search', patient.search);
      router.get('/sample/retrieve', sample.retrieve);
      router.get('/sample/search', sample.search);
      // router.get('/sample/pdf', sample.getPDF);
      router.get('/sample/waiting_to_process', sample.getWaitingToProcess);
      router.get('/sample/waiting_to_confirm', sample.getWaitingToConfirm);

      router.get('/file/unlinked', file.getUnlinkedFiles);

      router.get('/system/status', system.getStatus);

      router.get('/form/download', download.batchForm);
  }
  next();
})







module.exports = router;

(function () {
  //     connection.myQuery(helper.constructSelectSQL(['createTime'], 'User', [{name: 'username', exact: 1}]), ['admin']) 
  //     .then(function (result) {
  //         console.log(typeof result[0].createTime);
  //     })
  // var level = 0;
  // switch(level) {
  //   case 0:
  //     console.log('Highest level');
  //   case 1:
  //     console.log('Middle level');
  //   case 2:
  //     console.log('Lowest level');
  //   default:
  //     console.log('Bottom');
  // }    
})();