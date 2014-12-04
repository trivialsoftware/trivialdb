//----------------------------------------------------------------------------------------------------------------------
// The main JBase module. The only function it exports is the `db` function, which creates or loads a new database.
//
// @module jbase.js
//----------------------------------------------------------------------------------------------------------------------

var JDB = require('./lib/jdb');
var Promise = require('bluebird');

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    db: function(name, options)
    {
        // The constructor of JDB handles the create or load logic.
        return new JDB(name, options);
    },
    JDB: JDB,
    Promise: Promise
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
