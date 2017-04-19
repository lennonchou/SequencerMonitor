var _ = require('underscore');

exports.constructSelectSQL = function (columns, table, fields) {
    if (typeof columns !== 'undefined' && columns !== null && typeof table !== 'undefined' && table !== null) {
        var sql = 'SELECT ' + columns.join(', ') + ' FROM ' + table + (fields && fields.length ? ' WHERE ' : '');
        condition = _.map(fields, function (field) {
            var compare = field.exact ? ' = ' : (field.low ? ' >= ' : (field.high ? ' <= ' : ' LIKE '));
            return field.name + compare + '?';
        });
        var conditions = condition.join(' AND ')
        return sql + conditions;
    }
    return null;
};

exports.constructInsertSQL = function (columns, table) {
    if (typeof columns !== 'undefined' && columns !== null && typeof table !== 'undefined' && table !== null) {
        var sql = 'INSERT INTO ' + table + ' SET ';
        var insert = _.map(columns, function (column) {
            if (column == 'createTime') {
                return column + ' = now()';
            }
            return column + ' = ?';
        });
        return sql + insert.join(', ');
    }
    return null;
};

exports.constructUpdateSQL = function (columns, table, fields) {
    if (typeof columns !== 'undefined' && columns !== null && typeof table !== 'undefined' && table !== null) {
        var sql = 'UPDATE ' + table + ' SET ';
        var update = _.map(columns, function (column) {
            return column + ' = ?';
        }).join(', ');
        conditions = _.map(fields, function (field) {
            var compare = field.exact ? ' = ' : (field.low ? ' >= ' : (field.high ? ' <= ' : ' LIKE '));
            return field.name + compare + '?';
        }).join(' AND ');
        return sql + update + (fields && fields.length ? ' WHERE ' : '') + conditions;
    }
    return null;
};

exports.constructInsertOrUpdateSQL = function (columns, table, updateColumns) {
    if (typeof columns !== 'undefined' && columns !== null && typeof table !== 'undefined' && table !== null && typeof table !== 'undefined' && table !== null) {
        var sql = 'INSERT INTO ' + table + ' SET ';
        var insert = _.map(columns, function (column) {
            if (column == 'createTime') {
                return column + ' = now()';
            }
            return column + ' = ?';
        });
        var middle = ' ON DUPLICATE KEY UPDATE ';
        var update = _.map(updateColumns, function (updateColumn) {
            return updateColumn + ' = ?';
        });
        return sql + insert.join(', ') + middle + update.join(', ');
    }
    return null;
};

exports.validationCheck = function (values) {
    return _.every(values, function (value) {
        if (typeof value === 'string') {
            return (typeof value !== 'undefined' && value !== null && value.length > 0);
        }
        return (typeof value !== 'undefined' && value !== null);
    });
};

exports.validateRangeInclusive = function (numbers) {
    return _.every(numbers, function (number) {
        return number.value >= number.low && number.value <= number.high;
    })
}

exports.calAge = function (dob) {
    if (typeof dob === 'undefined' || dob === null) {
        return null;
    }
    var dob = exports.backToISO(dob);
    var today = new Date();
    var age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() - dob.getMonth() < 0 || (today.getMonth() - dob.getMonth() == 0 && today.getDate() - dob.getDate() < 0)) {
        age--;
    }
    return age;
};

exports.getSampleStatus = function (status) {
    var lowBound = -20;
    if (status == null) {
        // return 'Not found';
        return '没有对应文件';
    } else if (status == lowBound) {
        // return 'Error';
        return '异常';
    } else if (status <= 0) {
        // return 'Waiting to process';
        return '待分析';
    } else if (status == 1) {
        // return 'Processing';
        return '分析中';
    } else if (status == 2) {
        // return 'Waiting to confirm';
        return '待确认';
    } else {
        // return 'Confirmed';
        return 'PDF报告';
    }
};

exports.backToISO = function (localDateString) {
    var date = new Date(localDateString);
    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDate();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    // this is the same with
    // date.setMinutes(date.getMinutes - date.getTimezoneOffset());
    // return date;

    var newISODate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    return newISODate;
};

exports.getISOFromClientDOB = function(clientDateString, offset) {
    var date = new Date(clientDateString);
    var serverOffset = date.getTimezoneOffset();
    var minutes = date.getMinutes();
    date.setMinutes(minutes - serverOffset + offset);
    return date;
};

exports.getISOFromClientAge = function(clientAge, offset) {
    var today = new Date();
    var dob = new Date(today.setFullYear(today.getFullYear() - clientAge));
    return exports.getISOFromClientDOB(dob, offset);
};

exports.genderTranslate = function(gender) {
    if (gender == 'male') {
        return '男';
    }
    if (gender == 'female') {
        return '女';
    }
    return gender;
};

exports.getUserLevel = function(level) {
    if (level == 0) {
        return '管理员';
    } else if (level == 1) {
        return '普通用户';
    } else if (level == 2) {
        return '观摩用户';
    }
    return '未知错误用户';
};

// (function() {
//     var body = {};
//     var name = '';
//     var dob = body.dob;
//     var gender = 'male';
//     var medicalCareId = body.medicalCareId;
//     var medicationId = body.medicationId;
//     console.log(helper.validationCheck([name, gender]));
// })();

(function () {
    // var patientColumns = ['name', 'dob', 'gender', 'hospitala
    // console.log(helper.constructSelectSQL(['*'], 'User', [{name: 'password', exact: 1}, {name: 'username',high: 1}, {name: 'whatever', low: 1}, {name: 'whichever'}]));
    // console.log(helper.constructInsertSQL(['name', 'gender', 'createTime'], 'User'));
    // console.log(helper.constructUpdateSQL(['name', 'gender', 'number'], 'User', [{name: 'password', exact: 1}, {name: 'username',high: 1}, {name: 'whatever', low: 1}, {name: 'whichever'}]));
    // console.log(exports.constructInsertOrUpdateSQL(patientColumns, 'Patient', patientUpdateColumns));
    // console.log(exports.getSampleStatus(null));
    // console.log(exports.validateRangeInclusive([{ value: '0', low: 0, high: 2 }]));
})();
