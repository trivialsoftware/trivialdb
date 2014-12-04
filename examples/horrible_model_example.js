//----------------------------------------------------------------------------------------------------------------------
// A playful model example, using characters from "Dr. Horrible's Sing Along Blog".
//
// @module horrible_model_example.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');
var jbase = require('../jbase');

//----------------------------------------------------------------------------------------------------------------------

function pprint(obj)
{
    return util.inspect(obj, {colors: true, depth: null});
} // end pprint

//----------------------------------------------------------------------------------------------------------------------

var Character = jbase.defineModel('characters', {
    name: { type: String, required: true },
    role: String,
    nemeses: { type: Array, default: [] },
    loveInterest: String
}, { writeToDisk: false });

// Create some new characters
var hammer = new Character({ name: "Captain Hammer", role: 'hero', nemeses: [] });
var horrible = new Character({name: "Dr. Horrible", role: 'villain', nemeses: []});
var moist = new Character({ name: "Moist", role: 'henchman', nemeses: [] });
var penny = new Character({ name: "Penny", role: 'love interest', nemeses: []});

// Save the characters
jbase.Promise.all([
        hammer.save(),
        horrible.save(),
        moist.save(),
        penny.save()
    ])
    .then(function()
    {
        // We've finished adding values, so print out the database:
        console.log('\n[Step 1] db.values:\n%s', pprint(jbase.db('characters').values));

        // Update hammer's values
        hammer.nemeses.push(horrible.id);
        hammer.loveInterest = penny.id;

        // Update horrible's values
        horrible.nemeses.push(hammer.id);
        horrible.loveInterest = penny.id;

        // Save both
        return jbase.Promise.all([
            hammer.save(),
            horrible.save()
        ]);
    })
    .then(function()
    {
        // We've finished updating values, so print out the database:
        console.log('\n[Step 2] db.values:\n%s', pprint(jbase.db('characters').values));

        // Filter for just the people who love Penny
        return Character.filter({ loveInterest: penny.id })
            .then(function(lovesPenny)
            {
                console.log('\n[Step 3] people who love Penny:\n%s', pprint(lovesPenny));
            });
    });

//----------------------------------------------------------------------------------------------------------------------