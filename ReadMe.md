# JBase

A lightweight key/value json storage with persistence. Conceptually, it's just a thin api wrapper around plain javascript
objects; with the added bonus of doing throttled asynchronous writes on changes. Its on disk format is simply "json on
disk"; basically the jsonified version of the plain object, saved to a file on disk.

## Use Case

Jbase is intended for simple storage needs. It's in-process, small, and very fast for small data sets. It takes almost
nothing to get up and going with it, and it has just enough features to make it worth while. Personally I've found its
a great fit for a development database for websites, or even to power a simple blog.

The one caveat to keep in mind is this: _every database your work with is stored in memory_. Since jbase is in-process,
you might run into the memory limit of node; on versions before 0.11 there's a 1.4GB limit. If you try and load a
database of all your cat pictures, you might run out of memory pretty quickly.

## Installation

Simply install with npm:

```bash
$ npm install --save jbase
```

## API

The jbase api is inspired (spiritually) by [RethinkDB](http://rethinkdb.com/) and it's node.js ORM,
[thinky](http://thinky.io/). These are two great projects, and once you outgrow jbase, I strongly encourage you to
check them out!

### Loading or saving databases

* `db(databaseName, options)` - Returns a database instance.

Jbase lazily loads databases. Jbase also creates databases if they don't exist. To load or create a database:

```javascript
// Open or create a database
var db = jbase.db('some_db');

// Open or create a database, with options
var db = jbase.db('some_db', { writeToDisk: false });
```

This will look for a file named `"./some_db.json"`. (If your database lives somewhere else, you can pass the `rootPath`
option in to the `db` call.)

#### Options

The options supported by the `db` call are:

```javascript
{
    writeToDisk: true | false,  // Whether or not to persist the database to disk. (Default: `true`)
    loadFromDisk: true | false, // Whether or not to read the database in from disk on load. (Default: `true`)
    rootPath: "...",            // The path to a folder that will contain the persisted database json files. (Default: './')
    writeDelay: ...,            // A number in miliseconds to wait between writes to the disk. (Default: 0)
    prettyPrint: true | false   // Whether or not the json on disk should be pretty printed. (Default: `true`)
}
```

### Storing Values

* `store(value)` - Returns `key`.
* `store(key, value)` - Returns `key`.

Since jbase is a key/value storage, all values are stored under a key. This key is not part of the value that gets stored,
since jbase never modifies your value. Also, while you can specify a key, you will need to ensure it's unique (otherwise
it'll silently overwrite). Instead, I recommend you let jbase create the key for you (by not passing one).

```javascript
// Store an object
var key = db.store({ foo: "bar!", test: "Apples" });

// Store an object with key
var key = db.store('my_key', { foo: "bar!", test: "Apples" });
```

### Retrieving Values

* `get(key)` - Returns value or `undefined`.

Jbase only supports direct lookups by key. It returns the value stored.

```javascript
// Get an object
var obj = db.get('my_key');
```

### Updating Values

* `merge(key, partialObj)` - Returns the new value.

Jbase support partial object updates. Jbase will take whatever object you pass in, and merge that object with the value
stored at that key. If there is no value, it works exactly like `store`. The resulting object is returned.

```javascript
// Update an object
var obj = db.merge('my_key', { test: "Oranges" });

```

### Filter Queries

* `filter(filterFunc)` - Returns an object of filtered values.
* `filter(filterFunc, callback)` - No return value.

Sometimes, you need to query based on more than just the key. To do that, jbase gives you a very simple filter query. It
iterates over every value in the database, and passes that into your filter function. If the function returns true, that
value is included in the results, otherwise it's omitted.

There are sync and async versions of this function; if you pass a callback, it's async, otherwise it's considered sync.

```javascript
// Filter objects
var results = db.filter(function(key, value) {
    // Decide if you want this object
    return value.foo === 'bar!';
});

// Filter objects asynchronously
db.filter(function(key, value) {
    // Decide if you want this object
    return value.foo === 'bar!';
}, function(results) {
    // Do something with results here.
});
```

### Direct Access

* `sync()` - No return value.
* `sync(callback)` - No return value.

You can directly access the key/value store with the `values` property on the database instance. This is exposed
explicitly to allow you as much freedom to work with it as you might want. However, jbase doesn't detect any changes you
make, so you will need to call the `sync` function to get your changes to persist to disk.

```javascript
// Add a new key manually
db.values['foobar'] = { test: "something" };

// Sync that new key to disk
db.sync();
```

The `sync` function also supports passing in a callback so you can know when the sync is completed.

```javascript
// Add a new key manually
db.values['foobar'] = { test: "something" };

// Sync that new key to disk
db.sync(function()
{
    // Sync is done!
});
```

Also, you should feel free to iterate over the values object if you need to do any advanced filtering. All the same
caveats of working with a plain javascript object apply.
