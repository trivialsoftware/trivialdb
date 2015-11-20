//----------------------------------------------------------------------------------------------------------------------
// The main TrivialDB module. The only function it exports is the `db` function, which creates or loads a new database.
//
// @module trivialdb.js
//----------------------------------------------------------------------------------------------------------------------

var TDB = require('./lib/tdb');
var errors = require('./lib/errors');

//----------------------------------------------------------------------------------------------------------------------

var dbInstances = {};

module.exports = {
    db: function(name, options)
    {
        var db = dbInstances[name];

        if(!db)
        {
            db = new TDB(name, options);
            dbInstances[name] = db;
        } // end if

        return db;
    },
    TDB: TDB,
    errors: errors
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
