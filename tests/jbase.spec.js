// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the jbase.spec.js module.
//
// @module jbase.spec.js
// ---------------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the jdb.spec.js module.
//
// @module jdb.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var assert = require("assert");
var jbase = require('../jbase');
var JDB = require('../lib/jdb');

// ---------------------------------------------------------------------------------------------------------------------

describe('JBase', function()
{
    describe('db()', function()
    {
        it('returns a JDB instance', function()
        {
            var db = jbase.db("jbase_test", { writeToDisk: false });
            assert(db instanceof JDB, "db is not an instance of JDB");
        });

        it('passes options to the JDB instance', function()
        {
            var db = jbase.db("jbase_test", { writeToDisk: false });
            assert.equal(db.options.writeToDisk, false);
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
