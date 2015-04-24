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

    var TestModel, DateTestModel, PKTestModel, NestedTestModel;
    beforeEach(function()
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

        NestedTestModel = trivialdb.defineModel('nested_test_model', {
            name: String,
            test: {
                foo: String,
                bar: Number
            }
        }, { writeToDisk: false, pk: 'name' });

        // Populate the database
        return trivialdb.Promise.all([
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
                return trivialdb.Promise.all([
                    trivialdb.db('nested_test_model').store({ name: 'nt1', test: { foo: "Bar!", bar: 3 } }),
                    trivialdb.db('nested_test_model').store({ name: 'nt2', test: { foo: "apples"} })
                ]);
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

        it('can save new instances', function()
        {
            var test = new TestModel({ name: 'test' });

            return test.save().then(function(test)
            {
                // Ensure the document is saved in the db correctly.
                return trivialdb.db('model_test').get(test.id).then(function(doc)
                {
                    assert.deepEqual(doc, { id: test.id, name: 'test' });
                });
            });
        });

        it('can update existing instances', function()
        {
            return TestModel.get('test1').then(function(test)
            {
                test.admin = true;
                return test.save().then(function()
                {
                    // Ensure the document is saved in the db correctly.
                    return trivialdb.db('model_test').get(test.id).then(function(doc)
                    {
                        assert.deepEqual(doc, { id: test.id, name: 'foobar', admin: true });
                    });
                });
            });
        });

        it('validated before it saves', function()
        {
            return TestModel.get('test1').then(function(test)
            {
                test.admin = 'true';
                return test.save().then(function()
                {
                    assert(false, "Did not throw an error.");
                })
                .catch(errors.ValidationError, function() {});
            });
        });

        it('can validate models without saving', function()
        {
            return TestModel.get('test1').then(function(test)
            {
                test.admin = 'true';
                return test.validate()
                    .then(function()
                    {
                        assert(false, "Did not throw an error.");
                    })
                    .catch(errors.ValidationError, function() {});
            });
        });

        it('can remove models', function()
        {
            return TestModel.get('test1').then(function(test)
            {
                return test.remove()
                    .then(function()
                    {
                        return TestModel.get('test1');
                    })
                    .then(function()
                    {
                        assert(false, "Did not throw an error.");
                    })
                    .catch(errors.DocumentNotFound, function() {});
            });
        });

        it('can force a sync', function()
        {
            return TestModel.get('test1').then(function(test)
            {
                assert.equal(test.admin, false);

                test.foo = 23;

                assert.equal(test.$dirty, true);

                return trivialdb.db('model_test').merge('test1', { admin: true })
                    .then(function()
                    {
                        return test.sync(true)
                            .then(function()
                            {
                                assert.equal(test.admin, true);
                                assert.equal(test.foo, undefined);
                            });
                    });
            });
        });

        it('can specify a primary key', function()
        {
            return PKTestModel.get('foobar')
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
                });
        });

        it('correctly handles Date objects', function()
        {
            return new DateTestModel({ name: "FredGeorge" }).save()
                .then(function(test)
                {
                    assert(_.isDate(test.created));
                });
        });

        it('supports nested schemas', function()
        {
            return NestedTestModel.get('nt1')
                .then(function(model)
                {
                    assert.equal(model.test.foo, "Bar!");
                })
                .then(function()
                {
                    return (new NestedTestModel({ name: 'foo', test: { bar: 5 } })).save()
                        .then(function(model)
                        {
                            assert.equal(model.test.bar, 5);
                        });
                });
        });
    });

    describe('Model API', function()
    {
        it('can retrieve model instances by id', function()
        {
            return TestModel.get('test1').then(function(test)
            {
                assert.deepEqual(test.$$values, { id: 'test1', name: 'foobar', admin: false });
            });
        });

        it('returns a DocumentNotFoundError when attempting to retrieve an non-existent id', function()
        {
            return TestModel.get('does-not-exist')
                .then(function()
                {
                    assert(false, "Did not throw an error.");
                })
                .catch(errors.DocumentNotFound, function() {});
        });

        it('can retrieve all models', function()
        {
            return TestModel.all()
                .then(function(allModels)
                {
                    assert.equal(allModels.length, 5);
                });
        });

        it('can filter all models down to a subset', function()
        {
            return TestModel.filter({ admin: true })
                .then(function(filtered)
                {
                    assert.equal(filtered.length, 2);
                });
        });

        describe('Remove', function()
        {
            it('can remove model instances by id', function()
            {
                return TestModel.remove('test2')
                    .then(function()
                    {
                        return TestModel.get('test2')
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                            })
                            .catch(errors.DocumentNotFound, function() {});
                    });
            });

            it('can remove model instances by a filter', function()
            {
                return TestModel.remove({ admin: true })
                    .then(function()
                    {
                        return TestModel.get('test2')
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                            })
                            .catch(errors.DocumentNotFound, function() {});
                    });
            });

            it('can remove all instances', function()
            {
                return TestModel.removeAll()
                    .then(function()
                    {
                        return TestModel.get('test4')
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                            })
                            .catch(errors.DocumentNotFound, function() {});
                    });
            });
        });

        describe('Validation', function()
        {
            it('validates a correct instance', function()
            {
                return TestModel.get('test1').then(function(test)
                {
                    test.admin = true;
                    test.choice = 'bar';
                    test.toppings = ['cheese', 'mushrooms'];
                    return test.validate();
                });
            });

            it('fails to validate when missing a required field', function()
            {
                return TestModel.get('test1').then(function(test)
                {
                    test.admin = null;
                    return test.validate()
                        .then(function()
                        {
                            assert(false, "Did not throw an error.");
                        })
                        .catch(errors.ValidationError, function() {});
                });
            });

            it('fails to validate an incorrect type', function()
            {
                return TestModel.get('test1').then(function(test)
                {
                    test.admin = 3;
                    return test.validate()
                        .then(function()
                        {
                            assert(false, "Did not throw an error.");
                        })
                        .catch(errors.ValidationError, function() {});
                });
            });

            it('fails to validate an invalid choice', function()
            {
                return TestModel.get('test1').then(function(test)
                {
                    test.choice = 'baz';
                    test.toppings = ['cheese', 'pineapple'];
                    return test.validate()
                        .then(function()
                        {
                            assert(false, "Did not throw an error.");
                        })
                        .catch(errors.ValidationError, function() {});
                });
            });

            it('fails to validate an incorrect type on a nested field', function()
            {
                return NestedTestModel.get('nt2')
                    .then(function(model)
                    {
                        assert.equal(model.test.foo, "apples");

                        model.test.bar = "omg!";
                        return model.validate()
                            .then(function()
                            {
                                assert(false, "Did not throw an error.");
                            })
                            .catch(errors.ValidationError, function() {});
                    });
            });
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
