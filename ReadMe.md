# JBase

A lightweight key/value json storage with persistence. Conceptually, it's just a thin API wrapper around plain javascript
objects; with the added bonus of doing throttled asynchronous writes on changes. Its on disk format is simply "json on
disk"; basically the jsonified version of the plain object, saved to a file on disk. This makes making hand edits not
just possible, but simple.

## Use Case

JBase is intended for simple storage needs. It's in-process, small, and very fast for small data sets. It takes almost
nothing to get up and going with it, and it has just enough features to make it worth while. Personally I've found its
a great fit for a development database for websites, or even to power a simple blog.

The one caveat to keep in mind is this: _every database your work with is stored in memory_. Since JBase is in-process,
you might run into the memory limit of node; on versions before 0.11+ there's a 1.4GB limit. If you try and load a
database of all your cat pictures, you might run out of memory pretty quickly.

That being said, this isn't actually much of a limitation. Generally, you're working with a large amount of your data
in memory anyway; your data sets can get relatively large before you even need to worry about this.

## Installation

Simply install with npm:

```bash
$ npm install --save jbase
```

## API

The JBase API is inspired (spiritually) by [RethinkDB](http://rethinkdb.com/) and it's node.js ORM,
[thinky](http://thinky.io/). These are two great projects, and once you outgrow JBase, I strongly encourage you to
check them out!

### **New in 1.0.0**

The API has recently changed. As I've been building projects, I've discovered that Promise-based APIs are both elegant
and incredibly convenient. I have opted to make the almost entire API promise-based. This has a small performance hit on
individual operations, however, it also makes all calls asynchronous, which helps with JBase's ability to handle load.

If you do not like promises, or disagree with this change, then I recommend using
[v0.9.0](https://github.com/Morgul/jbase/releases/tag/v0.9.0).

### Promises

JBase exposes our internal Promise object as `.Promise`, so you can leverage it if you want to. (We use bluebird.)

```javascript
var jbase = require('jbase');
var Promise = jbase.Promise;

// Work with `Promise` here
```

### Loading or saving databases

* `db(databaseName, options)` - Returns a database instance.

JBase lazily loads databases. JBase also creates databases if they don't exist. To load or create a database:

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
    writeDelay: ...,            // A number in milliseconds to wait between writes to the disk. (Default: 0)
    prettyPrint: true | false   // Whether or not the json on disk should be pretty printed. (Default: `true`)
}
```

### Storing Values

* `store(value)` - Returns a promise resolved with `key`.
* `store(key, value)` - Returns a promise resolved with `key`.

Since JBase is a key/value storage, all values are stored under a key. This key is not part of the value that gets stored,
since JBase never modifies your value. Also, while you can specify a key, you will need to ensure it's unique (otherwise
it will silently overwrite). Instead, I recommend you let JBase create the key for you (by not passing one).

When you let JBase auto generate the key, you can find out what that key was by using `.then()`, which will be passed
the newly generated key.

```javascript
// Store an object
db.store({ foo: "bar!", test: "Apples" })
    .then(function(key)
    {
        // Work with `key` here
    };

// Store an object with key
db.store('my_key', { foo: "bar!", test: "Apples" })
    .then(function(key)
    {
        // `key` == 'my_key'
    };
```

### Retrieving Values

* `get(key)` - Returns a promise resolved to the value or `undefined`.

JBase only supports direct lookups by key. It returns a promise resolved to the value stored.

```javascript
// Get an object
db.get('my_key')
    .then(function(val)
    {
        // Work with `val` here
    });
```

### Updating Values

* `merge(key, partialObj)` - Returns a promise resolved to the new value.

JBase support partial object updates. JBase will take whatever object you pass in, and merge that object with the value
stored at that key. If there is no value, it works exactly like `store`. The resulting object is returned.

```javascript
// Update an object
db.merge('my_key', { test: "Oranges" })
    .then(function(obj)
    {
        // Work with `obj` here
    });

```

### Filter Queries

* `filter(filterFunc)` - Returns a promise resolved to an object of filtered values.

Sometimes, you need to query based on more than just the key. To do that, JBase gives you a very simple filter query. It
iterates over every value in the database, and passes that into your filter function. If the function returns true, that
value is included in the results, otherwise it's omitted.

```javascript
// Filter objects
db.filter(function(key, value)
{
    // Decide if you want this object
    return value.foo === 'bar!';
}).then(function(results)
{
    // Work with `results` here.
});
```

### Direct Access

* `sync()` - Returns a promise resolved once the database is considered 'settled'.

You can directly access the key/value store with the `values` property on the database instance. This is exposed
explicitly to allow you as much freedom to work with your data as you might want. However, JBase can't detect any
changes you make directly, so you will need to call the `sync` function to get your changes to persist to disk.

```javascript
// Add a new key manually
db.values['foobar'] = { test: "something" };

// Sync that new key to disk
db.sync();
```

The `sync` function returns a promise that is resolved once the database has 'settled', as in, there are not more
scheduled writes. Because of this behavior, you should consider whether or not you want to wait on it's promise. Under
high load, (or with a high `writeDelay`) it's possible for a `sync` promise's resolution to be considerably delayed.

```javascript
// Add a new key manually
db.values['foobar'] = { test: "something" };

// Sync that new key to disk
db.sync()
    .then(function()
    {
        // Sync is done, db is settled
    });
```

Also, you should feel free to iterate over the values object if you need to do any advanced filtering. All the same
caveats of working with a plain javascript object apply. Just remember to call `sync` if you've made any modifications.

## Status

JBase is reasonably stable, and since the code base is small enough, it's relatively immune to the most common forms of
'code rot'. I make improvements when they're needed, or if someone files an issue. That being said, I consider JBase
'production ready', provided you meet the intended use case.

## Contributing

While I only work on JBase in my spare time (what little there is), I use it for several of my projects. I'm more than
happy to accept merge requests, and/or any issues filed. If you want to fork it and improve part of the API, I'm ok with
that too, however I ask you open an issue to discuss your proposed changes _first_. And, since it's MIT licensed, you
can, of course, take the code and use it in your own projects.