//----------------------------------------------------------------------------------------------------------------------
// A playful example, using characters from "Dr. Horrible's Sing Along Blog".
//
// @module horrible_example.js
//----------------------------------------------------------------------------------------------------------------------

var Promise = require('bluebird');
var util = require('util');
var trivialdb = require('../trivialdb');

//----------------------------------------------------------------------------------------------------------------------

function pprint(obj)
{
    return util.inspect(obj, {colors: true, depth: null});
} // end pprint

//----------------------------------------------------------------------------------------------------------------------

// Create a new example db
var db = trivialdb.db('example', { writeToDisk: false });

// Create some new keys
var hammerID, horribleID, moistID, bhSingerID, pennyID;
Promise.resolve()
    .then(() =>
    {
        return Promise.join(
            db.save({ name: "Captain Hammer", role: 'hero', nemeses: [] }).then((id) => { hammerID = id; }),
            db.save({ name: "Dr. Horrible", role: 'villain', nemeses: [] }).then((id) => { horribleID = id; }),
            db.save({ name: "Moist", role: 'henchman', nemeses: [] }).then((id) => { moistID = id; }),
            db.save({ name: "Bad Horse Singer", role: 'henchman', nemeses: [] }).then((id) => { bhSingerID = id; }),
            db.save({ name: "Penny", role: 'love interest', nemeses: [] }).then((id) => { pennyID = id; })
        );
    })
    .then(() =>
    {
        // We've finished adding values, so print out the database:
        console.log('\n[Step 1] db.values:\n%s', pprint(db.values));
    })
    .then(() =>
    {
        // Update some values
        var hammer = db.get(hammerID);
        hammer.nemeses = [horribleID];
        hammer.loveInterest = pennyID;

        return db.save(hammer);
    })
    .then(() =>
    {
        // Update some values
        var horrible = db.get(horribleID);
        horrible.nemeses = [hammerID];
        horrible.loveInterest = pennyID;
        return db.save(horrible);
    })
    .then(() =>
    {
        // Update some values
        var moist = db.get(moistID);
        moist.henchesFor = horribleID;
        return db.save(moist);
    })
    .then(() =>
    {
        // We've finished updating values, so print out the database:
        console.log('\n[Step 2] db.values:\n%s', pprint(db.values));
    })
    .then(() =>
    {
        // Find everyone for whom Penny is a love interest
        var lovesPenny = db.filter({ loveInterest: pennyID });

        // Print out everyone who loves Penny
        console.log('\n[Step 3] people who love Penny:\n%s', pprint(lovesPenny));
    })
    .then(() =>
    {
        // Find every henchman who henches for Dr. Horrible
        var horribleHenches = db.query()
            .filter({ role: 'henchman' })
            .filter({ henchesFor: horribleID })
            .run();

        // Print out everyone who loves Penny
        console.log('\n[Step 3] Henchmen who hench for Dr. Horrible:\n%s', pprint(horribleHenches));
    });

//----------------------------------------------------------------------------------------------------------------------