/*
Copyright (c) 2014, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License.
See LICENSE file.
*/
var async = require('async');
var fs = require('graceful-fs');
var mkdirp = require('mkdirp');
var path = require('path');
var options = require('./args.js');
var log = require('davlog');
var verify = require('./verify.js');
var hooks = require('./hooks');

var putBall = function(info, callback) {
    info.tarball = path.join(options.dir, info.path);

    hooks.tarball(info, callback, function () {
        process.nextTick(function() {
            mkdirp(path.dirname(info.tarball), function() {
                process.nextTick(function() {
                    verify.verify(info, function (err) {
                        if (err) {
                            return callback(err);
                        }

                        hooks.afterTarball(info, callback, callback);
                    });
                });
            });
        });
    });
};

var saveTarballs = function(tarballs, callback) {
    process.nextTick(function() {
        async.eachLimit(tarballs, options.limit, putBall, callback);
    });
};

exports.saveTarballs = saveTarballs;

//Always write it even if it is there.
var putPart = function(info, callback) {
    if (!info.json) {
        return callback();
    }
    hooks.versionJson(info, callback, function() {
        var file = path.join(options.dir, info.json.name, info.version, 'index.json');
        process.nextTick(function() {
            mkdirp(path.dirname(file), function() {
                process.nextTick(function() {
                    fs.writeFile(file, JSON.stringify(info.json, null, 4) + '\n', callback);
                });
            });
        });
    });
};

//Always write it even if it is there.
var putJSON = function(info, callback) {
    var doc = info.json;
    if (!doc.name || doc.error) {
        return callback(doc.error);
    }
    var putAllParts = function(err) {
        if (err) {
            return callback(err);
        }
        async.eachLimit(info.versions, 5, putPart, callback);
    };
    var seq = info.seq;
    var latestSeq = info.latestSeq;
    hooks.indexJson(info, putAllParts, function() {
        var file = path.join(options.dir, doc.name, 'index.json');
        log.info('[' + seq + '/' + latestSeq + ']', 'writing json for', doc.name, 'to', file);
        process.nextTick(function() {
            mkdirp(path.dirname(file), function() {
                process.nextTick(function() {
                    fs.writeFile(file, JSON.stringify(doc, null, 4) + '\n', function(err) {
                        if (err) {
                            return putJSON(info, callback);
                        }
                        if (!info.versions || !info.versions.length) {
                            return callback();
                        }
                        process.nextTick(putAllParts);
                    });
                });
            });
        });
    });
};

exports.saveJSON = putJSON;
