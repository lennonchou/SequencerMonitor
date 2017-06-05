var connection = require('../mysqlConnection');
var mysql = require('mysql');
var helper = require('../helper.js');
var async = require('async');
var log = require('../log.js');
var _ = require('underscore');
var multer = require('multer');
var xls2json = require('xls-to-json-lc');
var xlsx2json = require('xlsx-to-json');
var Q = require('q');

exports.create = function (req, res) {
    // create new sample label
    var body = req.body;
    var patientId = body.patientId;
    var sampleNumber = body.sampleNumber;
    var material = body.material;
    var site = body.site;
    var tumorCellContent = body.tumorCellContent;
    var pathologicDiagnosis = body.pathologicDiagnosis;
    var orderingPhysician = body.orderingPhysician;
    var inspectionDate = body.inspectionDate;
    var comment = body.comment;
    // need to change later
    var confirmed = req.confirmed || true;
    if (!helper.validationCheck([patientId, sampleNumber, inspectionDate])) {
        return res.status(400).json({ success: false, error: '请输入所有必填项', message: 'Missing key parameters' });
    } else {
        connection.myQuery(helper.constructSelectSQL(['status AS fileStatus', 'id AS fileId'], 'File', [{ name: 'sampleNumber', exact: 1 }]), [sampleNumber])
            .then(function (file) {
                // require user to confirm?
                if (!file.length && !confirmed) {
                    return res.json({ success: false, error: '找不到对应的bam文件，请确认这是正确的样本号', message: 'Cannot find matching file, please verify' });
                }
                var columns = ['patientId', 'sampleNumber', 'material', 'site', 'tumorCellContent', 'pathologicDiagnosis', 'inspectionDate', 'orderingPhysician', 'comment', 'createTime'];
                return connection.myQuery(helper.constructInsertSQL(columns, 'Sample'),
                    [patientId, sampleNumber, material, site, tumorCellContent, pathologicDiagnosis, inspectionDate, orderingPhysician, comment]);
            })
            .then(function (result) {
                var id = result.insertId;
                return res.json({ success: true, sampleId: id });
            })
            .fail(function (err) {
                if (err.message.indexOf('ER_DUP') != -1) {
                    return res.status(500).json({ success: false, error: '样本编号重复', message: err.message || 'Unknown' });
                }
                log.d('Error when creating new sample: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            });
    }
};

exports.batchCreate = function (req, res) {
    var storage = multer.diskStorage({
        destination: function (req, file, callback) {
            callback(null, 'batch');
        },
        filename: function (req, file, callback) {
            var timeStamp = Date.now();
            callback(null, file.fieldname + '_by_' + req.payload.user.username + '_' + timeStamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1]);
        }
    });
    var upload = multer({
        storage: storage,
        fileFilter: function (req, file, callback) { //file filter
            if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
                return callback(new Error('Wrong extension type(不是合法的Excel文件)'));
            }
            callback(null, true);
        }
    }).single('template');
    var offset = req.body.offset || 0;
    var excel2json;
    upload(req, res, function (err) {
        if (err) {
            log.d('Error when uploading batch samples: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        }
        if (req.file.originalname.split('.')[req.file.originalname.split('.').length - 1] === 'xlsx') {
            excel2json = xlsx2json;
        } else {
            excel2json = xls2json;
        }
        try {
            excel2json({
                input: req.file.path,
                output: null,
                lowerCaseHeaders: false
            }, function (err, results) {
                if (err) {
                    log.d('Error when parsing batch file: ' + err.message);
                    return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
                }
                console.log(offset);
                console.log(results);
                results = _processBatchJSON(results, offset);
                // console.log(results);
                // return res.json({results: results});
                async.parallel(_.map(results, function (result) {
                    return (function (callback) {
                        // check the must fields
                        // specify the error, like missing parameters or encounter duplicates
                        var selectPatientColumns = _.map(['name', 'hospitalNumber', 'pathologicNumber'], function (item) {
                            return { name: item, exact: 1 };
                        });
                        var selectPatientSQL = helper.constructSelectSQL(['id'], 'Patient', selectPatientColumns);
                        var selectPatientParams = [result.name, result.hospitalNumber, result.pathologicNumber];

                        var insertPatientColumns = ['name', 'dob', 'estimated', 'gender', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'comment', 'createTime'];
                        var insertPatientSQL = helper.constructInsertSQL(insertPatientColumns, 'Patient');
                        var insertPatientParams = [result.name, result.dob, result.estimated, result.gender, result.hospitalNumber, result.pathologicNumber,
                        result.clinicalDiagnosis, result.patientComment];

                        var insertSampleColumns = ['patientId', 'sampleNumber', 'material', 'site', 'tumorCellContent', 'pathologicDiagnosis', 'inspectionDate', 'orderingPhysician', 'comment', 'createTime']
                        var insertSampleSQL = helper.constructInsertSQL(insertSampleColumns, 'Sample');
                        var insertSampleParams = [result.sampleNumber, result.material, result.site, result.tumorCellContent,
                        result.pathologicDiagnosis, result.inspectionDate, result.orderingPhysician, result.sampleComment];

                        if (!helper.validationCheck([result.name, result.hospitalNumber, result.pathologicNumber, result.dob, result.sampleNumber, result.inspectionDate])) {
                            console.log('missing something');
                            callback(null, '缺少必要项，不能插入' + (result.index + 1) + '号样本');
                        }
                        connection.myTransactionQuery(selectPatientSQL, selectPatientParams, insertPatientSQL, insertPatientParams, insertSampleSQL, insertSampleParams)
                            .then(function (result) {
                                return callback(null, null);
                            })
                            .fail(function (err) {
                                var message = err.message;
                                if (message.indexOf('ER_DUP') != -1) {
                                    return callback(null, message);
                                }
                                return callback(err, null);
                            });
                    });
                }), function (err, results) {
                    if (err) {
                        log.d('Error when batch uploading samples: ' + err.message);
                        return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
                    }
                    // console.log(results);
                    var duplicates = [];
                    var missing = [];
                    _.each(results, function (result) {
                        if (result !== null && result.indexOf('ER_DUP') != -1) {
                            duplicates.push(result.split("'")[1]);
                        } else if (result !== null) {
                            missing.push(result);
                        }
                    });
                    return res.json({ success: true, duplicates: duplicates, missing: missing });
                });
            });
        } catch (err) {
            log.d('Error when parsing batch file: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        }
    });
};

function _processBatchJSON(results, offset) {
    try {
        return _.map(results, function (result, index) {
            return {
                index: index,
                name: result['*姓名'],
                // if the dob exists, take the dob as dob. Otherwise, use the age to calculate the dob
                dob: result['生日'].length ? helper.getISOFromClientDOB(result['生日'], offset).toISOString() : helper.getISOFromClientAge(result['年龄'], offset).toISOString(),
                estimated: !result['生日'].length,
                gender: result['性别'],
                hospitalNumber: result['*住院号'],
                pathologicNumber: result['*病理号'],
                clinicalDiagnosis: result['临床诊断'],
                patientComment: result['患者备注'],
                sampleNumber: result['*样本编号'],
                material: result['送检材料'],
                site: result['取材部位'],
                tumorCellContent: result['肿瘤细胞含量%'],
                pathologicDiagnosis: result['病理诊断'],
                orderingPhysician: result['送检医师'],
                inspectionDate: result['*送检日期'].length ? helper.getISOFromClient(result['*送检日期'], offset).toISOString() : null,
                sampleComment: result['样本备注']
            }
        });
    } catch (err) {
        throw new Error(err);
    }
}

// function _fromSlash2Dash(slashDate) {
//     var dashDate = slashDate.split('/').reverse();
//     _swap(dashDate, 1, 2);
//     return dashDate.join('-');
// }

// function _swap(array, x, y) {
//     var temp = array[x];
//     array[x] = array[y];
//     array[y] = temp;
// }

// function insertPatientAndSample(patientsAndSample) {
//     var deferred = Q.defer();
//     var patientColumns = ['name', 'dob', 'gender', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'comment', 'createTime'];
//     var patientUpdateColumns = ['clinicalDiagnosis', 'comment'];
//     connection.myQuery(helper.constructInsertOrUpdateSQL(patientColumns, 'Patient', patientUpdateColumns),
//         [patientsAndSample.name, patientsAndSample.dob, patientsAndSample.gender, patientsAndSample.hospitalNumber, patientsAndSample.pathologicNumber,
//         patientsAndSample.clinicalDiagnosis, patientsAndSample.comment, patientsAndSample.clinicalDiagnosis, patientsAndSample.comment])
//         .then(function (row) {
//             var id = row.insertId;
//             var sampleColumns = ['patientId', 'sampleNumber', 'material', 'site', 'tumorCellContent', 'pathologicDiagnosis', 'inspectionDate', 'comment', 'createTime'];
//             return connection.myQuery(helper.constructInsertSQL(sampleColumns, 'Sample'),
//                 [id, patientsAndSample.sampleNumber, patientsAndSample.material, patientsAndSample.site, patientsAndSample.tumorCellContent,
//                     patientsAndSample.pathologicDiagnosis, patientsAndSample.inspectionDate, patientsAndSample.comment]);
//         })
//         .then(function (result) {

//         })
//         .fail(function (err) {
//             log.d('Error when creating new patient and sample: ' + patientsAndSample.name + ' + ' + patientsAndSample.sampleNumber + ' with ' + err.message);
//             return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
//         });
//     return deferred.promise;
// };

exports.edit = function (req, res) {
    // edit sample label
    var body = req.body;
    var patientId = body.patientId;
    // var sampleNumber = body.sampleNumber;
    var material = body.material;
    var site = body.site;
    var tumorCellContent = body.tumorCellContent;
    var pathologicDiagnosis = body.pathologicDiagnosis;
    var orderingPhysician = body.orderingPhysician;
    // var inspectionDate = body.inspectionDate;
    var comment = body.comment;
    var id = body.id;
    if (!helper.validationCheck([id])) {
        return res.status(400).json({ success: false, error: '请输入所有必填项', message: 'Missing key parameters' });
    } else {
        connection.myQuery(helper.constructUpdateSQL(['material', 'site', 'tumorCellContent', 'pathologicDiagnosis', 'orderingPhysician', 'comment'], 'Sample', [{ name: 'id', exact: 1 }]),
            [material, site, tumorCellContent, pathologicDiagnosis, orderingPhysician, comment, id])
            .then(function (result) {
                return res.json({ success: true, sampleId: id });
            })
            .fail(function (err) {
                if (err.message.indexOf('ER_DUP') != -1) {
                    return res.status(500).json({ success: false, error: '样本编号重复', message: err.message || 'Unknown' });
                }
                log.d('Error when creating new sample: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            });
    }
};

exports.delete = function (req, res) {
    var body = req.body;
    var id = body.id;
    if (!helper.validationCheck([id])) {
        return res.status(400).json({ success: false, error: '请输入正确的样本id', message: 'Missing id' });
    }
    connection.myQuery('DELETE FROM Sample WHERE id = ?', [id])
        .then(function (result) {
            if (result.affectedRows) {
                return res.json({ success: true, deletedId: id });
            }
            log.d('Cannot delete because there is no such sample');
            return res.status(401).json({ success: false, error: '没有此样本', message: 'No such sample' });
        })
        .fail(function (err) {
            log.d('Error when deleting exsting sample: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

exports.search = function (req, res) {
    // search based on name, gender, hospitalNumber, pathologicNumber
    var keys = [];
    var values = [];
    var columns = ['Patient.id', 'Patient.name', 'gender', 'dob', 'estimated', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'Patient.comment AS patientComment',
        'Sample.id AS sampleId', 'Sample.sampleNumber', 'material', 'site', 'tumorCellContent', 'orderingPhysician', 
        'pathologicDiagnosis', 'inspectionDate', 'Sample.comment AS sampleComment', 'File.status AS sampleStatus', 'File.url'];
    var name = req.query.name;
    var gender = req.query.gender;
    var hospitalNumber = req.query.hospitalNumber;
    var pathologicNumber = req.query.pathologicNumber;
    var inspectionDateLow = req.query.inspectionDateLow;
    var inspectionDateHigh = req.query.inspectionDateHigh;
    var sampleNumber = req.query.sampleNumber;
    if (name && name.length) {
        keys.push({ name: 'Patient.name' });
        values.push('%' + name + '%');
    }
    // if (gender && gender.length) {
    //     keys.push({ name: 'Patient.gender', exact: 1 });
    //     values.push(gender);
    // }
    if (hospitalNumber && hospitalNumber.length) {
        keys.push({ name: 'Patient.hospitalNumber' });
        values.push(hospitalNumber + '%');
    }
    if (pathologicNumber && pathologicNumber.length) {
        keys.push({ name: 'Patient.pathologicNumber' });
        values.push(pathologicNumber + '%');
    }
    if (inspectionDateLow && inspectionDateLow.length) {
        keys.push({ name: 'Sample.inspectionDate', low: 1 });
        values.push(inspectionDateLow);
    }
    if (inspectionDateHigh && inspectionDateHigh.length) {
        keys.push({ name: 'Sample.inspectionDate', high: 1 });
        values.push(inspectionDateHigh);
    }
    if (sampleNumber && sampleNumber.length) {
        keys.push({ name: 'Sample.sampleNumber' });
        values.push(sampleNumber + '%');
    }
    var sql = helper.constructSelectSQL(columns, 'Patient JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber', keys);
    var limit = parseInt(req.query.limit) || 20;
    var page = parseInt(req.query.page) || 1;
    var orderBy = req.query.orderBy || 'name';
    var totalPage = parseInt(req.query.totalPage) || -1;
    async.parallel({
        samples: function (callback) {
            connection.myQuery(sql + ' ORDER BY ' + orderBy + ' LIMIT ?, ?', values.concat([(page - 1) * limit, limit]))
                .then(function (rows) {
                    samples = [];
                    _.each(rows, function (sample) {
                        samples.push({
                            patientId: sample.id,
                            name: sample.name,
                            age: helper.calAge(sample.dob),
                            dob: helper.backToISO(sample.dob),
                            estimated: sample.estimated,
                            gender: sample.gender,
                            hospitalNumber: sample.hospitalNumber,
                            pathologicNumber: sample.pathologicNumber,
                            clinicalDiagnosis: sample.clinicalDiagnosis,
                            patientComment: sample.patientComment,
                            sampleId: sample.sampleId,
                            sampleNumber: sample.sampleNumber,
                            material: sample.material,
                            site: sample.site,
                            tumorCellContent: sample.tumorCellContent,
                            pathologicDiagnosis: sample.pathologicDiagnosis,
                            orderingPhysician: sample.orderingPhysician,
                            inspectionDate: helper.backToISO(sample.inspectionDate),
                            sampleComment: sample.sampleComment,
                            status: helper.getSampleStatus(sample.sampleStatus),
                            url: sample.url
                        });
                    });
                    callback(null, samples);
                })
                .fail(function (err) {
                    callback(err, null);
                });
        },
        totalPage: function (callback) {
            if (totalPage != -1) {
                callback(null, req.query.totalPage);
            } else {
                connection.myQuery(helper.constructSelectSQL(['COUNT(*) AS count'], 'Patient JOIN Sample ON Patient.id = Sample.patientId', keys), values)
                    .then(function (result) {
                        callback(null, Math.ceil(result[0].count / limit));
                    })
                    .fail(function (err) {
                        callback(err, null);
                    });
            }
        }
    },
        function (err, results) {
            if (err) {
                log.d('Error when searching sample: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            } else {
                results.success = true;
                return res.json(results);
            }
        });
};

exports.retrieve = function (req, res) {
    var columns = ['Patient.id', 'Patient.name', 'gender', 'dob', 'estimated', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'Patient.comment AS patientComment',
        'Sample.id AS sampleId', 'Sample.sampleNumber', 'material', 'site', 'tumorCellContent', 'orderingPhysician', 
        'pathologicDiagnosis', 'inspectionDate', 'Sample.comment AS sampleComment', 'File.status AS sampleStatus', 'File.url'];
    var id = req.query.id;
    connection.myQuery(helper.constructSelectSQL(columns, 'Patient JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber',
        [{ name: 'Sample.id', exact: 1 }]), [id])
        .then(function (rows) {
            var sample = (rows && rows.length) ? {
                patientId: rows[0].id,
                name: rows[0].name,
                age: helper.calAge(rows[0].dob),
                dob: helper.backToISO(rows[0].dob),
                estimated: row[0].estimated,
                gender: rows[0].gender,
                hospitalNumber: rows[0].hospitalNumber,
                pathologicNumber: rows[0].pathologicNumber,
                clinicalDiagnosis: rows[0].clinicalDiagnosis,
                patientComment: rows[0].patientComment,
                sampleId: rows[0].sampleId,
                sampleNumber: rows[0].sampleNumber,
                material: rows[0].material,
                site: rows[0].site,
                tumorCellContent: rows[0].tumorCellContent,
                pathologicDiagnosis: rows[0].pathologicDiagnosis,
                orderingPhysician: row[0].orderingPhysician,
                inspectionDate: helper.backToISO(rows[0].inspectionDate),
                sampleComment: rows[0].sampleComment,
                status: helper.getSampleStatus(rows[0].sampleStatus),
                url: rows[0].url
            } :
                'No such sample, please verify';
            return res.json({ success: true, sample: sample });
        })
        .fail(function (err) {
            log.d('Error when retrieving sample info: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

exports.getWaitingToProcess = function (req, res) {
    var columns = ['Patient.id', 'Patient.name', 'gender', 'dob', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'Patient.comment AS patientComment',
        'Sample.id AS sampleId', 'Sample.sampleNumber', 'material', 'site', 'tumorCellContent', 'Sample.priority', 
        'pathologicDiagnosis', 'inspectionDate', 'Sample.comment AS sampleComment', 'File.status AS sampleStatus'];
    var lowBound = -19;
    var highBound = 0;
    var orderBy = req.query.orderBy || 'priority';
    var limit = req.query.limit || 20;
    var page = req.query.page || 1;
    var totalPage = req.query.totalPage || -1;
    async.parallel({
        samples: function (callback) {
            connection.myQuery(helper.constructSelectSQL(columns, 'Patient JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber',
                [{ name: 'File.status', low: 1 }, { name: 'File.status', high: 1 }]) + ' ORDER BY ' + orderBy + ' DESC LIMIT ?, ?', [lowBound, highBound, (page - 1) * limit, limit])
                .then(function (rows) {
                    samples = _.map(rows, function (sample) {
                        return {
                            patientId: sample.id,
                            name: sample.name,
                            gender: sample.gender,
                            age: helper.calAge(sample.dob),
                            hospitalNumber: sample.hospitalNumber,
                            pathologicNumber: sample.pathologicNumber,
                            clinicalDiagnosis: sample.clinicalDiagnosis,
                            patientComment: sample.patientComment,
                            sampleId: sample.sampleId,
                            sampleNumber: sample.sampleNumber,
                            material: sample.material,
                            site: sample.site,
                            tumorCellContent: sample.tumorCellContent,
                            pathologicDiagnosis: sample.pathologicDiagnosis,
                            inspectionDate: helper.backToISO(sample.inspectionDate),
                            sampleComment: sample.sampleComment,
                            status: helper.getSampleStatus(sample.sampleStatus),
                            url: sample.url,
                            priority: sample.priority
                        };
                    });
                    callback(null, samples);
                })
                .fail(function (err) {
                    callback(err, null);
                });
        },
        totalPage: function (callback) {
            if (totalPage != -1) {
                callback(null, totalPage);
            } else {
                connection.myQuery(helper.constructSelectSQL(['COUNT(*) AS count'], 'Patient JOIN Sample ON Patient.id = Sample.patientId JOIN File ON Sample.sampleNumber = File.sampleNumber',
                    [{ name: 'File.status', low: 1 }, { name: 'File.status', high: 1 }]), [lowBound, highBound])
                    .then(function (result) {
                        callback(null, Math.ceil(result[0].count / limit));
                    })
                    .fail(function (err) {
                        callback(err, null);
                    });
            }
        }
    },
        function (err, results) {
            if (err) {
                log.d('Error when getting waiting to process sample: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            } else {
                results.success = true;
                return res.json(results);
            }
        });
};

exports.getWaitingToConfirm = function (req, res) {
    var columns = ['Patient.id', 'Patient.name', 'gender', 'dob', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'Patient.comment AS patientComment',
        'Sample.id AS sampleId', 'Sample.sampleNumber', 'material', 'site', 'tumorCellContent',
        'pathologicDiagnosis', 'inspectionDate', 'Sample.comment AS sampleComment', 'File.status AS sampleStatus', 'File.url'];
    var waitingToConfirm = 2;
    var orderBy = req.query.orderBy || 'name';
    var limit = req.query.limit || 20;
    var page = req.query.page || 1;
    var totalPage = req.query.totalPage || -1;
    var operation = '确认';
    async.parallel({
        samples: function (callback) {
            connection.myQuery(helper.constructSelectSQL(columns, 'Patient JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber',
                [{ name: 'File.status', exact: 1 }]) + ' ORDER BY ' + orderBy + ' LIMIT ?, ?', [waitingToConfirm, (page - 1) * limit, limit])
                .then(function (rows) {
                    samples = _.map(rows, function (sample) {
                        return {
                            patientId: sample.id,
                            name: sample.name,
                            gender: sample.gender,
                            age: helper.calAge(sample.dob),
                            hospitalNumber: sample.hospitalNumber,
                            pathologicNumber: sample.pathologicNumber,
                            clinicalDiagnosis: sample.clinicalDiagnosis,
                            patientComment: sample.patientComment,
                            sampleId: sample.sampleId,
                            sampleNumber: sample.sampleNumber,
                            material: sample.material,
                            site: sample.site,
                            tumorCellContent: sample.tumorCellContent,
                            pathologicDiagnosis: sample.pathologicDiagnosis,
                            inspectionDate: helper.backToISO(sample.inspectionDate),
                            sampleComment: sample.sampleComment,
                            // should be '确认' instead of the original status
                            status: helper.getSampleStatus(sample.sampleStatus),
                            url: sample.url
                        };
                    });
                    callback(null, samples);
                })
                .fail(function (err) {
                    callback(err, null);
                });
        },
        totalPage: function (callback) {
            if (totalPage != -1) {
                callback(null, totalPage);
            } else {
                connection.myQuery(helper.constructSelectSQL(['COUNT(*) AS count'], 'Patient JOIN Sample ON Patient.id = Sample.patientId JOIN File ON Sample.sampleNumber = File.sampleNumber',
                    [{ name: 'File.status', exact: 1 }]), [waitingToConfirm])
                    .then(function (result) {
                        callback(null, Math.ceil(result[0].count / limit));
                    })
                    .fail(function (err) {
                        callback(err, null);
                    });
            }
        }
    },
        function (err, results) {
            if (err) {
                log.d('Error when getting waiting to confirm sample: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            } else {
                results.success = true;
                return res.json(results);
            }
        });
};

exports.confirm = function (req, res) {
    var body = req.body;
    var id = body.sampleId;
    var waitingToConfirm = 2;
    var confirmed = 3;
    connection.myQuery(helper.constructUpdateSQL(['File.status'], 'Sample JOIN File ON Sample.sampleNumber = File.sampleNumber', 
        [{ name: 'Sample.id', exact: 1 }, {name: 'File.status', exact: 1}]), [confirmed, id, waitingToConfirm])
        .then(function (result) {
            if (result.affectedRows) {
                return res.json({ success: true, confirmedId: id });
            }
            log.d('Cannot confirm because there is no matching sample');
            return res.status(401).json({ success: false, error: '没有此样本', message: 'No such sample' });
        })
        .fail(function (err) {
            log.d('Error when confirming exsting sample: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

exports.prioritize = function (req, res) {
    var body = req.body;
    var id = body.sampleId;
    var lowBound = -19;
    var highBound = 0;
    connection.myQuery(helper.constructSelectSQL(['Sample.priority', 'Sample.id'], 'Sample JOIN File ON Sample.sampleNumber = File.sampleNumber',
        [{ name: 'File.status', low: 1 }, { name: 'File.status', high: 1 }]) + ' ORDER BY priority DESC LIMIT 1', [lowBound, highBound])
        .then(function(rows) {
            var nextPriorityLevel = 1;
            if (rows && rows.length) {
                if (rows[0].id == id) {
                    nextPriorityLevel = rows[0].priority;
                } else {
                    nextPriorityLevel = rows[0].priority + 1;
                }
            }
            return connection.myQuery(helper.constructUpdateSQL(['Sample.priority'], 'Sample JOIN File ON Sample.sampleNumber = File.sampleNumber', 
            [{name: 'Sample.id', exact: 1}, { name: 'File.status', low: 1 }, { name: 'File.status', high: 1 }]), [nextPriorityLevel, id, lowBound, highBound]);
        })
        .then(function(rows) {
            if (rows.affectedRows) {
                return res.json({success: true, prioritizedId: id});
            }
            log.d('Cannot prioritize this sample');
            return res.status(401).json({success: false, error: '找不到此样本', message: 'Cannot prioiritize this sample'});
        })
        .fail(function(err) {
            log.d('Error when getting waiting to process sample: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        }) 
};

exports.getPDF = function (req, res) {
    // no usage right now
    var id = req.query.id;
    // get the pdf file url to the report
    connection.myQuery(helper.constructSelectSQL(['File.url'], 'Sample JOIN File ON Sample.sampleNumber = File.sampleNumber', [{ name: 'Sample.id', exact: 1 }]), [id])
        .then(function (result) {
            if (result && result.length) {
                return res.json({ sucess: true, file: result[0].url });
            }
            log.d('Cannot get file');
            return res.status(401).json({ success: true, error: 'No such pdf file yet' });
        })
        .fail(function (err) {
            log.d('Error when getting report: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        })
};