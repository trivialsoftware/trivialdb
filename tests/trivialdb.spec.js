// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the trivialdb.spec.js module.
// ---------------------------------------------------------------------------------------------------------------------

const assert = require('assert');
const trivialdb = require('../trivialdb');
const TDB = require('../lib/tdb');
const TDBNamespace = require('../lib/namespace');

// ---------------------------------------------------------------------------------------------------------------------

describe('TrivialDB', () =>
{
    describe('db()', () =>
    {
        it('returns a TDB instance', () =>
        {
            const db = trivialdb.db('trivialdb_test', { writeToDisk: false });
            assert(db instanceof TDB, 'db is not an instance of TDB');
        });

        it('passes options to the TDB instance', () =>
        {
            const db = trivialdb.db('trivialdb_test', { writeToDisk: false });
            assert.equal(db.options.writeToDisk, false);
        });

        it('returns the same TDB instance if you request it multiple times', () =>
        {
            const db = trivialdb.db('trivialdb_test', { writeToDisk: false });
            const db2 = trivialdb.db('trivialdb_test');

            assert.equal(db, db2);
        });
    });

    describe('namespace()', () =>
    {
        it('is aliased as \'ns\'', () =>
        {
            const ns = trivialdb.ns('trivialdb_test');
            assert(ns instanceof TDBNamespace, 'ns is not an instance of TDBNamespace');
        });

        it('returns a TDBNamespace instance', () =>
        {
            const ns = trivialdb.namespace('trivialdb_test');
            assert(ns instanceof TDBNamespace, 'ns is not an instance of TDBNamespace');
        });

        it('returns the same TDBNamespace instance if you request it multiple times', () =>
        {
            const ns = trivialdb.namespace('trivialdb_test');
            const ns2 = trivialdb.namespace('trivialdb_test');

            assert.equal(ns, ns2);
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
