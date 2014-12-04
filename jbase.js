//----------------------------------------------------------------------------------------------------------------------
// The main JBase module. The only function it exports is the `db` function, which creates or loads a new database.
//
// @module jbase.js
//----------------------------------------------------------------------------------------------------------------------

var Promise = require('bluebird');

var JDB = require('./lib/jdb');
var models = require('./lib/models');
var errors = require('./lib/errors');

//----------------------------------------------------------------------------------------------------------------------

module.exports = {
    db: function(name, options)
    {
        // The constructor of JDB handles the create or load logic.
        return new JDB(name, options);
    },
    defineModel: models.defineModel,
    JDB: JDB,
    Model: models.Model,
    Promise: Promise,
    errors: errors
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
