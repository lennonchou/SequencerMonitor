var connection = require('../mysqlConnection.js');
var mysql = require('mysql');
var _ = require('underscore');
var log = require('../log.js');
var helper = require('../helper.js');
var async = require('async');

// exports.create = function (req, res) {
//     // create patient info
//     var body = req.body;
//     var name = body.name;
//     var dob = body.dob;
//     var gender = body.gender;
//     var hospitalNumber = body.hospitalNumber;
//     var pathologicNumber = body.pathologicNumber;
//     var clinicalDiagnosis = body.clinicalDiagnosis;
//     var comment = body.comment;
//     // validation check
//     if (!helper.validationCheck([name, hospitalNumber, pathologicNumber])) {
//         return res.status(400).json({ success: false, error: '请输入所有必填项', message: 'Missing key parameters' });
//     } else {
//         connection.myQuery(helper.constructInsertSQL(['name', 'dob', 'gender', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'comment', 'createTime'], 'Patient'),
//             [name, dob, gender, hospitalNumber, pathologicNumber, clinicalDiagnosis, comment])
//             .then(function (row) {
//                 var id = row.insertId;
//                 return res.json({ success: true, patientId: id });
//             })
//             .fail(function (err) {
//                 if (err.message.indexOf('ER_DUP') != -1) {
//                     return res.status(500).json({ success: false, error: '患者住院号或病理号重复', message: err.message || 'Unknown' });
//                 }
//                 log.d('Error when creating new patient: ' + err.message);
//                 return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
//             });
//     }
// };

exports.create = function (req, res) {
    // create patient info and sample info
    var body = req.body;
    var name = body.name;
    var dob = body.dob;
    var estimated = body.estimated;
    var gender = body.gender;
    var hospitalNumber = body.hospitalNumber;
    var pathologicNumber = body.pathologicNumber;
    var clinicalDiagnosis = body.clinicalDiagnosis;
    var patientComment = body.patientComment;
    var sampleNumber = body.sampleNumber;
    var material = body.material;
    var site = body.site;
    var tumorCellContent = body.tumorCellContent;
    var pathologicDiagnosis = body.pathologicDiagnosis;
    var inspectionDate = body.inspectionDate;
    var orderingPhysician = body.orderingPhysician;
    var sampleComment = body.sampelComment;
    // validation check
    if (!helper.validationCheck([name, hospitalNumber, pathologicNumber, sampleNumber, inspectionDate, dob])) {
        return res.status(400).json({ success: false, error: '请输入所有必填项', message: 'Missing key parameters' });
    } else {
        var selectPatientColumns = _.map(['name', 'hospitalNumber', 'pathologicNumber'], function (item) {
            return { name: item, exact: 1 };
        });
        var selectPatientSQL = helper.constructSelectSQL(['id'], 'Patient', selectPatientColumns);
        var selectPatientParams = [name, hospitalNumber, pathologicNumber];

        var insertPatientColumns = ['name', 'dob', 'estimated', 'gender', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'comment', 'createTime'];
        var insertPatientSQL = helper.constructInsertSQL(insertPatientColumns, 'Patient');
        var insertPatientParams = [name, dob, estimated, gender, hospitalNumber, pathologicNumber, clinicalDiagnosis, patientComment];

        var insertSampleColumns = ['patientId', 'sampleNumber', 'material', 'site', 'tumorCellContent', 'pathologicDiagnosis', 'inspectionDate', 'orderingPhysician', 'comment', 'createTime']
        var insertSampleSQL = helper.constructInsertSQL(insertSampleColumns, 'Sample');
        var insertSampleParams = [sampleNumber, material, site, tumorCellContent, pathologicDiagnosis, inspectionDate, orderingPhysician, sampleComment];
        connection.myTransactionQuery(selectPatientSQL, selectPatientParams, insertPatientSQL, insertPatientParams, insertSampleSQL, insertSampleParams)
            .then(function (row) {
                return res.json({ success: true });
            })
            .fail(function (err) {
                if (err.message.indexOf('ER_DUP') != -1) {
                    return res.status(500).json({ success: false, error: '患者信息或者样本信息重复', message: err.message || 'Unknown' });
                }
                log.d('Error when creating new patient: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            });
    }
};

exports.edit = function (req, res) {
    // edit patient info
    var body = req.body;
    var name = body.name;
    var dob = body.dob;
    var estimated = body.estimated;
    var gender = body.gender;
    var hospitalNumber = body.hospitalNumber;
    var pathologicNumber = body.pathologicNumber;
    var clinicalDiagnosis = body.clinicalDiagnosis;
    var comment = body.comment;
    var id = body.id;
    if (!helper.validationCheck([name, hospitalNumber, pathologicNumber, id, dob])) {
        return res.status(400).json({ success: false, error: 'Missing key parameters' });
    } else {
        connection.myQuery(helper.constructUpdateSQL(['name', 'dob', 'estimated', 'gender', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'comment'], 'Patient', [{ name: 'id', exact: 1 }]),
            [name, dob, estimated, gender, hospitalNumber, pathologicNumber, clinicalDiagnosis, comment, id])
            .then(function (result) {
                return res.json({ success: true });
            })
            .fail(function (err) {
                if (err.message.indexOf('ER_DUP') != -1) {
                    return res.status(500).json({ success: false, error: '患者住院号或病理号重复', message: err.message || 'Unknown' });
                }
                log.d('Error when editing exsting patient: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            });
    }
};

exports.delete = function (req, res) {
    // delete one patient
    var body = req.body;
    var id = body.id;
    if (!helper.validationCheck([id])) {
        return res.status(400).json({ success: false, error: 'Missing id' });
    }
    connection.myQuery('DELETE FROM Patient WHERE id = ?', [id])
        .then(function (result) {
            if (result.affectedRows) {
                return connection.myQuery('DELETE FROM Sample WHERE patientId = ?', [id]);
            }
            log.d('Cannot delete because there is no such patient');
            return res.status(401).json({ success: false, error: '没有此患者', message: 'No such patient' });
        })
        .then(function (result) {
            return res.json({ success: true, deletedId: id });
        })
        .fail(function (err) {
            log.d('Error when deleting exsting patient: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        })
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
    if (gender && gender.length) {
        keys.push({ name: 'Patient.gender', exact: 1 });
        values.push(gender);
    }
    if (hospitalNumber && hospitalNumber.length) {
        keys.push({ name: 'Patient.hospitalNumber' });
        values.push(hospitalNumber + '%');
    }
    if (pathologicNumber && pathologicNumber.length) {
        keys.push({ name: 'Patient.pathologicNumber' });
        values.push(pathologicNumber + '%');
    }
    // if (inspectionDateLow && inspectionDateLow.length) {
    //     keys.push({ name: 'Sample.inspectionDate', low: 1 });
    //     values.push(pathologicNumber);
    // }
    // if (inspectionDateHigh && inspectionDateHigh.length) {
    //     keys.push({ name: 'Sample.inspectionDate', high: 1 });
    //     values.push(pathologicNumber);
    // }
    // if (sampleNumber && sampleNumber.length) {
    //     keys.push({ name: 'Sample.sampleNumber', exact: 1});
    //     values.push(sampleNumber);
    // }
    var sql = helper.constructSelectSQL(columns, 'Patient LEFT JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber', keys);
    var limit = parseInt(req.query.limit) || 20;
    var page = parseInt(req.query.page) || 1;
    var orderBy = req.query.orderBy || 'name';
    var totalPage = parseInt(req.query.totalPage) || -1;
    async.parallel({
        patients: function (callback) {
            connection.myQuery(sql + ' ORDER BY ' + orderBy + ' LIMIT ?, ?', values.concat([(page - 1) * limit, limit]))
                .then(function (rows) {
                    patients = [];
                    // _.each(_.groupBy(rows, function (row) { return row.id; }), function (patient) {
                    //     patients.push({
                    //         id: patient[0].id,
                    //         name: patient[0].name,
                    //         age: helper.calAge(patient[0].dob),
                    //         dob: patient[0].dob,
                    //         gender: patient[0].gender,
                    //         hospitalNumber: patient[0].hospitalNumber,
                    //         pathologicNumber: patient[0].pathologicNumber,
                    //         clinicalDiagnosis: patient[0].clinicalDiagnosis,
                    //         patientComment: patient[0].patientComment,
                    //         samples: patient[0].sampleNumber ?
                    //             _.map(patient, function (sample) {
                    //                 return {
                    //                     sampleId: sample.sampleId,
                    //                     sampleNumber: sample.sampleNumber,
                    //                     material: sample.material,
                    //                     site: sample.site,
                    //                     tumorCellContent: sample.tumorCellContent,
                    //                     pathologicDiagnosis: sample.pathologicDiagnosis,
                    //                     inspectionDate: sample.inspectionDate,
                    //                     sampleComment: sample.sampleComment,
                    //                     status: helper.getSampleStatus(sample.sampleStatus),
                    //                     url: sample.url
                    //                 };
                    //             }) :
                    //             null
                    //     });
                    // });
                    _.each(rows, function (sample) {
                        patients.push({
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
                    callback(null, patients);
                })
                .fail(function (err) {
                    callback(err, null);
                });
        },
        totalPage: function (callback) {
            if (totalPage != -1) {
                callback(null, req.query.totalPage);
            } else {
                connection.myQuery(helper.constructSelectSQL(['COUNT(*) AS count'], 'Patient LEFT JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber', keys), values)
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
                log.d('Error when searching patient: ' + err.message);
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
    connection.myQuery(helper.constructSelectSQL(columns, 'Patient LEFT JOIN Sample ON Patient.id = Sample.patientId LEFT JOIN File ON Sample.sampleNumber = File.sampleNumber',
        [{ name: 'Patient.id', exact: 1 }]), [id])
        .then(function (rows) {
            var patient = (rows && rows.length) ? {
                id: rows[0].id,
                name: rows[0].name,
                age: helper.calAge(rows[0].dob),
                dob: helper.backToISO(dob),
                estimated: rows[0].estimated,
                gender: rows[0].gender,
                hospitalNumber: rows[0].hospitalNumber,
                pathologicNumber: rows[0].pathologicNumber,
                clinicalDiagnosis: rows[0].clinicalDiagnosis,
                patientComment: rows[0].patientComment,
                samples: rows[0].sampleNumber ?
                    _.map(rows, function (sample) {
                        return {
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
                        };
                    }) :
                    null
            } :
                'No such patient, please verify';
            return res.json({ success: true, patient: patient });
        })
        .fail(function (err) {
            log.d('Error when retrieving patient info: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

// exports.list = function (req, res) {
//     // list the existing patients, deprecated
//     var limit = req.query.limit || 20;
//     var page = req.query.page || 1;
//     var orderBy = req.query.orderBy || 'name';
//     var totalPage = parseInt(req.query.totalPage) || -1;
//     var columns = ['Patient.name', 'gender', 'dob', 'hospitalNumber', 'pathologicNumber', 'clinicalDiagnosis', 'Patient.comment AS patientComment', 'sampleNumber', 'material', 'site', 'tumorCellContent',
//         'pathologicDiagnosis', 'inspectionDate', 'Sample.comment AS sampleComment', 'Sample.status AS sampleStatus'];
//     async.parallel({
//         patients: function (callback) {
//             connection.myQuery(helper.constructSelectSQL(columns, 'Patient LEFT JOIN Sample ON Patient.id = Sample.patientId', []) + ' ORDER BY ? LIMIT ?, ?',
//                 [orderBy, (page - 1) * limit, limit])
//                 .then(function (rows) {
//                     patients = [];
//                     _.each(rows, function (patient) {
//                         patients.push({
//                             id: patient.id,
//                             name: patient.name,
//                             dob: patient.dob,
//                             gender: patient.gender,
//                             hospitalNumber: patient.hospitalNumber,
//                             pathologicNumber: patient.pathologicNumber,
//                             clinicalDiagnosis: patient.clinicalDiagnosis,
//                             patientComment: patient.patientComment,
//                             sampleNumber: patient.sampleNumber,
//                             material: patient.material,
//                             site: patient.site,
//                             tumorCellContent: patient.tumorCellContent,
//                             pathologicDiagnosis: patient.pathologicDiagnosis,
//                             inspectionDate: patient.inspectionDate,
//                             sampleComment: patient.sampleComment,
//                             status: patient.sampleStatus
//                         });
//                     });
//                     callback(null, patients);
//                 })
//                 .fail(function (err) {
//                     callback(err, null);
//                 });
//         },
//         totalPage: function (callback) {
//             if (totalPage != -1) {
//                 callback(null, req.query.totalPage);
//             } else {
//                 connection.myQuery('SELECT count(*) AS count FROM Patient')
//                     .then(function (result) {
//                         callback(null, Math.ceil(result[0].count / limit));
//                     })
//                     .fail(function (err) {
//                         callback(err, null);
//                     });
//             }
//         }
//     },
//         function (err, results) {
//             if (err) {
//                 log.d('Error when getting patient list');
//                 return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
//             } else {
//                 return res.json(results);
//             }
//         });
// };