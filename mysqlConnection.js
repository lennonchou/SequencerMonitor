var log = require('./log.js');
var settings = require('./settings');
var Q = require('q');
var mysql = require('mysql');
var helper = require('./helper.js');
var pool = mysql.createPool(settings.mysqlPool);

exports.myQuery = function myQuery(sql, params) {

  var deferred = Q.defer();
  pool.getConnection(function (err, connection) {

    if (err) {
      log.d('Error in connection with database: ' + err.message);
      err.message = 'Failed to make connection';
      deferred.reject(new Error(err));
      return;
    }
    log.d('Connection success');
    var query = mysql.format(sql, params);
    log.d('Query = ' + query);
    connection.query(query, function (err, rows) {
      //release the connection regardless
      connection.release();
      if (!err) {
        //if no error, put result into promise
        deferred.resolve(rows);
      } else {
        //if error, put error into promise
        log.d('Error in query: ' + err.message);
        // err.message = 'Query error';
        deferred.reject(new Error(err));
      }
    });
    connection.removeAllListeners('error');
    //error handler for connection
    connection.on('error', function (err) {
      log.d('Connection error: ' + err.message);
      try {
        connection.release();
      } catch (e) {
        log.d('Connection release error: ' + e.message);
      }
      err.message = 'Connection internal error';
      deferred.reject(new Error(err));
      return;
    });
  });

  return deferred.promise;
};

exports.myTransactionQuery = function myQuery(selectSQL, selectParams, insertPatientSQL, insertPatientParams, insertSampleSQL, insertSampleParams) {

  var deferred = Q.defer();
  pool.getConnection(function (err, connection) {

    if (err) {
      log.d('Error in connection with database: ' + err.message);
      err.message = 'Failed to make connection';
      deferred.reject(new Error(err));
      return;
    }
    log.d('Connection success');
    connection.beginTransaction(function (err) {
      if (err) {
        return deferred.reject(new Error(err));
      }
      var selectPatient = mysql.format(selectSQL, selectParams);
      log.d('SelectPatientQuery = ' + selectPatient);
      connection.query(selectPatient, function (err, patient) {
        // console.log(err);
        if (!err) {
          //if no error, query the next sql
          if (patient && patient.length) {
            var values = [patient[0].id];
            var insertSample = mysql.format(insertSampleSQL, values.concat(insertSampleParams));
            log.d('InsertSampleQuery = ' + insertSample);
            connection.query(insertSample, function (err, result) {
              if (err) {
                return connection.rollback(function () {
                  log.d('Error in InsertSampleQuery: ' + err.message);
                  deferred.reject(new Error(err));
                });
              }
              connection.commit(function (err) {
                if (err) {
                  return connection.rollback(function () {
                    log.d('Error in commit: ' + err.message);
                    deferred.reject(new Error(err));
                  });
                }
                connection.release();
                return deferred.resolve(result);
              });
            });
          } else {
            var insertPatient = mysql.format(insertPatientSQL, insertPatientParams);
            log.d('InsertPatientQuery = ' + insertPatient);
            connection.query(insertPatient, function (err, patient) {
              if (err) {
                return connection.rollback(function () {
                  log.d('Error in InsertPatientQuery: ' + err.message);
                  deferred.reject(new Error(err));
                });
              }
              var values = [patient.insertId];
              var insertSample = mysql.format(insertSampleSQL, values.concat(insertSampleParams));
              log.d('InsertSampleQuery = ' + insertSample);
              connection.query(insertSample, function (err, result) {
                if (err) {
                  return connection.rollback(function () {
                    log.d('Error in InsertSampleQuery: ' + err.message);
                    deferred.reject(new Error(err));
                  });
                }
                connection.commit(function (err) {
                  if (err) {
                    return connection.rollback(function () {
                      log.d('Error in commit: ' + err.message);
                      deferred.reject(new Error(err));
                    });
                  }
                  connection.release();
                  return deferred.resolve(result);
                });
              });
            });
          }
        } else {
          //if error, rollback the change and put error into promise
          return connection.rollback(function () {
            log.d('Error in SelectPatientQuery: ' + err.message);
            // err.message = 'Query error';
            deferred.reject(new Error(err));
          });
        }
      });
    });
    connection.removeAllListeners('error');
    //error handler for connection
    connection.on('error', function (err) {
      log.d('Connection error: ' + err.message);
      try {
        connection.release();
      } catch (e) {
        log.d('Connection release error: ' + e.message);
      }
      err.message = 'Connection internal error';
      deferred.reject(new Error(err));
      return;
    });
  });

  return deferred.promise;
};

(function () {
  // var str = 'Error: ER_DUP_ENTRY: Duplicate entry \'MAK2\' for key \'sampleNumber_UNIQUE\'';
  // console.log(str.split("'")[1] + str.split("'")[3]);
  //   var result = { comment: '',
  //     name: 'Dendi',
  //     dob: '',
  //     gender: 'male',
  //     hospitalNumber: '',
  //     pathologicNumber: '',
  //     clinicalDiagnosis: '',
  //     sampleNumber: 'MAK1',
  //     material: 'what',
  //     site: 'so',
  //     tumorCellContent: 'ever',
  //     pathologicDiagnosis: '',
  //     inspectionDate: '' };
  // var result = {
  //   name: 'Bieber',
  //   dob: '3/4/99',
  //   gender: 'male',
  //   hospitalNumber: '',
  //   pathologicNumber: '',
  //   clinicalDiagnosis: ''
  // };
  // var patientColumns = ['name', 'dob', 'gender', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'comment', 'createTime'];
  // var patientUpdateColumns = ['clinicalDiagnosis', 'comment'];
  // var sql1 = helper.constructInsertOrUpdateSQL(patientColumns, 'Patient', patientUpdateColumns);
  // var params1 = [result.name, result.dob, result.gender, result.hospitalNumber, result.pathologicNumber,
  // result.clinicalDiagnosis, result.comment, result.clinicalDiagnosis, result.comment];
  // exports.myQuery(sql1, params1)
  //   .then(function (result) {
  //     console.log(result);
  //   })
  //   .fail(function (err) {
  //     console.log(err);
  //   });
  //   var sampleColumns = ['patientId', 'sampleNumber', 'material', 'site', 'tumorCellContent', 'pathologicDiagnosis', 'inspectionDate', 'comment', 'createTime']
  //   var sql2 = helper.constructInsertSQL(sampleColumns, 'Sample');
  //   var params2 = [result.sampleNumber, result.material, result.site, result.tumorCellContent,
  //   result.pathologicDiagnosis, result.inspectionDate, result.comment];
  //   exports.myTransactionQuery(sql1, params1, sql2, params2)
  //   .then(function(result) {
  //     console.log(result);
  //   })
  //   .fail(function(err) {
  //     console.log('this is the test error: ' + err.message);
  //   })
  // exports.myQuery(helper.constructInsertSQL(['dateTest'], 'A'), ['2017-2-3T00:00:00'])
  // .then(function(row) {
  //   var id = row.insertId;
  //   return exports.myQuery(helper.constructSelectSQL(['dateTest'], 'A', [{name: 'id', exact: 1}]), [id]);
  // })
  // .then(function(selectRow) {
  //   if (selectRow && selectRow.length) {
  //     var date = new Date(selectRow[0].dateTest);
  //     console.log(date);
  //     console.log(helper.backToISO(selectRow[0].dateTest));
  //   } else {
  //     console.log('error');
  //   }

  // });
  // exports.myQuery(helper.constructSelectSQL(['dateTest'], 'A', [{ name: 'id', low: 1 }]), [0])
  //   .then(function (rows) {
  //     if (rows && rows.length) {
  //       var date = new Date(rows[0].dateTest);
  //       var today = new Date();
  //       console.log('select date in local date time ' + date.toString());
  //       var year = date.getFullYear();
  //       var month = date.getMonth(); // getMonth() is zero-indexed, so we'll increment to get the correct month number
  //       var day = date.getDate();
  //       var hours = date.getHours();
  //       var minutes = date.getMinutes();
  //       var seconds = date.getSeconds();
  //       var newDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  //       var anotherNewDate = new Date(date.setMinutes(minutes - date.getTimezoneOffset()));
  //       console.log(new Date(newDate.toISOString()).toString());
  //       console.log('UTC construct method ' + newDate.toISOString());
  //       console.log('another method ISO ' + anotherNewDate.toISOString());
  //       console.log('date after change ' + date.toISOString());
  //       console.log('another method: ' + anotherNewDate);
  //       console.log({date: rows[0].dateTest});
  //     }
  //   });
})();