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
var uuid = require('node-uuid');
var Promise = require('bluebird');

var fs = Promise.promisifyAll(require('fs'));
var mkdirp = Promise.promisify(require('mkdirp'));

var errors = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

class TDB extends EventEmitter
{
    constructor(name, options)
    {
        super();

        // We disable warnings about max listeners.
        this.setMaxListeners(0);

        this.values = {};

        this._name = name;
        this._dirty = false;
        this._writing = false;
        this._lastWritten = Date.now();

        this.options = _.defaults(options || {}, {
            writeToDisk: true,
            loadFromDisk: options.writeToDisk || true,
            rootPath: "./",
            writeDelay: 0,
            prettyPrint: true,
            pk: 'id',
            idFunc: uuid.v4
        });

        // Optionally load this database from disk
        if(this.options.loadFromDisk)
        {
            // Don't blow up if we fail to find the JSON file; that's ok for a new db.
            this.loading = this.reload().catch({ code: 'ENOENT' }, () => {});
        } // end if

        // Register for the sync event
        this.on('sync', this.sync.bind(this));
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
        if(this.options.writeToDisk && this._dirty && !this._writing)
        {
            // We're definitely going to schedule a write, so we flag it.
            this._writing = true;

            // We calculate how many milliseconds are left before we can next write, and take the max of that and 0.
            // This means that if it's been `writeDelay` or more milliseconds since we last wrote, we'll write on
            // the next tick.
            var timeout = Math.max((this._lastWritten + this.options.writeDelay) - Date.now(), 0);

            return Promise.delay(timeout)
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
                    this._dirty = false;

                    // If we're set to pretty print, we use a 4 space indent, otherwise, undefined.
                    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#space_argument
                    var indent = this.options.prettyPrint ? 4 : undefined;

                    // Build our json string
                    var jsonStr = JSON.stringify(this.values, null, indent);

                    return fs.writeFileAsync(this.path, jsonStr);
                })
                .then(() =>
                {
                    this._writing = false;

                    // Check to see if the db has been marked dirty since we started our write.
                    if(this._dirty)
                    {
                        return this._writeToDisk();
                    } // end if
                })
                .catch((error) => { return !(error instanceof errors.WriteDatabase); }, (error) =>
                {
                    // Wrap any errors in a WriteError so the message says that writing the DB failed.
                    throw new errors.WriteDatabase(error.message, this.path).causedBy(error);
                });
        }
        else
        {
            // Writing to disk is disabled, we're not dirty, or we're currently writing; resolve the promise.
            return Promise.resolve();
        } // end if
    } // end _writeToDisk

    //----------------------------------------------------------------------------------------------------------------------
    // Public API
    //----------------------------------------------------------------------------------------------------------------------

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

    filter(predicate)
    {
        return _(_.cloneDeep(this.values)).filter(predicate).run();
    } // end filter

    remove(predicate)
    {
        var results = this.del(predicate);
        return this.sync()
            .then(() => results);
    } // end remove

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

    sync()
    {
        this._dirty = true;
        return this._writeToDisk();
    } // end sync
} // end TDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = TDB;

//----------------------------------------------------------------------------------------------------------------------
