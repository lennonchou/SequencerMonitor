var connection = require('../mysqlConnection.js');
var _ = require('underscore');
var log = require('../log.js');
var helper = require('../helper.js');
var async = require('async');
var diskspace = require('diskspace');
var jsonfile = require('jsonfile');
var Q = require('q');
var os = require('os');
var svninfo = require('svn-info');
var fs = require('fs');
var toJSON = require('plain-text-data-to-json');

exports.getStatus = function (req, res) {
    var path = os.platform() === 'win32' ? 'C' : '/SGI';
    diskspace.check(path, function (err, total, free, status) {
        if (err) {
            log.d('Error when getting system info');
            return res.status(500).json({ success: false, code: '硬盘状态不可知，请检查硬盘', message: err.message || 'unknown disk error' });
        }
        return res.json({ success: true, total: total, free: free, status: status });
    });
};

exports.getVersion = function (req, res) {
    var versionFile = './package.json';
    var revisionFile = './svninfo.txt';
    _getVersion(versionFile, revisionFile)
    .then(function(result) {
        return res.json({success: true, version: result.join('.')});
    })
    .fail(function (err) {
        return res.status(500).json({ success: false, code: '不能读取版本号，可能是由于文件损坏，请检查', message: err.message || 'unknown reading error' });
    });
};

// (function createRevisionFile() {
//     svninfo(function(err, info) {
//         if (err) {
//             log.d('Error when getting svn revision, maybe a stable non-svn version: ' + err.message);
//         }
//         // console.log(info);
//         fs.access(__dirname + '/../svn_revision.json', function(err) {
//             if (err && err.code !== 'ENOENT') {
//                 log.d('Do not have access to write the revision file: ' + err.message);
//             }
//             jsonfile.writeFile(__dirname + '/../svn_revision.json', info, function(err) {
//                 if (err) {
//                     log.d('Error when writing svn revision file: ' + err.message);
//                 }
//             });
//         });
//     });
// })();

function _getVersion(versionFile, revisionFile) {
    var deferred = Q.defer();
    var result = [];
    jsonfile.readFile(versionFile, function (err, version) {
        if (err) {
            log.d('Cannot read version');
            return deferred.reject(new Error(err));
        }
        result.push(version.version);
        fs.readFile(revisionFile, 'UTF-8', function (err, revisionData) {
            if (err) {
                log.d('Cannot read revision');
                return deferred.reject(new Error(err));
            }
            // xmlParser.toJson(revisionData, function (err, revision) {
            //     if (err) {
            //         log.d('Cannot parse the revision xml');
            //         return deferred.reject(new Error(err));
            //     }
            //     console.log(revision);
            //     result.push(revision.info.entry.revision);
            //     deferred.resolve(result);
            // })
            try {
                var revisionJson = toJSON(revisionData);
                revision = revisionJson['Last Changed Rev'];
                result.push(revision);
                return deferred.resolve(result);
            } catch (err) {
                log.d('Cannot parse xml');
                return deferred.reject(new Error(err));
            }
        })
    })
    return deferred.promise;
}