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

// ---------------------------------------------------------------------------------------------------------------------

describe('TDB Instance', function()
{
    var testDB = '{"cfvtjn3dzYLJzbbfKCcZsrTXDJw=": {"name":"Captain Hammer","role":"hero"},'
    + '"1lT/bTHNj2G3abAf+OsPNaV2Sgw=":{"name":"Dr. Horrible","role": "villian"}}';

    var rootPath = os.tmpdir();

    var db;
    beforeEach(function()
    {
        db = new TDB("test", { writeToDisk: false, loadFromDisk: false });
        fs.writeFileSync(path.resolve(rootPath, 'tdb_test.json'), testDB);
    });

    afterEach(function()
    {
        // Clean the temp directory.
        var files = fs.readdirSync(rootPath);
        files.forEach((file) =>
        {
            try { fs.unlinkSync(path.join(rootPath, file)); }
            catch(ex){}
        });
    });

    it('creates a new database instance', function()
    {
        assert(db instanceof TDB, "db is not an instance of TDB");
        assert.equal(db.name, "test");
    });

    it('loads a database instance if one exists', function()
    {
        db = new TDB("tdb_test", { writeToDisk: false, rootPath: rootPath });
        return db.loading.then(() =>
        {
            assert.deepEqual(db.values, JSON.parse(testDB));
        });
    });

    it('writes changes to disk as a json file', function(done)
    {
        var testDBObj = JSON.parse(testDB);

        db = new TDB("test_write", { rootPath: rootPath });
        db.values = testDBObj;
        db.sync()
            .then(function()
            {
                // This both tests that it writes, and that the json files are following the correct naming convention.
                var dbFile = fs.readFileSync(path.resolve(rootPath, 'test_write.json')).toString();

                assert.deepEqual(JSON.parse(dbFile), testDBObj);
                done();
            });
    });

    it('allows reloading of a file from disk', function()
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

    describe("Options", function()
    {
        it('writeToDisk can be used to disable writing to disk', function(done)
        {
            var testDBObj = JSON.parse(testDB);

            db = new TDB("test", { writeToDisk: false, rootPath: rootPath });
            db.values = testDBObj;
            db.sync()
                .then(function()
                {
                    assert(!fs.existsSync(db.path), "Database wrote out to disk.");
                    done();
                });
        });

        it('loadFromDisk can be used to disable loading from disk on startup', function()
        {
            db = new TDB("tdb_test", { loadFromDisk: false, rootPath: rootPath });
            assert(db.values !== JSON.parse(testDB));
        });

        it('rootPath can be used to control where database files are written', function(done)
        {
            db = new TDB("test", { rootPath: rootPath });
            db.sync()
                .then(function()
                {
                    assert(fs.existsSync(db.path), "Database did not write out to the expected location.");
                    done();
                });
        });

        it('writeDelay can be used to control the minimum period between writes', function(done)
        {
            db = new TDB("test", { rootPath: rootPath, writeDelay: 50 });
            db.store('test-key', { test: true });

            // Check before the write should have hit
            setTimeout(function()
            {
                assert(!fs.existsSync(db.path), "Database wrote out to disk.");
            }, 20);

            // Check after the write should have hit
            setTimeout(function()
            {
                var jsonStr = fs.readFileSync(db.path).toString();
                assert.deepEqual(JSON.parse(jsonStr), {'test-key':{test:true}});
                done();
            }, 60);
        });

        it('prettyPrint can be used to control whether or not the json on disk is persisted in compact form', function(done)
        {
            db = new TDB("test", { rootPath: rootPath, prettyPrint: false });
            db.store('test-key', { test: true });

            setTimeout(function()
            {
                var jsonStr = fs.readFileSync(db.path).toString();
                assert.equal(jsonStr, '{"test-key":{"test":true}}');
                done();
            }, 20);
        });

        it('pk can be used to specify a field of the model to use as the id', function(done)
        {
            db = new TDB("test", { writeToDisk: false, pk: 'name' });
            db.store({ name: 'bob', admin: false })
                .then(function()
                {
                    assert.deepEqual(db.values, {'bob': { name: 'bob', admin: false }});
                })
                .then(done, done);
        });

        it('idFunc can be used to specify the id generation function', function(done)
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
            db.store({ name: "TrivialDB: now with id generation functions!", body: "Read the title, dude." })
                .then(function()
                {
                    assert.deepEqual(db.values, {"trivialdb-now-with-id-generation-functions":{"name":"TrivialDB: now with id generation functions!","body":"Read the title, dude."}});
                })
                .then(done, done);
        });
    });

    describe("Storing Values", function()
    {
        it('stores a value under the specified key', function(done)
        {
            db.store('test-key', { test: true })
                .then(function()
                {
                    assert('test-key' in db.values, "The key 'test-key' was not found.");
                    done();
                });
        });

        it('autogenerates a key when none is specified', function(done)
        {
            db.store({ test: true })
                .then(function(key)
                {
                    assert(key in db.values, "The key '" + key + "' was not found.");
                    done();
                });
        });
    });

    describe("Retrieving Values", function()
    {
        it('returns the value when passing in an existing key', function(done)
        {
            db.values['test-key'] = { test: true };
            db.get('test-key')
                .then(function(value)
                {
                    assert.deepEqual(value, { test: true });
                    done();
                });
        });

        it('returns undefined when passing in a nonexistent key', function(done)
        {
            db.get('does-not-exist-key')
                .then(function(value)
                {
                    assert.equal(value, undefined);
                    done();
                });
        });
    });

    describe("Updating Values", function()
    {
        it('updates the value with the partial when an existing key is passed', function(done)
        {
            db.values['test-key'] = { test: true };
            db.merge('test-key', { other: 123 })
                .then(function(newVal)
                {
                    assert.deepEqual(newVal, { test: true, other: 123 });
                    done();
                });
        });

        it('creates a new value of the partial when a nonexistent key is passed', function(done)
        {
            db.merge('test-key', { other: 123 })
                .then(function()
                {
                    db.get('test-key')
                        .then(function(val)
                        {
                            assert.deepEqual(val, { other: 123 });
                            done();
                        });
                });

        });

        it('updates deeply nested objects', function(done)
        {
            db.values['test-key'] = { test: true, nested: { subkey: { foo: "bar" }, other: 123 }};
            db.merge('test-key', { nested: { subkey: { foo: "bleh" }}})
                .then(function(newVal)
                {
                    assert.deepEqual(newVal, { test: true, nested: { subkey: { foo: "bleh" }, other: 123 }});
                    done();
                });

        });

        it('creates intermediate keys on deeply nested objects', function(done)
        {
            db.values['test-key'] = { test: true };
            db.merge('test-key', { nested: { subkey: { foo: "bleh" }}})
                .then(function(newVal)
                {
                    assert.deepEqual(newVal, { test: true, nested: { subkey: { foo: "bleh" }}});
                    done();
                });
        });
    });

    describe("Filtering Values", function()
    {
        it('filters the db using the filter function', function(done)
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" },
                'some-other-guy': { age: 16, name: "SomeOther Guy" },
                'additional-guy': { age: 11, name: "Additional Guy" }
            };

            db.filter(function(value, key)
            {
                return value.age > 30;
            }).then(function(ages)
            {
                assert.deepEqual(ages, {'some-guy': { age: 36, name: "Some Guy" }, 'also-guy': { age: 32, name: "Also Guy" }});
                done();
            });
        });

        it('supports filter objects', function(done)
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" },
                'some-other-guy': { age: 16, name: "SomeOther Guy" },
                'additional-guy': { age: 11, name: "Additional Guy" }
            };

            db.filter({ age: 32 })
                .then(function(ages)
                {
                    assert.deepEqual(ages, {'also-guy': { age: 32, name: "Also Guy" }});
                    done();
                });
        });
    });

    describe("Remove Values", function()
    {
        it('removes values by id', function(done)
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" }
            };

            db.remove('some-guy')
                .then(function()
                {
                    assert.deepEqual(db.values, {'also-guy': { age: 32, name: "Also Guy" }});
                    done();
                });
        });

        it('removes values by filter object', function(done)
        {
            db.values = {
                'some-guy': { age: 36, name: "Some Guy" },
                'also-guy': { age: 32, name: "Also Guy" }
            };

            db.remove({ age: 36 })
                .then(function()
                {
                    assert.deepEqual(db.values, {'also-guy': { age: 32, name: "Also Guy" }});
                    done();
                });
        });
    });

    describe("Syncing writes", function()
    {
        it('triggers a write to disk when called', function(done)
        {
            db = new TDB("test", { rootPath: rootPath });
            db._writeToDisk = function()
            {
                done();
                return Promise.resolve();
            };

            db.sync();
        });

        it('calls the passed in callback when the write is complete', function()
        {
            db = new TDB("test", { rootPath: rootPath });
            db.sync(function()
            {
                assert(fs.existsSync(db.path), "Database did not write out to the expected location.");
                done();
            });
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
