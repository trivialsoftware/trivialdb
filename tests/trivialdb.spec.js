// ---------------------------------------------------------------------------------------------------------------------
/// Unit Tests for the trivialdb.spec.js module.
///
/// @module
// ---------------------------------------------------------------------------------------------------------------------

var assert = require("assert");
var trivialdb = require('../src/trivialdb');
var TDB = require('../src/lib/tdb');
var TDBNamespace = require('../src/lib/namespace');

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

    describe('namespace()', function()
    {
        it('is aliased as \'ns\'', function()
        {
            var ns = trivialdb.ns("trivialdb_test");
            assert(ns instanceof TDBNamespace, "ns is not an instance of TDBNamespace");
        });

        it('returns a TDBNamespace instance', function()
        {
            var ns = trivialdb.namespace("trivialdb_test");
            assert(ns instanceof TDBNamespace, "ns is not an instance of TDBNamespace");
        });

        it('returns the same TDBNamespace instance if you request it multiple times', function()
        {
            var ns = trivialdb.namespace("trivialdb_test");
            var ns2 = trivialdb.namespace("trivialdb_test");

            assert.equal(ns, ns2);
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
