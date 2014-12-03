//----------------------------------------------------------------------------------------------------------------------
// A playful example, using characters from "Dr. Horrible's Sing Along Blog".
//
// @module horrible_example.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');
var jbase = require('../jbase');

//----------------------------------------------------------------------------------------------------------------------

function pprint(obj)
{
    return util.inspect(obj, {colors: true, depth: null});
} // end pprint

//----------------------------------------------------------------------------------------------------------------------

// Create a new example db
var db = jbase.db('example', { writeToDisk: false });

// Create some new keys
var hammerID, horribleID, moistID, pennyID;
db.store({ name: "Captain Hammer", role: 'hero', nemeses: [] })
    .then(function(id)
    {
        hammerID = id;
        return db.store({name: "Dr. Horrible", role: 'villain', nemeses: []});
    })
    .then(function(id)
    {
        horribleID = id;
        return db.store({ name: "Moist", role: 'henchman', nemeses: [] });
    })
    .then(function(id)
    {
        moistID = id;
        return db.store({ name: "Penny", role: 'love interest', nemeses: []});
    })
    .then(function(id)
    {
        pennyID = id;

        // We've finished adding values, so print out the database:
        console.log('\n[Step 1] db.values:\n%s', pprint(db.values));
    })
    .then(function()
    {
        // Update some values
        return db.merge(hammerID, { nemeses: [horribleID], loveInterest: pennyID });
    })
    .then(function()
    {
        // Update some values
        return db.merge(horribleID, { nemeses: [hammerID], loveInterest: pennyID });
    })
    .then(function()
    {
        // We've finished updating values, so print out the database:
        console.log('\n[Step 2] db.values:\n%s', pprint(db.values));
    })
    .then(function()
    {
        // Find everyone for whom Penny is a love interest
        return db.filter(function(key, value)
        {
            return value.loveInterest == pennyID;
        });
    })
    .then(function(lovesPenny)
    {
        // Finally, print out everyone who loves Penny
        console.log('\n[Step 3] people who love Penny:\n%s', pprint(lovesPenny));
    });

//----------------------------------------------------------------------------------------------------------------------