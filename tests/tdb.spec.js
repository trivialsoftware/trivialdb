// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the tdb.spec.js module.
//
// @module tdb.spec.js
// ---------------------------------------------------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const assert = require("assert");
const os = require('os');

const _ = require('lodash');
const Promise = require('bluebird');

const TDB = require('../lib/tdb');
const errors = require('../lib/errors');

// ---------------------------------------------------------------------------------------------------------------------

describe('TDB Instance', () =>
{
    const testDB = '{"cfvtjn3dzYLJzbbfKCcZsrTXDJw=": {"name":"Captain Hammer","role":"hero"},'
    + '"1lT/bTHNj2G3abAf+OsPNaV2Sgw=":{"name":"Dr. Horrible","role": "villian"}}';

    const rootPath = os.tmpdir();

    let db;
    beforeEach(() =>
    {
        db = new TDB("test", { writeToDisk: false, loadFromDisk: false });
        fs.writeFileSync(path.resolve(rootPath, 'tdb_test.json'), testDB);
    });

    afterEach(() =>
    {
        // Clean the temp directory.
        const files = fs.readdirSync(rootPath);
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

    it('provides a `loading` promise that resolves once loading is complete', () =>
    {
        db = new TDB("tdb_test", { writeToDisk: false, rootPath: rootPath });
        return db.loading.then(() =>
        {
            assert.deepEqual(db.values, JSON.parse(testDB));
        });
    });

    it('provides a `loading` promise that resolves instantly if `loadFromDisk` is false', () =>
    {
        db = new TDB("tdb_test", { loadFromDisk: false });
        return db.loading.then(() => { assert(true); });
    });

    it('writes changes to disk as a json file', () =>
    {
        const testDBObj = JSON.parse(testDB);

        db = new TDB("test_write", { rootPath: rootPath });
        db.values = testDBObj;
        return db.sync(true)
            .then(() =>
            {
                // This both tests that it writes, and that the json files are following the correct naming convention.
                const dbFile = fs.readFileSync(path.resolve(rootPath, 'test_write.json')).toString();

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

    it('gives a count of all the keys stored in it', () =>
    {
        db.values = {
            'some-guy': { age: 36, name: "Some Guy" },
            'also-guy': { age: 32, name: "Also Guy" },
            'some-other-guy': { age: 16, name: "SomeOther Guy" },
            'additional-guy': { age: 11, name: "Additional Guy" }
        };

        assert.equal(4, db.count);
    });

    describe("Options", () =>
    {
        it('writeToDisk can be used to disable writing to disk', () =>
        {
            const testDBObj = JSON.parse(testDB);

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
                const jsonStr = fs.readFileSync(db.path).toString();
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
                const jsonStr = fs.readFileSync(db.path).toString();
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

        it('`set()` supports basic types', () =>
        {
            db.set('test1', true);
            db.set('test2', false);
            db.set('test3', 'foo');
            db.set('test4', 0);
            db.set('test5', 10);

            assert.equal(true, db.get('test1'));
            assert.equal(false, db.get('test2'));
            assert.equal('foo', db.get('test3'));
            assert.equal(0, db.get('test4'));
            assert.equal(10, db.get('test5'));
        });

        it('`set()` autogenerates a key when none is specified', () =>
        {
            const key = db.set({ test: true });
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
            const value = db.get('test-key');
            assert.deepEqual(value, { test: true });
        });

        it('`get()` returns undefined when passing in a nonexistent key', () =>
        {
            const value = db.get('does-not-exist-key');
            assert.equal(value, undefined);
        });

        it('`get()` returns a default value when passing in a nonexistent key, and a default value is passed in', () =>
        {
            const value = db.get('does-not-exist-key', 23);
            assert.equal(value, 23);
        });

        it('`get()` returns a deeply cloned value', () =>
        {
            const testVal = { test: { foo: 123, nested: { bar: 123 } } };
            db.values['test-key'] = testVal;
            const value = db.get('test-key');

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
            const promise = db.load('test-key');
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

            const ages = db.filter((value, key) =>
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

            const ages = db.filter({ age: 32 });

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
            db._writeToDisk = () => { throw new Error("Tried to write to disk!") };

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

        it('`clear()` removes all keys from the database', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' }
            };

            assert.equal(2, db.count);

            db.clear();

            assert.equal(0, db.count);
        });
    });

    describe("Querying", () =>
    {
        it('returns a lodash chain object', () =>
        {
            // This might be a little brittle... but works for now.
            const lodashConstructorName = Object.getPrototypeOf(_()).constructor.name;
            const queryConstructorName = Object.getPrototypeOf(db.query()).constructor.name;

            assert.equal(lodashConstructorName, queryConstructorName);
        });

        it('returns a cloned version of the full database', () =>
        {
            db.values['test'] = { foo: 123 };
            const values = db.query().run();
            assert(values !== db.values);
            assert.equal(values.test.foo, db.values.test.foo);

            // Modify the cloned object
            values['foo'] = {};

            // Ensure the db is not modified
            assert.equal(db.values.foo, undefined);
        });

        it('executes the query with either `.run()` or `.value()`', () =>
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy", id: 'some-guy' },
                'also-guy': { age: 32, name: "Also Guy", id: 'also-guy' },
                'merv': { age: 32, name: "Merv Guy", id: 'merv' }
            };

            const query = db.query().filter({ age: 32 });
            assert.equal(query.value, query.run);

            const values = db.query().filter({ age: 32 }).run();
            assert(values.length == 2);

            const values2 = db.query().filter({ age: 32 }).value();
            assert(values2.length == 2);
        });

        it('does not leak `.run` into the global lodash prototype', () =>
        {
            db.values['test'] = { foo: 123 };
            const query = db.query();

            assert(_.isFunction(query.run), "Missing run function.");
            assert(!_.isFunction(require('lodash').prototype.run), "Pollution of the lodash prototype detected.");
            assert(!_.isFunction(_(['foo']).run), "Pollution of the chain prototype detected.");
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
