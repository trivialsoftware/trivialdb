// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the trivialdb.spec.js module.
// ---------------------------------------------------------------------------------------------------------------------

const assert = require("assert");
const trivialdb = require('../trivialdb');
const TDB = require('../lib/tdb');
const TDBNamespace = require('../lib/namespace');

// ---------------------------------------------------------------------------------------------------------------------

describe('TrivialDB', function()
{
    describe('db()', function()
    {
        it('returns a TDB instance', function()
        {
            const db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            assert(db instanceof TDB, "db is not an instance of TDB");
        });

        it('passes options to the TDB instance', function()
        {
            const db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            assert.equal(db.options.writeToDisk, false);
        });

        it('returns the same TDB instance if you request it multiple times', function()
        {
            const db = trivialdb.db("trivialdb_test", { writeToDisk: false });
            const db2 = trivialdb.db("trivialdb_test");

            assert.equal(db, db2);
        });
    });

    describe('namespace()', function()
    {
        it('is aliased as \'ns\'', function()
        {
            const ns = trivialdb.ns("trivialdb_test");
            assert(ns instanceof TDBNamespace, "ns is not an instance of TDBNamespace");
        });

        it('returns a TDBNamespace instance', function()
        {
            const ns = trivialdb.namespace("trivialdb_test");
            assert(ns instanceof TDBNamespace, "ns is not an instance of TDBNamespace");
        });

        it('returns the same TDBNamespace instance if you request it multiple times', function()
        {
            const ns = trivialdb.namespace("trivialdb_test");
            const ns2 = trivialdb.namespace("trivialdb_test");

            assert.equal(ns, ns2);
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
