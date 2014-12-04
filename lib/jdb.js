//----------------------------------------------------------------------------------------------------------------------
// This is the main database logic. It implements a thin wrapper around a plain object, as well as logic for persisting
// to disk.
//
// @module jdb.js
//----------------------------------------------------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var uuid = require('node-uuid');
var Promise = require('bluebird');

//----------------------------------------------------------------------------------------------------------------------

function JDB(name, options)
{
    EventEmitter.call(this);

    this.values = {};

    this._name = name;
    this._dirty = false;
    this._writing = false;
    this._lastWritten = Date.now();

    this.options = _.defaults(options || {}, {
        writeToDisk: true,
        loadFromDisk: true,
        rootPath: "./",
        writeDelay: 0,
        prettyPrint: true
    });

    // Optionally load this database from disk
    if(this.options.loadFromDisk)
    {
        this._loadFromDisk();
    } // end if

    // Register for the sync event
    this.on('sync', this.sync.bind(this));
} // end JDB

util.inherits(JDB, EventEmitter);

Object.defineProperties(JDB.prototype, {
    name: {
        get: function()
        {
            return this._name;
        }
    },
    rootPath: {
        get: function()
        {
            if(!this._rootPath)
            {
                this._rootPath = path.resolve(this.options.rootPath);
            } // end if

            return this._rootPath;
        }
    },
    path: {
        get:function()
        {
            return path.join(this.rootPath, this._name) + '.json';
        }
    }
}); // end properties

//----------------------------------------------------------------------------------------------------------------------
// Private functions
//----------------------------------------------------------------------------------------------------------------------

JDB.prototype._loadFromDisk = function()
{
    if(fs.existsSync(this.path))
    {
        var jsonStr = fs.readFileSync(this.path);

        try
        {
            this.values = JSON.parse(jsonStr);
        }
        catch(ex)
        {
            // Wrap the exception in a more friendly one.
            var error = new Error("Failed to parse on disk json file.");
            error.innerException = ex;

            // Throw the error
            throw error;
        } // end try/catch
    } // end if
}; // end loadFromDisk

JDB.prototype._writeToDisk = function()
{
    var self = this;

    if(this.options.writeToDisk)
    {
        if(this._dirty)
        {
            if(!this._writing)
            {
                // We're definitely going to schedule a write, so we flag it.
                this._writing = true;

                // We calculate how many milliseconds are left before we can next write, and take the max of that and 0.
                // This means that if it's been `writeDelay` or more milliseconds since we last wrote, we'll write on
                // the next tick.
                var timeout = Math.max((this._lastWritten + this.options.writeDelay) - Date.now(), 0);

                return new Promise(function(resolve)
                {
                    setTimeout(function()
                    {
                        self._dirty = false;

                        // If we're set to pretty print, we use a 4 space indent, otherwise, undefined.
                        // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#space_argument
                        var indent = self.options.prettyPrint ? 4 : undefined;

                        // Build our json string
                        var jsonStr = JSON.stringify(self.values, null, indent);

                        fs.writeFile(self.path, jsonStr, function()
                        {
                            self._writing = false;

                            // Check to see if the db has been marked dirty since we started our write.
                            if(self._dirty)
                            {
                                self._writeToDisk()
                                    .then(function()
                                    {
                                        resolve();
                                    });
                            }
                            else
                            {
                                resolve();
                            } // end if
                        });
                    }, timeout);
                });
            } // end if
        } // end if
    }
    else
    {
        // Writing to disk is disabled, so we should call the callback.
        return Promise.resolve();
    } // end if
}; // end _writeToDisk

//----------------------------------------------------------------------------------------------------------------------
// Public API
//----------------------------------------------------------------------------------------------------------------------

JDB.prototype.get = function(key)
{
    return Promise.resolve(this.values[key]);
}; // end get

JDB.prototype.store = function(name, value)
{
    if(!value)
    {
        value = name;
        name = undefined;
    } // end if

    if(name === undefined)
    {
        name = uuid.v4();
    } // end if

    this.values[name] = value;

    // Schedule a sync
    this.emit('sync');

    return Promise.resolve(name);
}; // end store

JDB.prototype.merge = function(key, partial)
{
    var val = this.values[key] || {};
    _.merge(val, partial);

    this.values[key] = val;

    // Schedule a sync
    this.emit('sync');

    return Promise.resolve(val);
}; // end merge

JDB.prototype.filter = function(filter)
{
    return Promise.resolve(_.pick(this.values, _.createCallback(filter)));
}; // end filter

JDB.prototype.sync = function()
{
    this._dirty = true;
    return this._writeToDisk();
}; // end sync

//----------------------------------------------------------------------------------------------------------------------

module.exports = JDB;

//----------------------------------------------------------------------------------------------------------------------