//----------------------------------------------------------------------------------------------------------------------
// This is the main database logic. It implements a thin wrapper around a plain object, as well as logic for persisting
// to disk.
//----------------------------------------------------------------------------------------------------------------------

const { EventEmitter } = require('events');

const _ = require('lodash');
const Promise = require('bluebird');
const base62 = require('base62');
const uuid = require('uuid');

const fslib = require('./fslib');
const pathlib = require('./pathlib');
const { DocumentNotFoundError, WriteDatabaseError } = require('./errors');

//----------------------------------------------------------------------------------------------------------------------

// This generates nice, short ids (ex: 'HrILY', '2JjA9s') that are as unique as a uuid.
function generateID()
{
    return base62.encode(Buffer.from(uuid.v4(null, [])).readUInt32LE(0));
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
            idFunc: generateID,
            readFunc: fslib.readDB,
            writeFunc: fslib.writeDB
        });

        // Set the read/write functions
        this.$readDB = this.options.readFunc;
        this.$writeDB = this.options.writeFunc;

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

    get name() { return this._name; }
    get count() { return _.keys(this.values).length; }
    get path() { return `${ pathlib.join(this.rootPath, this._name) }.json`; }
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
                if(this.options.dbPath !== this._namespace.dbPath)
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

        // If we're set to pretty print, we use a 4 space indent, otherwise, undefined.
        // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#space_argument
        const indent = this.options.prettyPrint ? 4 : undefined;

        // Build our json string
        const jsonStr = JSON.stringify(this.values, null, indent);

        return Promise.delay(timeout)
            .then(() =>
            {
                return this.$writeDB(this.path, jsonStr)
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
            .catch((error) => { return !(error instanceof WriteDatabaseError); }, (error) =>
            {
                // Wrap any errors in a WriteError so the message says that writing the DB failed.
                const wrappedError = new WriteDatabaseError(error.message, this.path);
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
        return val === undefined ? defaultVal : val;
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
        const removed = _(_.values(this.values)).remove(predicate)
            .value();

        _.each(removed, (item) =>
        {
            delete this.values[item[this.options.pk]];
        });

        return removed;
    } // end del

    load(key, defaultVal)
    {
        return Promise.resolve(this.get(key, defaultVal))
            .tap((val) =>
            {
                if(val === undefined)
                {
                    throw new DocumentNotFoundError(key);
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
        return _(_.cloneDeep(this.values)).filter(predicate)
            .value();
    } // end filter

    query()
    {
        // We build a new chain object, so we can add the `.run` alias, without polluting the global lodash.
        const queryBuilder = _.runInContext();
        queryBuilder.prototype.run = queryBuilder.prototype.value;

        // We always clone the returned values, to keep the DB consistent.
        return queryBuilder.chain(_.cloneDeep(this.values));
    } // end query

    reload()
    {
        if(!this.options.loadFromDisk)
        {
            throw new Error('Database is not configured to load from disk.');
        } // end if

        return this.loading = this.$readDB(this.path)
            .then((values) =>
            {
                this.values = values;
                this.emit('loaded');
            })
            .catch({ code: 'ENOENT' }, (ex) =>
            {
                // TODO: Wrap in cusom error class
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
            this._writePromise = this._writeToDisk();
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
