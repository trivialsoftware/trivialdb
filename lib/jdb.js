//----------------------------------------------------------------------------------------------------------------------
// This is the main database logic. It implements a thin wrapper around a plain object, as well as logic for persisting
// to disk.
//
// @module jdb.js
//----------------------------------------------------------------------------------------------------------------------

var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var _ = require('lodash');

//----------------------------------------------------------------------------------------------------------------------

function createKey()
{
    var sha = crypto.createHash('sha1');
    sha.update([os.hostname(), process.pid, Date.now(), Math.random()].join('-'));
    return sha.digest('base64');
} // end createKey

//----------------------------------------------------------------------------------------------------------------------

function JDB(name, options)
{
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
} // end JDB

JDB.prototype = {
    get name()
    {
        return this._name;
    },
    get rootPath()
    {
        if(!this._rootPath)
        {
            this._rootPath = path.resolve(this.options.rootPath);
        } // end if

        return this._rootPath;
    },
    get path()
    {
        return path.join(this.rootPath, this._name) + '.json';
    }
}; // end prototype

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

JDB.prototype._writeToDisk = function(callback)
{
    callback = callback || function(){};
    var self = this;

    if(this.options.writeToDisk)
    {
        if(this._dirty)
        {
            if(!this._writing)
            {
                // We're definitely going to schedule a write, so we flag it.
                this._writing = true;

                // We calculate how many miliseconds are left before we can next write, and take the max of that and 0.
                // This means that if it's been `writeDelay` or more miliseconds since we last wrote, we'll write on the
                // next tick.
                var timeout = Math.max((this._lastWritten + this.options.writeDelay) - Date.now(), 0);
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

                        // If someone's waiting on our write, we can let them know we're done.
                        callback();

                        // Check to see if the db has been marked dirty since we started our write.
                        if(self._dirty)
                        {
                            self._writeToDisk();
                        } // end if
                    });
                }, timeout);
            } // end if
        } // end if
    }
    else
    {
        // Writing to disk is disabled, so we should call the callback.
        callback();
    } // end if
}; // end _writeToDisk

JDB.prototype._createUniqueKey = function()
{
    var key = createKey();

    // Check to make sure that the key isn't currently being used.
    while(key in this.values)
    {
        key = createKey();
    } // end while

    return key
};

//----------------------------------------------------------------------------------------------------------------------
// Public API
//----------------------------------------------------------------------------------------------------------------------

JDB.prototype.get = function(key)
{
    return this.values[key];
}; // end get

JDB.prototype.store = function(name, value)
{
    if(!value)
    {
        value = name;
        name = this._createUniqueKey();
    } // end if

    this.values[name] = value;

    // Schedule a sync
    this.sync();

    return name;
}; // end store

JDB.prototype.merge = function(key, partial)
{
    var val = this.values[key] || {};
    _.merge(val, partial);

    this.values[key] = val;

    // Schedule a sync
    this.sync();

    return val;
}; // end merge

JDB.prototype.filter = function(filterFunc, callback)
{
    var self = this;
    var filtered = {};

    function _filter()
    {
        _.forIn(self.values, function(value, key)
        {
            if(filterFunc(key, value))
            {
                filtered[key] = value;
            } // end if
        });
    } // end _filtered

    if(callback)
    {
        setImmediate(function()
        {
            _filter();
            callback(filtered);
        });
    }
    else
    {
        _filter();
        return filtered;
    } // end if
}; // end filter

JDB.prototype.sync = function(callback)
{
    this._dirty = true;
    this._writeToDisk(callback);
}; // end sync

//----------------------------------------------------------------------------------------------------------------------

module.exports = JDB;

//----------------------------------------------------------------------------------------------------------------------