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
var JDB = require('../lib/tdb');

// ---------------------------------------------------------------------------------------------------------------------

describe('TrivialDB', function()
{
    describe('db()', function()
    {
        it('returns a JDB instance', function()
        {
            var db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            assert(db instanceof JDB, "db is not an instance of JDB");
        });

        it('passes options to the JDB instance', function()
        {
            var db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            assert.equal(db.options.writeToDisk, false);
        });

        it('returns the same JDB instance if you request it multiple times', function()
        {
            var db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            var db2 = trivialdb.db("trivialdb_test");

            assert.equal(db, db2);
        });
    });

    describe('defineModel()', function()
    {
        it('returns a custom model instance', function()
        {
            var ModelInst = trivialdb.defineModel('trivialdb_test', {
                name: String
            }, { writeToDisk: false });

            // This is the easiest way to test that it's the right constructor.
            assert(typeof(ModelInst.get) == 'function');
            assert(typeof(ModelInst.filter) == 'function');
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
