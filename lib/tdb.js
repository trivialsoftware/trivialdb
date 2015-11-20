//----------------------------------------------------------------------------------------------------------------------
// This is the main database logic. It implements a thin wrapper around a plain object, as well as logic for persisting
// to disk.
//
// @module tdb.js
//----------------------------------------------------------------------------------------------------------------------

"use strict";

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
            loadFromDisk: true,
            rootPath: "./",
            writeDelay: 0,
            prettyPrint: true,
            idFunc: uuid.v4
        });

        // Optionally load this database from disk
        if(this.options.loadFromDisk)
        {
            this._loadFromDisk();
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

    _loadFromDisk()
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
    } // end loadFromDisk

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
                        throw new errors.WriteError("Root path " + JSON.stringify(this.rootPath) + " is not a directory!");
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
                .catch((error) => { return !(error instanceof errors.WriteError); }, (error) =>
                {
                    // Wrap any errors in a WriteError so the message says that writing the DB failed.
                    throw new errors.WriteError(error.message).causedBy(error);
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
        return Promise.resolve(this.values[key]);
    } // end get

    store(name, value)
    {
        if(!value)
        {
            value = name;
            name = undefined;
        } // end if

        if(name === undefined && this.options.pk)
        {
            name = value[this.options.pk];
        } // end if

        if(name === undefined)
        {
            name = this.options.idFunc(value);
        } // end if

        this.values[name] = value;

        // Schedule a sync
        this.emit('sync');

        return Promise.resolve(name);
    } // end store

    merge(key, partial)
    {
        var val = this.values[key] || {};
        _.merge(val, partial);

        this.values[key] = val;

        // Schedule a sync
        this.emit('sync');

        return Promise.resolve(val);
    } // end merge

    filter(filter)
    {
        return Promise.resolve(_.pick(this.values, _.callback(filter)));
    } // end filter

    remove(filter)
    {
        var self = this;
        if(_.isString(filter) || _.isArray(filter))
        {
            self.values = _.omit(this.values, filter);
        }
        else
        {
            self.values = _.omit(this.values, _.callback(filter));
        } // end if

        // Schedule a sync
        this.emit('sync');

        return Promise.resolve();
    } // end remove

    sync()
    {
        this._dirty = true;
        return this._writeToDisk();
    }; // end sync
} // end TDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = TDB;

//----------------------------------------------------------------------------------------------------------------------
