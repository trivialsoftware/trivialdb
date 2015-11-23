// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the tdb.spec.js module.
//
// @module tdb.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var assert = require("assert");
var os = require('os');

var _ = require('lodash');
var Promise = require('bluebird');

var TDB = require('../lib/tdb');
var errors = require('../lib/errors');

// ---------------------------------------------------------------------------------------------------------------------

describe('TDB Instance', () =>
{
    var testDB = '{"cfvtjn3dzYLJzbbfKCcZsrTXDJw=": {"name":"Captain Hammer","role":"hero"},'
    + '"1lT/bTHNj2G3abAf+OsPNaV2Sgw=":{"name":"Dr. Horrible","role": "villian"}}';

    var rootPath = os.tmpdir();

    var db;
    beforeEach(() =>
    {
        db = new TDB("test", { writeToDisk: false, loadFromDisk: false });
        fs.writeFileSync(path.resolve(rootPath, 'tdb_test.json'), testDB);
    });

    afterEach(() =>
    {
        // Clean the temp directory.
        var files = fs.readdirSync(rootPath);
        files.forEach((file) =>
        {
            try { fs.unlinkSync(path.join(rootPath, file)); }
            catch(ex){}
        });
    });

    it('creates a new database instance', () =>
    {
        assert(db instanceof TDB, "db is not an instance of TDB");
        assert.equal(db.name, "test");
    });

    it('loads a database instance if one exists', () =>
    {
        db = new TDB("tdb_test", { writeToDisk: false, rootPath: rootPath });
        return db.loading.then(() =>
        {
            assert.deepEqual(db.values, JSON.parse(testDB));
        });
    });

    it('writes changes to disk as a json file', () =>
    {
        var testDBObj = JSON.parse(testDB);

        db = new TDB("test_write", { rootPath: rootPath });
        db.values = testDBObj;
        return db.sync()
            .then(() =>
            {
                // This both tests that it writes, and that the json files are following the correct naming convention.
                var dbFile = fs.readFileSync(path.resolve(rootPath, 'test_write.json')).toString();

                assert.deepEqual(JSON.parse(dbFile), testDBObj);
            });
    });

    it('allows reloading of a file from disk', () =>
    {
        db = new TDB("reload_test", { writeToDisk: false, loadFromDisk: true, rootPath: rootPath });
        return db.loading.then(() =>
        {
            assert(_.isEmpty(db.values));

            fs.writeFileSync(path.join(rootPath, 'reload_test.json'), JSON.stringify(testDB));
            return db.reload().then(() =>
            {
                assert.deepEqual(db.values, testDB);
            });
        });
    });

    describe("Options", () =>
    {
        it('writeToDisk can be used to disable writing to disk', () =>
        {
            var testDBObj = JSON.parse(testDB);

            db = new TDB("test", { writeToDisk: false, rootPath: rootPath });
            db.values = testDBObj;
            return db.sync()
                .then(() =>
                {
                    assert(!fs.existsSync(db.path), "Database wrote out to disk.");
                });
        });

        it('loadFromDisk can be used to disable loading from disk on startup', () =>
        {
            db = new TDB("tdb_test", { loadFromDisk: false, rootPath: rootPath });
            assert(db.values !== JSON.parse(testDB));
        });

        it('rootPath can be used to control where database files are written', () =>
        {
            db = new TDB("test", { rootPath: rootPath });
            return db.sync()
                .then(() =>
                {
                    assert(fs.existsSync(db.path), "Database did not write out to the expected location.");
                });
        });

        it('writeDelay can be used to control the minimum period between writes', (done) =>
        {
            db = new TDB("test", { rootPath: rootPath, writeDelay: 50 });
            db.store('test-key', { test: true });

            // Check before the write should have hit
            setTimeout(() =>
            {
                assert(!fs.existsSync(db.path), "Database wrote out to disk.");
            }, 20);

            // Check after the write should have hit
            setTimeout(() =>
            {
                var jsonStr = fs.readFileSync(db.path).toString();
                assert.deepEqual(JSON.parse(jsonStr), {'test-key':{test:true}});
                done();
            }, 60);
        });

        it('prettyPrint can be used to control whether or not the json on disk is persisted in compact form', (done) =>
        {
            db = new TDB("test", { rootPath: rootPath, prettyPrint: false });
            db.store('test-key', { test: true });

            setTimeout(() =>
            {
                var jsonStr = fs.readFileSync(db.path).toString();
                assert.equal(jsonStr, '{"test-key":{"test":true}}');
                done();
            }, 20);
        });

        it('pk can be used to specify a field of the model to use as the id', () =>
        {
            db = new TDB("test", { writeToDisk: false, pk: 'name' });
            return db.store({ name: 'bob', admin: false })
                .then(() =>
                {
                    assert.deepEqual(db.values, {'bob': { name: 'bob', admin: false }});
                });
        });

        it('idFunc can be used to specify the id generation function', () =>
        {
            function slugify(article)
            {
                return article.name.toString().toLowerCase()
                    .replace(/\s+/g, '-')           // Replace spaces with -
                    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
                    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
                    .replace(/^-+/, '')             // Trim - from start of text
                    .replace(/-+$/, '');            // Trim - from end of text
            } // end slugify

            db = new TDB("articles", { writeToDisk: false, idFunc: slugify });
            return db.store({ name: "TrivialDB: now with id generation functions!", body: "Read the title, dude." })
                .then(() =>
                {
                    assert.deepEqual(db.values, {"trivialdb-now-with-id-generation-functions":{"name":"TrivialDB: now with id generation functions!","body":"Read the title, dude."}});
                });
        });
    });

    describe("Storing Values", () =>
    {
        it('stores a value under the specified key', () =>
        {
            return db.store('test-key', { test: true })
                .then(() =>
                {
                    assert('test-key' in db.values, "The key 'test-key' was not found.");
                });
        });

        it('autogenerates a key when none is specified', () =>
        {
            return db.store({ test: true })
                .then((key) =>
                {
                    assert(key in db.values, "The key '" + key + "' was not found.");
                });
        });
    });

    describe("Retrieving Values", () =>
    {
        it('`get()` returns the value when passing in an existing key', () =>
        {
            db.values['test-key'] = { test: true };
            var value = db.get('test-key');
            assert.deepEqual(value, { test: true });
        });

        it('`get()` returns undefined when passing in a nonexistent key', () =>
        {
            var value = db.get('does-not-exist-key');
            assert.equal(value, undefined);
        });

        it('`get()` returns a deeply cloned value', () =>
        {
            var testVal = { test: { foo: 123, nested: { bar: 123 } } };
            db.values['test-key'] = testVal;
            var value = db.get('test-key');

            // Make sure the objects are not the same
            assert(value !== testVal);

            // Now, modify the value object
            value.test.foo = 456;
            value.test.foo2 = 456;
            value.test.nested.bar = 456;

            // Ensure those modifications have not propagated
            assert.equal(testVal.test.foo, 123);
            assert.equal(testVal.test.nested.bar, 123);
            assert(testVal.test.foo2 == undefined);
        });

        it('`load()` returns a promise', () =>
        {
            db.values['test-key'] = { test: true };
            var promise = db.load('test-key');
            assert(_.isFunction(promise.then), "`load().then` is not a function!");
        });

        it("`load()` rejects with a 'DocumentNotFound' error on nonexistent keys", () =>
        {
            return db.load('does-not-exist')
                .then(() =>
                {
                    assert(false, "Failed to throw error.");
                })
                .catch(errors.DocumentNotFound, () => {});
        });
    });

    describe("Updating Values", () =>
    {
        it('updates the value with the partial when an existing key is passed', () =>
        {
            db.values['test-key'] = { test: true };
            return db.merge('test-key', { other: 123 })
                .then((newVal) =>
                {
                    assert.deepEqual(newVal, { test: true, other: 123 });
                });
        });

        it('creates a new value of the partial when a nonexistent key is passed', () =>
        {
            return db.merge('test-key', { other: 123 })
                .then(() =>
                {
                    var val = db.get('test-key');
                    assert.deepEqual(val, { other: 123 });
                });
        });

        it('updates deeply nested objects', () =>
        {
            db.values['test-key'] = { test: true, nested: { subkey: { foo: "bar" }, other: 123 }};
            return db.merge('test-key', { nested: { subkey: { foo: "bleh" }}})
                .then((newVal) =>
                {
                    assert.deepEqual(newVal, { test: true, nested: { subkey: { foo: "bleh" }, other: 123 }});
                });

        });

        it('creates intermediate keys on deeply nested objects', () =>
        {
            db.values['test-key'] = { test: true };
            return db.merge('test-key', { nested: { subkey: { foo: "bleh" }}})
                .then((newVal) =>
                {
                    assert.deepEqual(newVal, { test: true, nested: { subkey: { foo: "bleh" }}});
                });
        });
    });

    describe("Filtering Values", () =>
    {
        it('filters the db using the filter function', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" },
                'some-other-guy': { age: 16, name: "SomeOther Guy" },
                'additional-guy': { age: 11, name: "Additional Guy" }
            };

            return db.filter((value, key) =>
            {
                return value.age > 30;
            }).then((ages) =>
            {
                assert.deepEqual(ages, {'some-guy': { age: 36, name: "Some Guy" }, 'also-guy': { age: 32, name: "Also Guy" }});
            });
        });

        it('supports filter objects', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" },
                'some-other-guy': { age: 16, name: "SomeOther Guy" },
                'additional-guy': { age: 11, name: "Additional Guy" }
            };

            return db.filter({ age: 32 })
                .then((ages) =>
                {
                    assert.deepEqual(ages, {'also-guy': { age: 32, name: "Also Guy" }});
                });
        });
    });

    describe("Remove Values", () =>
    {
        it('removes values by id', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" }
            };

            return db.remove('some-guy')
                .then(() =>
                {
                    assert.deepEqual(db.values, {'also-guy': { age: 32, name: "Also Guy" }});
                });
        });

        it('removes values by filter object', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" }
            };

            return db.remove({ age: 36 })
                .then(() =>
                {
                    assert.deepEqual(db.values, {'also-guy': { age: 32, name: "Also Guy" }});
                });
        });
    });

    describe("Querying", () =>
    {
        it('returns a lodash chain object', () =>
        {
            // This might be a little brittle... but works for now.
            var LodashWrapper = Object.getPrototypeOf(_()).constructor;
            var values = db.query();

            assert(values instanceof LodashWrapper);
        });

        it('returns a cloned version of the full database', () =>
        {
            db.values['test'] = { foo: 123 };
            var values = db.query().run();
            assert(values !== db.values);
            assert.equal(values.test.foo, db.values.test.foo);

            // Modify the cloned object
            values['foo'] = {};

            // Ensure the db is not modified
            assert.equal(db.values.foo, undefined);
        });
    });

    describe("Syncing writes", () =>
    {
        it('triggers a write to disk when called', () =>
        {
            db = new TDB("test", { rootPath: rootPath });
            db._writeToDisk = () =>
            {
                return Promise.resolve();
            };

            return db.sync();
        });

        it('calls the passed in callback when the write is complete', () =>
        {
            db = new TDB("test", { rootPath: rootPath });
            return db.sync(() =>
            {
                assert(fs.existsSync(db.path), "Database did not write out to the expected location.");
            });
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
