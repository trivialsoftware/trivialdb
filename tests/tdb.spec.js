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

var TDB = require('../src/lib/tdb').default;
var errors = require('../src/lib/errors').default;

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

    it('handles no options being passed in', () =>
    {
        db = new TDB("test2");
        assert.equal(db.name, "test2");
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
        return db.sync(true)
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
            return db.sync(true)
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
            return db.sync(true)
                .then(() =>
                {
                    assert(fs.existsSync(db.path), "Database did not write out to the expected location.");
                });
        });

        it('writeDelay can be used to control the minimum period between writes', (done) =>
        {
            db = new TDB("test", { rootPath: rootPath, writeDelay: 50 });
            db.save('test-key', { test: true });

            // Check before the write should have hit
            setTimeout(() =>
            {
                assert(!fs.existsSync(db.path), "Database wrote out to disk.");
            }, 20);

            // Check after the write should have hit
            setTimeout(() =>
            {
                var jsonStr = fs.readFileSync(db.path).toString();
                assert.deepEqual(JSON.parse(jsonStr), {'test-key':{test:true, id: 'test-key'}});
                done();
            }, 60);
        });

        it('prettyPrint can be used to control whether or not the json on disk is persisted in compact form', (done) =>
        {
            db = new TDB("test", { rootPath: rootPath, prettyPrint: false });
            db.save('test-key', { test: true });

            setTimeout(() =>
            {
                var jsonStr = fs.readFileSync(db.path).toString();
                assert.equal(jsonStr, '{"test-key":{"test":true,"id":"test-key"}}');
                done();
            }, 20);
        });

        it('pk can be used to specify a field of the model to use as the id', () =>
        {
            db = new TDB("test", { writeToDisk: false, pk: 'name' });
            return db.save({ name: 'bob', admin: false })
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
            return db.save({ name: "TrivialDB: now with id generation functions!", body: "Read the title, dude." })
                .then(() =>
                {
                    assert.deepEqual(db.values, {
                        'trivialdb-now-with-id-generation-functions': {
                            name: 'TrivialDB: now with id generation functions!',
                            body: 'Read the title, dude.',
                            id: 'trivialdb-now-with-id-generation-functions'
                        }
                    });
                });
        });
    });

    describe("Storing Values", () =>
    {
        it('`set()` stores a value under the specified key', () =>
        {
            db.set('test-key', { test: true });
            assert('test-key' in db.values, "The key 'test-key' was not found.");
        });

        it('`set()` autogenerates a key when none is specified', () =>
        {
            var key = db.set({ test: true });
            assert(key in db.values, "The key '" + key + "' was not found.");
        });

        it('`set()` does not sync to disk', () =>
        {
            db = new TDB("test", { rootPath: rootPath });
            db._writeToDisk = () => { throw new Error("Write to disk!") };

            db.set('test-key', { test: true });
        });

        it('`set()` updates the primary key', () =>
        {
            db = new TDB("test", { rootPath: rootPath, pk: 'email' });
            db.set('foo@bar.com', { test: true });
            db.set('foo2@bar.com', { test: true, email: 'notfoo@bar.com' });

            assert.equal(db.values['foo@bar.com'].email, 'foo@bar.com');
            assert.equal(db.values['foo2@bar.com'].email, 'foo2@bar.com');

            // Make sure we handle te default id case
            db = new TDB("test", { rootPath: rootPath });
            db.set('f', { test: true });
            db.set('f2', { test: true, id: 'nf' });

            assert.equal(db.values['f'].id, 'f');
            assert.equal(db.values['f2'].id, 'f2');
        });

        it('`save()` stores a value under the specified key', () =>
        {
            return db.save('test-key', { test: true })
                .then(() =>
                {
                    assert('test-key' in db.values, "The key 'test-key' was not found.");
                });
        });

        it('`save()` autogenerates a key when none is specified', () =>
        {
            return db.save({ test: true })
                .then((key) =>
                {
                    assert(key in db.values, "The key '" + key + "' was not found.");
                });
        });


        it('`save()` syncs to disk', (done) =>
        {
            db = new TDB("test", { rootPath: rootPath });
            db._writeToDisk = () => { done(); return Promise.resolve(); };

            db.save('test-key', { test: true });
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

    describe("Filtering Values", () =>
    {
        it('filters the db by function', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" },
                'some-other-guy': { age: 16, name: "SomeOther Guy" },
                'additional-guy': { age: 11, name: "Additional Guy" }
            };

            var ages = db.filter((value, key) =>
            {
                return value.age > 30;
            });

            assert.deepEqual(ages, [{ age: 36, name: "Some Guy" }, { age: 32, name: "Also Guy" }]);
        });

        it('supports filter objects', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" },
                'some-other-guy': { age: 16, name: "SomeOther Guy" },
                'additional-guy': { age: 11, name: "Additional Guy" }
            };

            var ages = db.filter({ age: 32 });

            assert.deepEqual(ages, [{ age: 32, name: "Also Guy" }]);
        });
    });

    describe("Remove Values", () =>
    {
        it('`del()` removes values by function', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' },
                'some-other-guy': { age: 16, name: "SomeOther Guy", id: 'some-other-guy' },
                'additional-guy': { age: 11, name: "Additional Guy", id: 'additional-guy' }
            };

            db.del((value) =>
            {
                return value.age < 30;
            });

            assert.deepEqual(db.values, {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }
            });
        });

        it('`del()` removes values by filter object', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }
            };

            db.del({ age: 36 });
            assert.deepEqual(db.values, {'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }});
        });

        it('`del()` does not sync to disk', () =>
        {
            db = new TDB("test", { rootPath: rootPath });
            db.values = {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }
            };
            db._writeToDisk = () => { throw new Error("Write to disk!") };

            db.del('test-key', { age: 36 });
        });

        it('`remove()` calls `del()`, syncs to disk', (done) =>
        {
            db = new TDB("test", { rootPath: rootPath });
            db.values = {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }
            };
            db._writeToDisk = () =>
            {
                assert.deepEqual(db.values, {'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }});
                return Promise.resolve(done());
            };

            db.remove({ age: 36 });
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
            var values = db.query().value();
            assert(values !== db.values);
            assert.equal(values.test.foo, db.values.test.foo);

            // Modify the cloned object
            values['foo'] = {};

            // Ensure the db is not modified
            assert.equal(db.values.foo, undefined);
        });
    });

    describe("Expiration", () =>
    {
        it("expires keys immediately if their expiration is past", () =>
        {
            db.set('test', { foo: 123 }, Date.now() - 1000);
            assert.equal(db.values['test'], undefined);
        });

        it("expires keys at the given timeout", () =>
        {
            var testObj = { foo: 123, id: 'test' };
            db.set('test', testObj, Date.now() + 10);
            assert.deepEqual(db.values['test'], testObj);

            return Promise.delay(20).then(() =>
            {
                assert.equal(db.values['test'], undefined);
            });
        });

        it("supports multiple keys with the same expiration", () =>
        {
            var testObj = { foo: 123 };
            var exp = Date.now() + 10;
            db.set('test1', testObj, exp);
            db.set('test2', testObj, exp);

            // Ensure The values were set correctly
            assert.equal(db.values['test1'].foo, 123);
            assert.equal(db.values['test2'].foo, 123);

            // Ensure that both keys are set to expire
            assert(_.includes(db._expirations[exp], 'test1'), "Key 'test1' is not set to expire.");
            assert(_.includes(db._expirations[exp], 'test2'), "Key 'test2' is not set to expire.");

            return Promise.delay(10)
                .then(() =>
                {
                    assert.equal(db.values['test2'], undefined);
                    assert.equal(db.values['test1'], undefined);
                });
        });

        it("supports multiple expirations, set in any order", () =>
        {
            var testObj = { foo: 123 };

            db.set('test', testObj, Date.now() + 250);
            db.set('test1', testObj, Date.now() + 10);
            db.set('test2', testObj, Date.now() + 10);
            db.set('test3', testObj, Date.now() + 52);

            // Ensure The values were set correctly
            assert.equal(db.values['test'].foo, 123);
            assert.equal(db.values['test1'].foo, 123);
            assert.equal(db.values['test2'].foo, 123);
            assert.equal(db.values['test3'].foo, 123);

            return Promise.delay(15)
                .then(() =>
                {
                    assert.equal(db.values['test1'], undefined);
                    assert.equal(db.values['test2'], undefined);
                })
                .delay(50)
                .then(() =>
                {
                    assert.equal(db.values['test3'], undefined);
                })
                .delay(250)
                .then(() =>
                {
                    assert.equal(db.values['test'], undefined);
                });
        });

        it("clears the timeout once there are no new expirations", () =>
        {
            var testObj = { foo: 123, id: 'test' };
            db.set('test', testObj, Date.now() + 10);
            assert.deepEqual(db.values['test'], testObj);

            return Promise.delay(20).then(() =>
            {
                assert.equal(db.values['test'], undefined);
                assert.equal(db._expirationTimeout, null);
            });
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
