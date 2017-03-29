//----------------------------------------------------------------------------------------------------------------------
// This is the main database logic. It implements a thin wrapper around a plain object, as well as logic for persisting
// to disk.
//
// @module
//----------------------------------------------------------------------------------------------------------------------

const fs = require('fs');
const { EventEmitter } = require('events');

const _ = require('lodash');
const base62 = require('base62');
const uuid = require('uuid');
const Promise = require('bluebird');
const _mkdirp = require('mkdirp');

const pathlib = require('./pathlib');
const errors = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

const mkdirp = Promise.promisify(_mkdirp);
const statAsync = Promise.promisify(fs.stat);
const writeFileAsync = Promise.promisify(fs.writeFile);
const readFileAsync = Promise.promisify(fs.readFile);

//----------------------------------------------------------------------------------------------------------------------

// This generates nice, short ids (ex: 'HrILY', '2JjA9s') that are as unique as a uuid.
function generateID()
{
    return base62.encode(new Buffer(uuid.v4(null, [])).readUInt32LE(0));
} // end generateID

//----------------------------------------------------------------------------------------------------------------------

class TDB extends EventEmitter
{
    constructor(name, options, namespace)
    {
        super();

        // Handle an empty options case
        options = options || {};

        // We disable warnings about max listeners.
        this.setMaxListeners(0);

        this.values = {};
        this.loading = Promise.resolve();

        this._name = name;
        this._namespace = namespace;

        this._lastWrittenTimestamp = Date.now();
        this._writePromise = null;
        this._writeOutstanding = false;

        this.options = _.defaults(options, {
            writeToDisk: true,
            loadFromDisk: options.writeToDisk || true,
            dbPath: options.dbPath || this._namespace ? this._namespace.dbPath : 'db',
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
        }
        else
        {
            // This is for the event api, if we're not doing disk operations.
            this.emit('loaded');
        } // end if
    } // end constructor

    //------------------------------------------------------------------------------------------------------------------
    // Properties
    //------------------------------------------------------------------------------------------------------------------

    get name(){ return this._name; }
    get count(){ return _.keys(this.values).length; }
    get path(){ return pathlib.join(this.rootPath, this._name) + '.json'; }
    get rootPath()
    {
        if(!this._rootPath)
        {
            // Allow the db's `rootPath` option to override all logic
            if(this.options.rootPath)
            {
                this._rootPath = this.options.rootPath;
            }
            else if(this._namespace)
            {
                // We need to support overriding just the `dbPath` option.
                if(this.options.dbPath != this._namespace.dbPath)
                {
                    this._rootPath = pathlib.join(pathlib.getRoot(), this.options.dbPath, this._namespace.name);
                }
                else
                {
                    // Otherwise, we just return the namespace's `rootPath`
                    this._rootPath = this._namespace.rootPath;
                } // end if
            }
            else
            {
                // Or, we don't have a namespace, and we build this ourselves
                this._rootPath = pathlib.join(pathlib.getRoot(), this.options.dbPath);
            } // end if
        } // end if

        return this._rootPath;
    } // end rootPath

    //------------------------------------------------------------------------------------------------------------------
    // Private functions
    //------------------------------------------------------------------------------------------------------------------

    _writeToDisk()
    {
        // We calculate how many milliseconds are left before we can next write, and take the max of that and 0.
        // This means that if it's been `writeDelay` or more milliseconds since we last wrote, we'll write on
        // the next tick.
        const timeout = Math.max((this._lastWrittenTimestamp + this.options.writeDelay) - Date.now(), 0);

        return Promise.delay(timeout)
            .then(() =>
            {
                return statAsync(this.rootPath);
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
                // If we're set to pretty print, we use a 4 space indent, otherwise, undefined.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#space_argument
                const indent = this.options.prettyPrint ? 4 : undefined;

                // Build our json string
                const jsonStr = JSON.stringify(this.values, null, indent);

                return writeFileAsync(this.path, jsonStr)
                    .then(() =>
                    {
                        if(this._writeOutstanding)
                        {
                            this._writeOutstanding = false;
                            return this._writeToDisk();
                        }
                        else
                        {
                            this._writePromise = null;
                        } // end if
                    });
            })
            .catch((error) => { return !(error instanceof errors.WriteDatabase); }, (error) =>
            {
                // Wrap any errors in a WriteError so the message says that writing the DB failed.
                const wrappedError = new errors.WriteDatabase(error.message, this.path);
                wrappedError.innerError = error;

                throw wrappedError;
            });
    } // end _writeToDisk

    //------------------------------------------------------------------------------------------------------------------
    // Public API
    //------------------------------------------------------------------------------------------------------------------

    get(key, defaultVal)
    {
        const val = _.cloneDeep(this.values[key]);
        return  val === undefined ? defaultVal : val;
    } // end get

    set(key, value)
    {
        const pk = this.options.pk;

        // If only a single value was passed...
        if(value === undefined)
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

        // We _always_ set `id` if the value is an object.
        if(_.isObject(value))
        {
            this.values[key][pk] = key;
        } // end if

        return key;
    } // end set

    del(predicate)
    {
        const removed = _(_.values(this.values)).remove(predicate).value();

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
        const key = this.set(name, value);
        return this.sync()
            .then(() => key);
    } // end save

    remove(predicate)
    {
        const results = this.del(predicate);
        return this.sync()
            .then(() => results);
    } // end remove

    filter(predicate)
    {
        return _(_.cloneDeep(this.values)).filter(predicate).value();
    } // end filter

    query()
    {
        // We build a new chain object, so we can add the `.run` alias, without polluting the global lodash.
        const queryBuilder = _.runInContext();
        queryBuilder.prototype.run = queryBuilder.prototype.value;

        // We always clone the returned values, to keep the DB consistent.
        return queryBuilder(_.cloneDeep(this.values));
    } // end query

    reload()
    {
        if(!this.options.loadFromDisk)
        {
            throw new Error("Database is not configured to load from disk.");
        } // end if

        return this.loading = readFileAsync(this.path)
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
                    const error = new Error("Failed to parse on disk json file.");
                    error.innerException = ex;

                    // Throw the error
                    throw error;
                } // end try/catch
            })
            .catch({ code: 'ENOENT' }, (ex) =>
            {
                //TODO: Wrap in cusom error class
                const error = new Error(`Failed to load json file ('${ this.path }') from disk.`);
                error.code = 'ENOENT';
                error.file = this.path;
                error.innerException = ex;

                // Throw the error
                throw error;
            });
    } // end reload

    clear()
    {
        this.values = {};
        this.emit('loaded');

        // Write this to disk.
        return this.sync();
    } // end clear

    sync()
    {
        // Short circuit if we're memory only.
        if(!this.options.writeToDisk)
        {
            return Promise.resolve();
        } // end if

        // Otherwise, we handle debouncing writes
        if(!this._writePromise)
        {
            this._writePromise = this._writeToDisk()
        }
        else
        {
            this._writeOutstanding = true;
        } // end if

        return this._writePromise;
    } // end sync
} // end TDB

//----------------------------------------------------------------------------------------------------------------------

module.exports = TDB;

//----------------------------------------------------------------------------------------------------------------------
