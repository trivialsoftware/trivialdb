# TrivialDB

[![Build Status](https://travis-ci.org/Morgul/trivialdb.svg?branch=master)](https://travis-ci.org/Morgul/trivialdb)

A lightweight key/value json storage with persistence. Conceptually, it's just a thin API wrapper around plain javascript
objects; with the added bonus of doing throttled asynchronous writes on changes. Its on disk format is simply "json on
disk"; basically the json version of the plain object, saved to a file on disk. This makes making hand edits not
just possible, but simple.

## Use Case

TrivialDB is intended for simple storage needs. It's in-process, small, and very fast for small data sets. It takes almost
nothing to get up and going with it, and it has just enough features to make it worth while. Personally I've found its
a great fit for a development database for websites, or even to power a simple blog.

The one caveat to keep in mind is this: _every database your work with is stored in memory_. Since TrivialDB is in-process,
you might run into the memory limit of node; on versions before 0.11+ there's a 1.4GB limit. If you try and load a
database of all your cat pictures, you might run out of memory pretty quickly.

That being said, this isn't actually much of a limitation. Generally, you're working with a large amount of your data
in memory anyway; your data sets can get relatively large before you even need to worry about this.

## Installation

Simply install with npm:

```bash
$ npm install --save trivialdb:
```

## API

### Database API

This is the API that previous versions of TrivialDB pioneered. It's relatively low-level, and if that's how you'd rather
work with your database, that's fine. It is still the primary focus of TrivialDB.

#### Loading or saving databases

* `db(databaseName, options)` - Returns a database instance.

TrivialDB lazily loads databases. TrivialDB also creates databases if they don't exist. To load or create a database:

```javascript
// Open or create a database
var db = trivialdb.db('some_db');

// Open or create a database, with options
var db = trivialdb.db('some_db', { writeToDisk: false });
```

This will look for a file named `"./some_db.json"`. (If your database lives somewhere else, you can pass the `rootPath`
option in to the `db` call.)

You can request the same database multiple times, and get back the same instance. This allows you to request the
database by name in different places in your code, and not worry about the two database instance fighting with each
other. (The previous behavior was clearly broken, and resulted in very strange issues.)

_Note_: When you request a database any other time than the first, the options are ignored. There is currently no way to
change a database's options at run time.

##### Options

The options supported by the `db` call are:

```javascript
{
    writeToDisk: true | false,  // Whether or not to persist the database to disk. (Default: `true`)
    loadFromDisk: true | false, // Whether or not to read the database in from disk on load. (Default: `true`)
    rootPath: "...",            // The path to a folder that will contain the persisted database json files. (Default: './')
    writeDelay: ...,            // A number in milliseconds to wait between writes to the disk. (Default: 0)
    prettyPrint: true | false,  // Whether or not the json on disk should be pretty printed. (Default: `true`)
    pk: "...",                  // The field in the object to use as the primary key. (Default: `undefined`)
    idFunc: function(){...}     // The function to use to generate unique ids. (Default: `uuid.v4()`)
}
```

##### Custom ID Generation

If you want to generate your own ids, and not use the uuids TrivialDB generates by default, you can specify your own
function in the database options. By specifying `idFunc`, TrivialDB will use this function to generate all ids, when needed.
The `idFunc` function is passed the object, so you can generate ids based on the object's content, if you wish. (An
example of this would be generating a slug from an article's name.)

```javascript
function slugify(article)
{
    return article.name.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
} // end slugify

// Declare a new database, using the slugify function above.
db = new JDB("articles", { writeToDisk: false, idFunc: slugify });

// Now, we save an object
db.store({ name: "TrivialDB: now with id generation functions!", body: "Read the title, dude." })
    .then(function(id)
    {
        // This prints the id: 'trivialdb-now-with-id-generation-functions'.
        console.log('id:', id);
    });
```

Be careful; it is up to you to ensure your generated ids are unique. Additionally, if your generation function blows up,
TrivialDB may return some nonsensical errors. (This may improve in the future.)

#### Storing Values

* `store(value)` - Returns a promise resolved with `key`.
* `store(key, value)` - Returns a promise resolved with `key`.

Since TrivialDB is a key/value storage, all values are stored under a key. This key is not part of the value that gets stored,
since TrivialDB never modifies your value. Also, while you can specify a key, you will need to ensure it's unique (otherwise
it will silently overwrite). Instead, I recommend you let TrivialDB create the key for you (by not passing one).

When you let TrivialDB auto generate the key, you can find out what that key was by using `.then()`, which will be passed
the newly generated key. This auto generation is done using the `idFunc` function passed in the options. If not
specified, it will use `node-uuid` to generate uuids.

```javascript
// Store an object
db.store({ foo: "bar!", test: "Apples" })
    .then(function(key)
    {
        // Work with `key` here
    };

var key = undefined
// We support auto generating keys whenever the key parameter is undefined.
db.store(key, { foo: "bar!", test: "Apples" })
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

#### Retrieving Values

* `get(key)` - Returns a promise resolved to the value or `undefined`.

TrivialDB only supports direct lookups by key. It returns a promise resolved to the value stored.

```javascript
// Get an object
db.get('my_key')
    .then(function(val)
    {
        // Work with `val` here
    });
```

#### Updating Values

* `merge(key, partialObj)` - Returns a promise resolved to the new value.

TrivialDB support partial object updates. TrivialDB will take whatever object you pass in, and merge that object with the value
stored at that key. If there is no value, it works exactly like `store`. The resulting object is returned.

```javascript
// Update an object
db.merge('my_key', { test: "Oranges" })
    .then(function(obj)
    {
        // Work with `obj` here
    });

```

#### Filter Queries

* `filter(filter)` - Returns a promise resolved to an object of filtered values.

Sometimes, you need to query based on more than just the key. To do that, TrivialDB gives you a very simple filter query. It
iterates over every value in the database, and passes that into your filter function. If the function returns true, that
value is included in the results, otherwise it's omitted.

```javascript
// Filter Function
db.filter(function(value, key)
{
    // Decide if you want this object
    return value.foo === 'bar!';
}).then(function(results)
{
    // Work with `results` here.
});
```

You can also pass in filter objects. We switched to using lodash under the hood, so we support their `_.pluck` &
`_.where` style callbacks as well!

```javascript
// Filter object
db.filter({ foo: 'bar!' })
    .then(function(results)
    {
        // Work with `results` here.
    });
```

#### Direct Access

* `sync()` - Returns a promise resolved once the database is considered 'settled'.

You can directly access the key/value store with the `values` property on the database instance. This is exposed
explicitly to allow you as much freedom to work with your data as you might want. However, TrivialDB can't detect any
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

Whenever `store` or `merge` are called, a `sync` event is fired from the database object. You can use this should you
need to know when TrivialDB is syncing to disk.

## Status

TrivialDB is reasonably stable, and since the code base is small enough, it's relatively immune to the most common forms
of 'code rot'. I make improvements when they're needed, or if someone files an issue. That being said, I consider
TrivialDB production ready, provided you meet the intended use case.

## Contributing

While I only work on TrivialDB in my spare time (what little there is), I use it for several of my projects. I'm more than
happy to accept merge requests, and/or any issues filed. If you want to fork it and improve part of the API, I'm ok with
that too, however I ask you open an issue to discuss your proposed changes _first_. And, since it's MIT licensed, you
can, of course, take the code and use it in your own projects.