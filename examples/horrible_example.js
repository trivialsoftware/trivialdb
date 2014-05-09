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
var hammerID = db.store({ name: "Captain Hammer", role: 'hero', nemeses: [] });
var horribleID = db.store({ name: "Dr. Horrible", role: 'villian', nemeses: [] });
var moistID = db.store({ name: "Moist", role: 'henchman', nemeses: [] });
var pennyID = db.store({ name: "Penny", role: 'love interest', nemeses: []});

console.log('[Step 1] db.values:\n%s', pprint(db.values));

// Update some values
db.merge(hammerID, { nemeses: [horribleID], loveInterest: pennyID });
db.merge(horribleID, { nemeses: [hammerID], loveInterest: pennyID });

console.log('[Step 2] db.values:\n%s', pprint(db.values));

// Find everyone for whom Penny is a love interest
var lovesPenny = db.filter(function(key, value)
{
    return value.loveInterest == pennyID;
});

console.log('[Step 3] people who love Penny:\n%s', pprint(lovesPenny));

//----------------------------------------------------------------------------------------------------------------------