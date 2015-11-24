// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the trivialdb.spec.js module.
//
// @module trivialdb.spec.js
// ---------------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the tdb.spec.js module.
//
// @module tdb.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var assert = require("assert");
var trivialdb = require('../trivialdb');
var TDB = require('../dist/tdb');

// ---------------------------------------------------------------------------------------------------------------------

describe('TrivialDB', function()
{
    describe('db()', function()
    {
        it('returns a TDB instance', function()
        {
            var db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            assert(db instanceof TDB, "db is not an instance of TDB");
        });

        it('passes options to the TDB instance', function()
        {
            var db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            assert.equal(db.options.writeToDisk, false);
        });

        it('returns the same TDB instance if you request it multiple times', function()
        {
            var db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            var db2 = trivialdb.db("trivialdb_test");

            assert.equal(db, db2);
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
