//----------------------------------------------------------------------------------------------------------------------
// The main TrivialDB module. The only function it exports is the `db` function, which creates or loads a new database.
//
// @module trivialdb.js
//----------------------------------------------------------------------------------------------------------------------

const TDBNamespace = require('./lib/namespace');
const errors = require('./lib/errors');

//----------------------------------------------------------------------------------------------------------------------

// Only create the main module object if it hasn't been created yet in this process.
if(process.$$triviadb)
{
    // `trivialdb` has already been initialized; just export the existing module.
    module.exports = process.$$triviadb;
    console.warn("`trivialdb` has already been initialized; exporting the existing module.");
}
else
{
    const namespaces = {};

    /**
     * Create or retrieve a namespace object.
     * @param {string} name - The name to give the namespace. (This will also be the folder name when persisted to disk.)
     * @param {Object} [options] - Additional options for the namespace.
     * @param {string} [options.basePath] - The base path for all other paths to be relative to. (Defaults to the application's base directory.)
     * @param {string} [options.dbPath] - The path, relative to `basePath` to the root database folder. (Defaults to 'db'.)
     * @returns {TDBNamespace}
     */
    function ns(name, options)
    {
        const namespace = namespaces[name] || new TDBNamespace(name, options);
        namespaces[name] = namespace;

        return namespace;
    } // end ns

    /**
     * Create or retrieve a database object from the default namespace.
     * @param {string} name - The name of the database object. (Used for retrieval and as the filename for persistence.)
     * @param {Object} [options] - Additional options for the database.
     * @param {Object} [options.writeToDisk] -  Whether or not to persist the database to disk. (Default: `true`)
     * @param {Object} [options.loadFromDisk] -  Whether or not to read the database in from disk on load. (Default: `true`)
     * @param {Object} [options.rootPath] -  The path to a folder that will contain the persisted database json files. (Default: './')
     * @param {Object} [options.dbPath] -  The path, relative to the namespace's `basePath` to the root database folder. (Defaults to 'db'.)
     * @param {Object} [options.writeDelay] -  A number in milliseconds to wait between writes to the disk. (Default: 0)
     * @param {Object} [options.prettyPrint] -  Whether or not the json on disk should be pretty printed. (Default: `true`)
     * @param {Object} [options.pk] -  The field in the object to use as the primary key. (Default: `undefined`)
     * @param {Object} [options.idFunc] -  The function to use to generate unique ids. (Default: `uuid.v4()`)

     * @returns {TDB}
     */
    function db(name, options)
    {
        return ns('').db(name, options);
    } // end db

    //------------------------------------------------------------------------------------------------------------------

    // Set the global import
    process.$$triviadb = (module.exports = {
        ns,
        db,
        namespace: ns,
        database: db,
        errors: errors
    });
} // end if

//----------------------------------------------------------------------------------------------------------------------
