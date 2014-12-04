// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the models.spec.js module.
//
// @module models.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var assert = require("assert");

var jbase = require('../jbase');
var errors = require('../lib/errors');
var models = require('../lib/models');

// ---------------------------------------------------------------------------------------------------------------------

describe('Models', function()
{

    var TestModel;
    beforeEach(function(done)
    {
        TestModel = jbase.defineModel('model_test', {
            name: { type: String, required: true },
            admin: { type: Boolean, default: false, required: true },
            foo: Number
        }, { writeToDisk: false });

        // Populate the database
        jbase.Promise.all([
                jbase.db('model_test').store('test1', { name: 'foobar', admin: false }),
                jbase.db('model_test').store('test2', { name: 'barbaz', admin: true }),
                jbase.db('model_test').store('test3', { name: 'foo 2', admin: false, foo: 3 }),
                jbase.db('model_test').store('test4', { name: 'glipi', admin: true, foo: -1.5 })
            ])
            .then(function()
            {
                done();
            });

    });

    describe('Model Instance', function()
    {
        it('can convert to simple json', function()
        {
            var test = new TestModel({ name: 'test' });
            var testJSON = JSON.stringify(test);

            assert.deepEqual(JSON.parse(testJSON), { name: 'test', admin: false });
        });

        it('can save new instances', function(done)
        {
            var test = new TestModel({ name: 'test' });

            test.save().then(function()
            {
                // Ensure the document is saved in the db correctly.
                jbase.db('model_test').get(test.id).then(function(doc)
                {
                    assert.deepEqual(doc, { id: test.id, name: 'test', admin: false });
                    done();
                });
            });
        });

        it('can update existing instances', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                test.admin = true;
                test.save().then(function()
                {
                    // Ensure the document is saved in the db correctly.
                    jbase.db('model_test').get(test.id).then(function(doc)
                    {
                        assert.deepEqual(doc, { id: test.id, name: 'foobar', admin: true });
                        done();
                    });
                });
            });
        });

        it('validated before it saves', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                test.admin = 'true';
                test.save().then(function()
                {
                    assert(false, "Did not throw an error.");
                    done();
                })
                .catch(errors.ValidationError, function()
                {
                    done();
                });
            });
        });

        it('can validate models without saving', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                test.admin = 'true';
                test.validate()
                    .then(function()
                    {
                        assert(false, "Did not throw an error.");
                        done();
                    })
                    .catch(errors.ValidationError, function()
                    {
                        done();
                    });
            });
        });

        it('automatically updates when the db changes', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                assert.equal(test.admin, false);

                jbase.db('model_test').merge('test1', { admin: true })
                    .then(function()
                    {
                        assert.equal(test.admin, true);
                        done();
                    });
            });
        });

        it('does not update automatically when the model is dirty', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                assert.equal(test.admin, false);

                test.foo = 23;

                assert.equal(test.$dirty, true);

                jbase.db('model_test').merge('test1', { admin: true })
                    .then(function()
                    {
                        assert.equal(test.admin, false);
                        done();
                    });
            });
        });

        it('can force a sync', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                assert.equal(test.admin, false);

                test.foo = 23;

                assert.equal(test.$dirty, true);

                jbase.db('model_test').merge('test1', { admin: true })
                    .then(function()
                    {
                        assert.equal(test.admin, false);

                        test.sync(true)
                            .then(function()
                            {
                                assert.equal(test.admin, true);
                                assert.equal(test.foo, undefined);
                                done();
                            });
                    });
            });
        });
    });

    describe('Model API', function()
    {
        it('can retrieve model instances by id', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                assert.deepEqual(test.$$values, { id: 'test1', name: 'foobar', admin: false });
                done();
            });
        });

        it('returns a DocumentNotFoundError when attempting to retrieve an non-existent id', function(done)
        {
            TestModel.get('does-not-exist')
                .then(function(test)
                {
                    assert(false, "Did not throw an error.");
                    done();
                })
                .catch(errors.DocumentNotFound, function()
                {
                    done();
                });
        });

        it('can filter all models down to a subset', function(done)
        {
            TestModel.filter({ admin: true })
                .then(function(filtered)
                {
                    assert.equal(filtered.length, 2);
                    done()
                });
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------