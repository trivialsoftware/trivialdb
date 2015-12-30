//----------------------------------------------------------------------------------------------------------------------
/// This is the main logic for namespaces. They are essentially just collections of `TDB` instances, plus some fancy
/// rootPath logic.
///
/// @module
//----------------------------------------------------------------------------------------------------------------------

import pathlib from './pathlib';
import TDB from './tdb';

//----------------------------------------------------------------------------------------------------------------------

class TDBNamespace {
    constructor(name, options)
    {
        options = options || {};

        // By default, we assume our base path to be the application's main directory.
        this.basepath = options.basePath || pathlib.getRoot();

        // By default, this is simply a folder called 'db'
        this.dbPath = options.dbPath || 'db';

        this.name = name;
        this._dbInstances = {};
    } // end constructor

    get rootPath(){ return pathlib.join(this.basepath, this.dbPath, this.name); }

    db(name, options)
    {
        var db = this._dbInstances[name] || new TDB(name, options, this);
        this._dbInstances[name] = db;

        return db;
    } // end db
} // end TDBNamespace

//----------------------------------------------------------------------------------------------------------------------

// Must use old style exports, so es5 code can import.
module.exports = TDBNamespace;

//----------------------------------------------------------------------------------------------------------------------