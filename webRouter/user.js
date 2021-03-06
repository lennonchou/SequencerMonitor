var connection = require('../mysqlConnection.js');
var jwt = require('jsonwebtoken');
var log = require('../log.js');
var md5 = require('md5');
var settings = require('../settings.js');
const util = require('util');
var helper = require('../helper.js');
var async = require('async');
var _ = require('underscore');

exports.signIn = function (req, res) {
    log.d(util.format('sign in with username: %s', req.body.username));
    var username = req.body.username;
    var pwd = req.body.password;
    if (!helper.validationCheck(username, pwd)) {
        return res.status(400).json({ success: false, error: '请输入用户名和密码', message: 'Please provide username and password' });
    }
    connection.myQuery(helper.constructSelectSQL(['id', 'level'], 'User', [{ name: 'username', exact: 1 }, { name: 'password', exact: 1 }]), [username, md5(pwd)])
        .then(function (rows) {
            if (rows && rows.length) {
                var token = jwt.sign({
                    user: {
                        userId: rows[0].id,
                        level: rows[0].level,
                        username: username
                    }
                }, settings.secretKey);
                return res.json({ success: true, token: token, level: rows[0].level });
            }
            log.d(util.format('incorrect username or password with username: %s', username));
            return res.status(401).json({ success: false, error: '用户名或密码错误', message: 'incorrect username or password' });
        }).fail(function (err) {
            log.d('Error when signing in: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

exports.create = function (req, res) {
    var body = req.body;
    var name = body.name;
    var username = body.username;
    var pwd = body.password;
    var level = body.level;
    var cellPhone = body.cellPhone;
    var email = body.email;
    var active = body.active == null ? 1 : body.active;
    var comment = body.comment;
    if (!helper.validationCheck([username, pwd, level, name])) {
        return res.status(400).json({ success: false, error: '请输入所有必填项', message: 'Please provide all the key parameters' });
    }
    if (!helper.validateRangeInclusive([{ value: level, low: 1, high: 2 }])) {
        return res.status(400).json({ success: false, error: '请输入合法的用户级别', message: 'Please provide valid user level' });
    }
    connection.myQuery(helper.constructInsertSQL(['username', 'password', 'level', 'name', 'cellPhone', 'email', 'active', 'comment', 'createTime'], 'User'),
        [username, md5(pwd), level, name, cellPhone, email, active, comment])
        .then(function (newUser) {
            return res.json({ success: true, id: newUser.insertId });
        })
        .fail(function (err) {
            if (err.message.indexOf('ER_DUP') != -1) {
                 return res.status(500).json({ success: false, error: '用户名重复', message: err.message || 'Unknown' });
            }
            log.d('Error in creating user: ' + err.message)
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

exports.edit = function (req, res) {
    var body = req.body;
    var name = body.name;
    var username = body.username;
    var cellPhone = body.cellPhone;
    var email = body.email;
    var active = body.active == null ? 1 : body.active;
    var comment = body.comment;
    var level = body.level;
    var id = body.id;
    if (!helper.validationCheck([username, id, name, level])) {
        return res.status(400).json({ success: false, error: '请输入所有必填项', message: 'Please provide all the key parameters' });
    }
    connection.myQuery(helper.constructUpdateSQL(['username', 'name', 'level', 'cellPhone', 'email', 'active', 'comment'], 'User', [{ name: 'id', exact: 1 }]),
        [username, name, level, cellPhone, email, active, comment, id])
        .then(function (result) {
            return res.json({ success: true, id: id });
        })
        .fail(function (err) {
            if (err.message.indexOf('ER_DUP') != -1) {
                 return res.status(500).json({ success: false, error: '用户名重复', message: err.message || 'Unknown' });
            }
            log.d('Error in editing user: ' + err.message)
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        });
};

exports.search = function (req, res) {
    var name = req.query.name;
    var username = req.query.username;
    var columns = ['User.id', 'User.username', 'User.level', 'User.name', 'User.cellPhone', 'User.email', 'User.active', 'User.comment'];
    var keys = [];
    var values = [];
    if (name && name.length) {
        keys.push({ name: 'name' });
        values.push(name + '%');
    }
    if (username && username.length) {
        keys.push({ name: 'username' });
        values.push(username + '%');
    }
    var totalPage = parseInt(req.query.totalPage) || -1;
    var limit = parseInt(req.query.limit) || 20;
    var orderBy = req.query.orderBy || 'username';
    var page = parseInt(req.query.page) || 1;
    // search matching the head
    async.parallel({
        users: function (callback) {
            connection.myQuery(helper.constructSelectSQL(columns, 'User', keys) + ' ORDER BY ' + orderBy + ' LIMIT ?, ?', values.concat([(page - 1) * limit, limit]))
                .then(function (rows) {
                    var users = _.map(rows, function (user) {
                        return {
                            id: user.id,
                            username: user.username,
                            level: helper.getUserLevel(user.level),
                            name: user.name,
                            cellPhone: user.cellPhone,
                            email: user.email,
                            active: user.active == 1 ? '是' : '否',
                            comment: user.comment
                        };
                    });
                    callback(null, users);
                })
                .fail(function (err) {
                    callback(err, null);
                });
        },
        totalPage: function (callback) {
            if (totalPage != -1) {
                callback(null, totalPage);
            }
            connection.myQuery(helper.constructSelectSQL(['COUNT(*) AS count'], 'User', keys), values)
                .then(function (result) {
                    callback(null, Math.ceil(result[0].count / limit));
                })
                .fail(function (err) {
                    callback(err, null);
                })
        }
    },
        function (err, results) {
            if (err) {
                log.d('Error when searching user: ' + err.message);
                return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
            } else {
                results.success = true;
                return res.json(results);
            }
        });
};

exports.retrieve = function (req, res) {
    var id = req.query.id;
    var columns = ['User.id', 'User.username', 'User.level', 'User.name', 'User.cellPhone', 'User.email', 'User.active', 'User.comment'];
    connection.myQuery(helper.constructSelectSQL(columns, 'User', [{ name: 'id', exact: 1 }]), [id])
        .then(function (rows) {
            var user = {
                id: rows[0].id,
                username: rows[0].username,
                level: rows[0].level,
                name: rows[0].name,
                cellPhone: rows[0].cellPhone,
                email: rows[0].email,
                active: rows[0].active,
                comment: rows[0].comment
            }
            return res.json({ success: true, user: user });
        })
        .fail(function (err) {
            log.d('Error when retrieving user: ' + err.message);
            return res.status(500).json({ success: false, error: err.code, message: err.message || 'Unknown' });
        })
};

exports.delete = function (req, res) {
    var body = req.body;
    var id = body.id;
    var adminLevel = 0;
    if (!helper.validationCheck([id])) {
        return res.status(400).json({ success: false, error: 'Please provide a valid id' });
    }
    connection.myQuery('DELETE FROM User WHERE id = ? AND level != ?', [id, adminLevel])
        .then(function (result) {
            if (result.affectedRows) {
                return res.json({ success: true, deletedId: id });
            }
            log.d('Cannot delete because no such user or authorization denied');
            return res.status(401).json({ success: false, error: '无法删除此用户', message: 'No such user' });
        })
        .fail(function (err) {
            log.d('Error when deleting exsting user: ' + err.message);
            return res.status(500).json({ success: false, error: '删除用户错误', message: err.message || 'Unknown' });
        });
};

exports.resetPwd = function (req, res) {
    var body = req.body;
    var id = req.payload.user.userId;
    var oldPwd = body.oldPassword;
    var newPwd = body.newPassword;
    if (!helper.validationCheck([oldPwd, newPwd])) {
        return res.status(400).json({ success: false, error: '请输入合法的原密码和新密码', message: 'Please provide valid passwords' });
    }
    connection.myQuery(helper.constructSelectSQL(['*'], 'User', [{ name: 'id', exact: 1 }, { name: 'password', exact: 1 }]), [id, md5(oldPwd)])
        .then(function (result) {
            if (!result.length) {
                return res.status(400).json({ success: false, error: '原密码错误', message: 'The old password is incorrect' });
            }
            var sql = helper.constructUpdateSQL(['password'], 'User', [{ name: 'id', exact: 1 }]);
            return connection.myQuery(sql, [md5(newPwd), id]);
        })
        .then(function (result) {
            return res.json({ success: true });
        })
        .fail(function (err) {
            log.d('Error in resetting password: ' + err.message)
            return res.status(500).json({ success: false, error: '重设密码错误', message: err.message || 'Unknown' });
        })
};

