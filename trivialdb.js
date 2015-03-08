//----------------------------------------------------------------------------------------------------------------------
// The main TrivialDB module. The only function it exports is the `db` function, which creates or loads a new database.
//
// @module trivialdb.js
//----------------------------------------------------------------------------------------------------------------------

var Promise = require('bluebird');

var JDB = require('./lib/tdb');
var models = require('./lib/models');
var errors = require('./lib/errors');

//----------------------------------------------------------------------------------------------------------------------

var dbInstances = {};

module.exports = {
    db: function(name, options)
    {
        var db = dbInstances[name];

        if(!db)
        {
            db = new JDB(name, options);
            dbInstances[name] = db;
        } // end if

        return db;
    },
    defineModel: models.defineModel,
    JDB: JDB,
    Model: models.Model,
    Promise: Promise,
    errors: errors
}; // end exports

//----------------------------------------------------------------------------------------------------------------------
