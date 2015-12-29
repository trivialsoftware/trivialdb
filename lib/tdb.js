//----------------------------------------------------------------------------------------------------------------------
// This is the main database logic. It implements a thin wrapper around a plain object, as well as logic for persisting
// to disk.
//
// @module tdb.js
//----------------------------------------------------------------------------------------------------------------------

var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var base62 = require('base62');
var uuid = require('node-uuid');
var Promise = require('bluebird');

var fs = Promise.promisifyAll(require('fs'));
var mkdirp = Promise.promisify(require('mkdirp'));

var errors = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

// This generates nice, short ids (ex: 'HrILY', '2JjA9s') that are as unique as a uuid.
function generateID()
{
    return base62.encode(new Buffer(uuid.v4(null, [])).readUInt32LE(0));
} // end generateID

//----------------------------------------------------------------------------------------------------------------------

class TDB extends EventEmitter
{
    constructor(name, options)
    {
        super();

        // Handle an empty options case
        options = options || {};

        // We disable warnings about max listeners.
        this.setMaxListeners(0);

        this.values = {};

        this._name = name;
        this._currentVersion = 0;
        this._lastWrittenTimestamp = Date.now();
        this._lastWrittenVersion = 0;
        this._writePromise = null;

        this.options = _.defaults(options, {
            writeToDisk: true,
            loadFromDisk: options.writeToDisk || true,
            rootPath: "./",
            writeDelay: 0,
            prettyPrint: true,
            pk: 'id',
            idFunc: generateID
        });

        // Optionally load this database from disk
        if(this.options.loadFromDisk)
        {
            // Don't blow up if we fail to find the JSON file; that's ok for a new db.
            this.loading = this.reload().catch({ code: 'ENOENT' }, () => {});
        } // end if
    } // end constructor

    //------------------------------------------------------------------------------------------------------------------
    // Properties
    //------------------------------------------------------------------------------------------------------------------

    get name(){ return this._name; }
    get path(){ return path.join(this.rootPath, this._name) + '.json'; }
    get rootPath()
    {
        if(!this._rootPath)
        {
            this._rootPath = path.resolve(this.options.rootPath);
        } // end if

        return this._rootPath;
    }
    //------------------------------------------------------------------------------------------------------------------
    // Private functions
    //------------------------------------------------------------------------------------------------------------------

    _writeToDisk()
    {
        if(!this.options.writeToDisk)
        {
            return Promise.resolve();
        }
        else
        {
            // We calculate how many milliseconds are left before we can next write, and take the max of that and 0.
            // This means that if it's been `writeDelay` or more milliseconds since we last wrote, we'll write on
            // the next tick.
            var timeout = Math.max((this._lastWrittenTimestamp + this.options.writeDelay) - Date.now(), 0);

            this._writePromise = Promise.delay(timeout)
                .then(() =>
                {
                    return fs.statAsync(this.rootPath);
                })
                .then((stats) =>
                {
                    if(!stats.isDirectory())
                    {
                        throw new errors.WriteDatabase("Root path " + JSON.stringify(this.rootPath) + " is not a directory!", this.path);
                    } // end if
                })
                .catch((error) => { return error.code == 'ENOENT'; }, () =>
                {
                    return mkdirp(this.rootPath);
                })
                .then(() =>
                {
                    var version = this._currentVersion;

                    // If we're set to pretty print, we use a 4 space indent, otherwise, undefined.
                    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#space_argument
                    var indent = this.options.prettyPrint ? 4 : undefined;

                    // Build our json string
                    var jsonStr = JSON.stringify(this.values, null, indent);

                    return fs.writeFileAsync(this.path, jsonStr)
                        .then(() =>
                        {
                            this._lastWrittenVersion = version;
                            this._writePromise = null;
                        });
                })
                .catch((error) => { return !(error instanceof errors.WriteDatabase); }, (error) =>
                {
                    // Wrap any errors in a WriteError so the message says that writing the DB failed.
                    var wrappedError = new errors.WriteDatabase(error.message, this.path)
                    wrappedError.innerError = error;

                    throw wrappedError;
                });

            return this._writePromise;
        } // end if
    } // end _writeToDisk

    //------------------------------------------------------------------------------------------------------------------
    // Public API
    //------------------------------------------------------------------------------------------------------------------

    get(key)
    {
        return _.cloneDeep(this.values[key]);
    } // end get

    set(key, value)
    {
        var pk = this.options.pk;

        // If only a single value was passed...
        if(!value)
        {
            value = key;
            key = undefined;
        } // end if

        // Attempt to populate it from the primary key's value in the passed object
        if(key === undefined)
        {
            key = value[pk];
        } // end if

        // If that doesn't work, generate a new id
        if(key === undefined)
        {
            key = this.options.idFunc(value);
        } // end if

        // Now we store it.
        this.values[key] = _.cloneDeep(value);

        // Update our current version
        this._currentVersion += 1;

        // We _always_ set the id of the object.
        this.values[key][pk] = key;

        return key;
    } // end set

    del(predicate)
    {
        var removed = _(_.values(this.values)).remove(predicate).run();

        _.each(removed, (item) =>
        {
            delete this.values[item[this.options.pk]];
        });

        // Update our current version
        this._currentVersion += 1;

        return removed;
    } // end del

    load(key)
    {
        return Promise.resolve(this.get(key))
            .tap((val) =>
            {
                if(val === undefined)
                {
                    throw new errors.DocumentNotFound(key);
                } // end if
            });
    } // end get

    save(name, value)
    {
        var key = this.set(name, value);
        return this.sync()
            .then(() => key);
    } // end save

    remove(predicate)
    {
        var results = this.del(predicate);
        return this.sync()
            .then(() => results);
    } // end remove

    filter(predicate)
    {
        return _(_.cloneDeep(this.values)).filter(predicate).run();
    } // end filter

    query()
    {
        // We always clone the returned values, to keep the DB consistent.
        return _(_.cloneDeep(this.values));
    } // end query

    reload()
    {
        if(!this.options.loadFromDisk)
        {
            throw new Error("Database is not configured to load from disk.");
        } // end if

        return fs.readFileAsync(this.path)
            .then((jsonStr) =>
            {
                try
                {
                    this.values = JSON.parse(jsonStr);
                    this.emit('loaded');
                }
                catch(ex)
                {
                    // Wrap the exception in a more friendly one.
                    var error = new Error("Failed to parse on disk json file.");
                    error.innerException = ex;

                    // Throw the error
                    throw error;
                } // end try/catch
            })
            .catch({ code: 'ENOENT' }, (ex) =>
            {
                //TODO: Wrap in cusom error class
                var error = new Error(`Failed to load json file ('${ this.path }') from disk.`);
                error.code = 'ENOENT';
                error.file = this.path;
                error.innerException = ex;

                // Throw the error
                throw error;
            });
    } // end reload

    sync(force)
    {
        if(force)
        {
            this._currentVersion += 1;
        } // end if

        var version = this._currentVersion;
        var doSync = () =>
        {
            if(version <= this._lastWrittenVersion)
            {
                // We have written at least the version of the database we care about to disk
                return Promise.resolve();
            }
            else if(this._writePromise)
            {
                // We are in the middle of a write. Chain off of it to ensure we write our version to disk
                return this._writePromise.then(doSync());
            }
            else
            {
                // No writes are scheduled, so trigger one
                return this._writeToDisk();
            } // end if
        };

        return doSync();
    } // end sync
} // end TDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = TDB;

//----------------------------------------------------------------------------------------------------------------------
