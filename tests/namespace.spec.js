// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the namespace.spec.js module.
//
// @module
// ---------------------------------------------------------------------------------------------------------------------

const path = require('path');
const assert = require("assert");

const TDB = require('../lib/tdb');
const TDBNamespace = require('../lib/namespace');

// ---------------------------------------------------------------------------------------------------------------------

describe('TDBNamespace Instance', () =>
{
    let namespace;

    beforeEach(() =>
    {
        namespace = new TDBNamespace('test');
    });

    it('has a name', () =>
    {
        assert.equal(namespace.name, 'test');
    });

    describe('db()', () =>
    {
        it('returns a TDB instance', () =>
        {
            const db = namespace.db("test", { writeToDisk: false });
            assert(db instanceof TDB, "db is not an instance of TDB");
        });
    });

    describe('options', () =>
    {
        it('supports overriding the database name', () =>
        {
            namespace = new TDBNamespace('test', { dbPath: 'foobar/baz' });
            assert.equal(namespace.dbPath, 'foobar/baz');
        });

        it('supports overriding the base path', () =>
        {
            namespace = new TDBNamespace('test', { basePath: '/tmp/test' });
            assert.equal(namespace.rootPath, path.join('/tmp/test', namespace.dbPath, namespace.name));
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
