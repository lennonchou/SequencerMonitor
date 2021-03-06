var _ = require('underscore');
var async = require('async');
var connection = require('../mysqlConnection.js');
var helper = require('../helper.js');

exports.getUnlinkedFiles = function (req, res) {
    var columns = ['File.id', 'File.status', 'File.sampleNumber', 'File.bamFileLocation'];
    var orderBy = req.query.orderBy || 'id';
    var limit = req.query.limit || 20;
    var page = req.query.page || 1;
    var totalPage = req.query.totalPage || -1;
    async.parallel({
        files: function (callback) {
            connection.myQuery(helper.constructSelectSQL(columns, 'File LEFT JOIN Sample ON File.sampleNumber = Sample.sampleNumber') + ' WHERE Sample.sampleNumber IS NULL ORDER BY ' + orderBy + ' LIMIT ?, ?', 
            [(page - 1) * limit, limit])
                .then(function (rows) {
                    files = _.map(rows, function (file) {
                        return {
                            id: file.id,
                            status: helper.getSampleStatus(file.status),
                            sampleNumber: file.sampleNumber,
                            bamFileName: file.bamFileLocation ? _.last(file.bamFileLocation.split('/')) : null
                        };
                    });
                    callback(null, files);
                })
                .fail(function (err) {
                    callback(err, null);
                });
        },
        totalPage: function (callback) {
            if (totalPage != -1) {
                callback(null, totalPage);
            } else {
                connection.myQuery(helper.constructSelectSQL(['COUNT(*) AS count'], 'File LEFT JOIN Sample ON File.sampleNumber = Sample.sampleNumber') + ' WHERE Sample.sampleNumber IS NULL')
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