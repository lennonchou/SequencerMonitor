var path = require('path');
var log = require('../log.js');

exports.batchForm = function (req, res) {
    var filePath = path.join(__dirname, '../form/BlankTemplate.xlsx');

    res.download(filePath, 'Template.xlsx', function(err) {
        if (err) {
            if (res.headersSent) {
                log.d('Form downloaded may be partially damaged');
                res.status(500).json({success: false, error: 'Patially damaged', message: err.message});
            } else {
                log.d('Error when downloading batch upload form');
                res.status(500).json({success: false, error: 'Cannot get file', message: err.message});
            }
        }
    });
}