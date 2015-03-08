// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the models.spec.js module.
//
// @module models.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var _ = require('lodash');
var assert = require("assert");

var trivialdb = require('../trivialdb');
var errors = require('../lib/errors');

// ---------------------------------------------------------------------------------------------------------------------

describe('Models', function()
{

    var TestModel, PKTestModel, DateTestModel;
    beforeEach(function(done)
    {
        TestModel = trivialdb.defineModel('model_test', {
            name: { type: String, required: true },
            admin: { type: Boolean, default: false, required: true },
            foo: Number,
            choice: { type: String, choices: ['foo', 'bar'] },
            toppings: { type: Array, choices: ['cheese', 'pepperoni', 'mushrooms'] }
        }, { writeToDisk: false });

        DateTestModel = trivialdb.defineModel('date_model_test', {
            name: { type: String, required: true },
            created: { type: Date, default: Date.now() }
        }, { writeToDisk: false });

        PKTestModel = trivialdb.defineModel('pk_model_test', {
            name: { type: String, required: true },
            admin: { type: Boolean, default: false, required: true }
        }, { writeToDisk: false, pk: 'name' });

        // Populate the database
        trivialdb.Promise.all([
                trivialdb.db('model_test').store('test1', { name: 'foobar', admin: false }),
                trivialdb.db('model_test').store('test2', { name: 'barbaz', admin: true }),
                trivialdb.db('model_test').store('test3', { name: 'foo 2', admin: false, foo: 3 }),
                trivialdb.db('model_test').store('test4', { name: 'glipi', admin: true, foo: -1.5 })
            ])
            .then(function()
            {
                return trivialdb.Promise.all([
                    trivialdb.db('pk_model_test').store({ name: 'foobar', admin: false }),
                    trivialdb.db('pk_model_test').store({ name: 'barbaz', admin: true })
                ]);
            })
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

            test.save().then(function(test)
            {
                // Ensure the document is saved in the db correctly.
                trivialdb.db('model_test').get(test.id).then(function(doc)
                {
                    assert.deepEqual(doc, { id: test.id, name: 'test' });
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
                    trivialdb.db('model_test').get(test.id).then(function(doc)
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

        it('can remove models', function(done)
        {
            TestModel.get('test1').then(function(test)
            {
                test.remove()
                    .then(function()
                    {
                        return TestModel.get('test1');
                    })
                    .then(function()
                    {
                        assert(false, "Did not throw an error.");
                        done();
                    })
                    .catch(errors.DocumentNotFound, function()
                    {
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

                trivialdb.db('model_test').merge('test1', { admin: true })
                    .then(function()
                    {
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

        it('can specify a primary key', function(done)
        {
            PKTestModel.get('foobar')
                .then(function(test)
                {
                    assert(test.id === test.name, "The 'id' property does not point to the correct field.");
                })
                .then(function()
                {
                    // Test saving
                    return new PKTestModel({ name: 'tom', admin: true }).save()
                        .then(function(test2)
                        {
                            assert(test2.id === test2.name, "The 'id' property does not point to the correct field.");
                            assert(test2.$$values.id === undefined, "The model has an 'id' property in $$values.");
                        });
                })
                .then(done, done);
        });

        it('correctly handles Date objects', function(done)
        {
            new DateTestModel({ name: "FredGeorge" }).save()
                .then(function(test)
                {
                    assert(_.isDate(test.created));
                })
                .then(done, done);
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
                .then(function()
                {
                    assert(false, "Did not throw an error.");
                    done();
                })
                .catch(errors.DocumentNotFound, function()
                {
                    done();
                });
        });

        it('can retrieve all models', function(done)
        {
            TestModel.all()
                .then(function(allModels)
                {
                    assert.equal(allModels.length, 5);
                })
                .then(done, done);
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

        describe('Remove', function()
        {
            it('can remove model instances by id', function(done)
            {
                TestModel.remove('test2')
                    .then(function()
                    {
                        TestModel.get('test2')
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                                done();
                            })
                            .catch(errors.DocumentNotFound, function()
                            {
                                done();
                            });
                    });
            });

            it('can remove model instances by a filter', function(done)
            {
                TestModel.remove({ admin: true })
                    .then(function()
                    {
                        TestModel.get('test2')
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                                done();
                            })
                            .catch(errors.DocumentNotFound, function()
                            {
                                done();
                            });
                    });
            });

            it('can remove all instances', function(done)
            {
                TestModel.removeAll()
                    .then(function()
                    {
                        TestModel.get('test4')
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                                done();
                            })
                            .catch(errors.DocumentNotFound, function()
                            {
                                done();
                            });
                    });
            });
        });

        describe('Validation', function()
        {
            it('validates a correct instance', function(done)
            {
                TestModel.get('test1').then(function(test)
                {
                    test.admin = true;
                    test.choice = 'bar';
                    test.toppings = ['cheese', 'mushrooms'];
                    test.validate()
                        .then(function()
                        {
                            done();
                        })
                        .catch(errors.ValidationError, function(error)
                        {
                            done(error);
                        });
                });
            });

            it('fails to validate when missing a required field', function(done)
            {
                TestModel.get('test1').then(function(test)
                {
                    test.admin = null;
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

            it('fails to validate an incorrect type', function(done)
            {
                TestModel.get('test1').then(function(test)
                {
                    test.admin = 3;
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

            it('fails to validate an invalid choice', function(done)
            {
                TestModel.get('test1').then(function(test)
                {
                    test.choice = 'baz';
                    test.toppings = ['cheese', 'pineapple'];
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
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------