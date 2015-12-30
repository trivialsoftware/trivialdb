//----------------------------------------------------------------------------------------------------------------------
// The main TrivialDB module. The only function it exports is the `db` function, which creates or loads a new database.
//
// @module trivialdb.js
//----------------------------------------------------------------------------------------------------------------------

var TDB = require('./dist/tdb');
var TDBNamespace = require('./dist/namespace');
var errors = require('./dist/errors');

//----------------------------------------------------------------------------------------------------------------------

var namespaces = {};

function ns(name, options)
{
    var ns = namespaces[name] || new TDBNamespace(name, options);
    namespaces[name] = ns;

    return ns;
} // end ns

function db(name, options)
{
    return ns('').db(name, options);
} // end db

module.exports = {
    db,
    ns,
    namespace: ns,
    TDB: TDB,
    TDBNamespace: TDBNamespace,
    errors: errors
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
