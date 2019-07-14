# TrivialDB

[![Build Status](https://img.shields.io/travis/trivialsoftware/trivialdb/master.svg)](https://travis-ci.org/trivialsoftware/trivialdb)
[![npm Version](https://img.shields.io/npm/v/trivialdb.svg)](https://www.npmjs.com/package/trivialdb)
![npm](https://img.shields.io/npm/dm/trivialdb.svg)
[![GitHub issues](https://img.shields.io/github/issues/trivialsoftware/trivialdb.svg)](https://github.com/trivialsoftware/trivialdb/issues)
[![Donate $5](https://img.shields.io/badge/Donate-%245-yellow.svg)](https://paypal.me/morgul/5)

TrivialDB is a lightweight key/value json storage with persistence. Conceptually, it's just a thin lodash wrapper around
plain javascript objects; with the added bonus of doing versioned asynchronous writes on changes. Its on disk format is 
simply "json on disk"; basically the json version of the plain object, saved to a file on disk. This makes making hand 
edits not just possible, but simple.

## Use Case

TrivialDB is intended for simple storage needs. It's in-process, small, and very, _very_ fast. It takes almost nothing 
to get up and running with it, and it gives you an impressive amount of power, thanks to [lodash chaining][]. I've found 
its a great fit for any personal project that needs to persist data. If you find yourself wanting to work with raw json 
files, it's a rather large improvement on writing your own loading/saving/querying logic. 

The one caveat to keep in mind is this: _every database your work with is stored in memory_. Since TrivialDB is in-process, you might run into the memory limits of node; before v12, on a 64 bit machine, this is 1.76GB by default. (You can increase this via `--max_old_space_size=<size>`.) In practice, however, this isn't actually that much of a limitation. Generally, you're working with a large amount of your data in memory anyway; your data sets can get relatively large before you even need to worry about this.

In fact, the very popular nosql database [Redis][redis] is in-memory. In their FAQ, they have this to say:

> In the past the Redis developers experimented with Virtual Memory and other systems in order to allow larger than RAM 
datasets, but after all we are very happy if we can do one thing well: data served from memory, disk used for storage. 
So for now there are no plans to create an on disk backend for Redis. Most of what Redis is, after all, is a direct 
result of its current design.

In practice, I use TrivialDB to power a wiki that has thousands of printed pages worth of text, and the node process 
uses around 200mb, with the json being around 1mb on disk. For things like a blog, or user database, or session storage,
or a preference system, TrivialDB will work for a long time before you need to move to something out of process.

The one caveat to keep in mind is this: _every database you work with is stored in memory_. Since TrivialDB is 
in-process, you might run into the memory limits of node; (on versions before 0.12 there's a 1.4GB - 1.7GB limit). 
However, this isn't actually that much of a limitation. Generally, you're working with a large amount of your 
data in memory anyway; your data sets can get relatively large before you even need to worry about this.

[redis]: https://redis.io
[lodash chaining]: https://lodash.com/docs#lodash

### In-Browser Database

One of the new and exciting use cases is that TrivialDB is now usable inside a browser! By default it will read/write
JSON over REST, but you can easily change this to use IndexedDB or LocalStorage. You can even use a bundler like
Browserify or Webpack to include the JSON directly, and have zero load time.

This helps when developing static, "server-less" sites; you can have a development version that generates the JSON 
locally, commit it to git, and then have your static site generation simply include the new JSON files and push them 
out. Your client-side code can still work with TrivialDB as if it was a normal application.

(For more information, please see the ["Reading and Writing in a Browser"](#reading-and-writing-in-a-browser) section.)

## Lodash Shoutout

This entire project is made possible by the [lodash][] project. If it wasn't for their hard work and the effort they put 
into building an amazing API, TrivialDB would not exist.

[lodash]: https://lodash.com

## Installation

Simply install with npm:

```bash
$ npm install --save trivialdb
```

## TrivialDB API

There are two concepts to remember with TrivialDB: namespaces and databases. A 'namespace' is, as it implies, just an
isolated environment with a name. Inside a namespace, all _database_ names must be unique. So, if you want to have to 
independent 'foobar' databases, you will need to have them in different namespaces.

Databases, on the other hand, are the heart and soul of TrivialDB. As the name implies, they hold all your data. 
Database objects are the interesting ones, with the main API you will be working with in TrivialDB.

### Creating a namespace

* `ns(name, options)` - creates or retrieves a `TDBNamespace` object.
	* _alias: 'namespace'_
		
```javascript
const trivialdb = require('trivialdb');

// Create a namespace
const ns1 = triviadb.ns('test-ns');

// Create a namespace with some options
const ns2 = triviadb.ns('test-ns', { dbPath: 'server/db' });

// Create a database inside that namespace
const db = ns1.db('test', { writeToDisk: false });
```

Once you've created your namespace object, you can create or retrieve database instances from it, just like you can the 
main TrivialDB module.

##### Options

The options supported by the `ns` call are:

```javascript
{
    basePath: "...",	// The base path for all other paths to be relative to. (Defaults to the application's base directory.)
    dbPath: "..."	// The path, relative to `basePath` to the root database folder. (Defaults to 'db'.)
}
```

If you call `ns` passing in the name of an existing namespace, any options passed will be ignored.

### Creating a database

* `db(name, options)` - creates or retrieves a database instance.
	* _alias: 'database'_

```javascript
const trivialdb = require('trivialdb');

// Open or create a database
const db = trivialdb.db('some_db');

// Open or create a database, with options
const db2 = trivialdb.db('some_db2', { writeToDisk: false });
```

By default, when a new database is created, it will look for a file named `'some_db.json'` inside the database folder.
(By default this is `'<application>/db'`. You can control this path by setting the `basePath` or `dbPath` options of the 
namespace, or alternatively, the `dbPath` or `rootPath` options of the database.)

You can request the same database multiple times, and get back the same instance (though any options passed on 
subsequent calls will be ignored). This allows you to request the database by name in different places in your code, 
and not worry about the two database instance fighting with each other.

##### Options

The options supported by the `db` call are:

```javascript
{
    writeToDisk: true || false,  // Whether or not to persist the database to disk. (Default: `true`)
    loadFromDisk: true || false, // Whether or not to read the database in from disk on load. (Default: `true`)
    rootPath: "...",            // The path to a folder that will contain the persisted database json files. (Default: './')
    dbPath: "...",		// The path, relative to the namespace's `basePath` to the root database folder. (Defaults to 'db'.)
    writeDelay: ...,            // A number in milliseconds to wait between writes to the disk. (Default: 0)
    prettyPrint: true || false,  // Whether or not the json on disk should be pretty printed. (Default: `true`)
    pk: "...",                  // The field in the object to use as the primary key. (Default: `undefined`)
    idFunc: function(){...}     // The function to use to generate unique ids.
}
```

If you call `db` passing in the name of an existing namespace, any options passed will be ignored.

## Namespace API

Namespaces have exactly one function, `db`, which works exactly like the TrivialDB function for creating a database.
(see above.)

## Database API

TrivialDB database objects have two APIs, one synchronous, the other asynchronous (Promise based). The synchronous API
is significantly faster, but it does not trigger syncing to disk, and should be considered a 'dirty' form of reading and 
writing. In the future, TrivialDB may get the ability to support multiple processes sharing the same file, and at that 
time, the synchronous API will be a truly dirty API, with the values often being out of date. (See the more in depth
discussion in each relevant section below.)

### Properties

The database object has the following properties:

* `name` - The name given to the database. (Also the filename, minus extension.)
* `count` - The number of keys in the database.
* `path` - The full path to the backing file, assuming it writes to disk.
* `rootPath` - The full path to the folder for the database (aka `path` minus the filename).
* `loading` - A promise that is resolved once the initial data is loaded.

### Database Options

There are some options that deserve further details.

#### Custom ID Generation

If you want to generate your own ids, and not use the ids TrivialDB generates by default, you can specify your own
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
const db = trivialdb.db("articles", { writeToDisk: false, idFunc: slugify });

// Now, we save an object
db.save({ name: "TrivialDB: now with id generation functions!", body: "Read the title, dude." })
    .then(function(id)
    {
        // This prints the id: 'trivialdb-now-with-id-generation-functions'.
        console.log('id:', id);
    });
```

Be careful; it is up to you to ensure your generated ids are unique. Additionally, if your generation function blows up,
TrivialDB may return some nonsensical errors. (This may improve in the future.)

#### `readFunc` and `writeFunc`

You can override the built in underlying read and/or write functions. By default these will read/write from the disk (in node) or `GET`/`POST` to the specified path in the browser. You can, however, override them with any `Promise` returning function.

* `readFunc(path)` - This function is passed the absolute path of the file as `path`. The `rootDir` will be `/` on 
browser, or the root directory of the running node process. This function _must_ return a `Promise`. The promise's 
return value is ignored.
* `writeFunc(path, jsonStr)` - This function is passed the absolute path of the file as `path`, and the json string
representation of the database as `jsonStr`. The `rootDir` will be `/` on browser, or the root directory of the running 
node process. This function _must_ return a `Promise`. The promise's return value is ignored.

### Loading

As long as `loadFromDisk` (or `writeToDisk`) is not set to false, TrivialDB will attempt to load a database when you 
first call `.db()`. Sometimes, you need to wait for the datbase to be loaded before doing operations. This is why we 
provide a `loading` promise on the db object. Waiting for the database to be done is very simple:

```javascript
// This could declare a new DB, or it could be pulling an existing one from the cache.
const db = trivialdb.db("articles");

// This will execute once the db is loaded. If it is already loaded, we resolve instantly.
db.loading.then(() =>
    {
        console.log('loaded.');
    });
```

It's worth mentioning that the `loading` promise is always available, even if disk operations will not be performed.
This means you can always wait on the `loading` promise, without knowing details about how the database is configured.

#### `loaded` event

If you don't want to use the loading promise, there is also a `loaded` event that is always fired off once the database
has finished loading. This event does still fire if there's no disk operations to do.

```javascript
// This could declare a new DB, or it could be pulling an existing one from the cache.
const db = trivialdb.db("articles");

// This will execute once the db is loaded. If it is already loaded, **this will never fire.**
db.on('loading', () =>
    {
        console.log('loaded.');
    });
```

_Note: Due to the nature of events, if the database has already loaded, listening for the `loaded` event will never 
trigger. There is no way to know, other than to call `db.loading.isPending()`, at which point you should probably just 
use the promise directly._

#### Reading and Writing in a Browser

By default, in node, TrivialDB will attempt to read and write using the `fs` library. The path will be relative to the
project's absolute path. However, in a browser, we can't use `fs`. So, instead, we use the [fetch][] api to make REST
calls. The `path` is relative to `/`, and will look something like `/db/namespace/some_db.json`.

For loading the database, it will make a `GET` request, and for writing, it will make a `POST` request. If you need to
do something different, like using `PUT` or maybe transmitting data over websockets, simply override the `readFunc`
and/or `writeFunc` options in the configuration. 

[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

### Key/Value API

The synchronous API follows a scheme of `get`, `set`, `del`. Primarily, these functions work with the internal memory store 
directly, meaning that in the case of `set` or `del`, thier changes will not be persisted until something else triggers
a write to disk. If you have set `writeToDisk` to `false`, then you can use these APIs without any concern at all.

The asynchronous API follows a scheme of `load`, `save`, `remove`. These functions are always considered safe; they will
not resolve their promises until after the changes have been successfully saved to disk. (They will, however, modify the
data immediately, so dirty reads/writes may occur while the safe read/write is pending, and it will get the updated 
value.)

It should be noted that currently, `get` and `load` are only differentiated by the fact that `load` returns a promise. 
In the future, `load` may be modified to sync from disk, allowing for multiple processes to write to the same json file.
This is important to keep in mind, as `get` is a very popular function, if you are in a multiprocess scenario in the 
future, it may return stale values. As such, it should be considered a dirty read.

#### Retrieving Values

* Synchronous
	* `get(key, defaultVal)` - Returns the value stored under `key`or `undefined`.
* Asynchronous
	* `load(key)` - Returns a promise resolved to the value or throws `DocumentNotFoundError`.
	
```javascript
// Get an object synchronously
const val = db.get('my_key');

// Get an object synchronously, with a default value
const val2 = db.get('does_not_exist', 'default');

// Get an object asynchronously
db.load('my_key')
    .then(function(val)
    {
        // Work with `val` here
    });

// Get an object asynchronously, with a default value
db.load('does_not_exist', 'default')
    .then(function(val)
    {
    	// val is equal to 'default'
    });

// Get an object asynchronously that doesn't exist
db.load('does_not_exist')
    .then(function(val)
    {
    	// Will never get here
    })
    .catch(trivialdb.errors.DocumentNotFound, function(error)
    {
        // Handle the error.
    });
```

TrivialDB only supports direct retrieval by a single string identifier. If a value for that key is not found, `undefined`
will be returned for `get` (This mirrors the direct use of objects in JavaScript); additionally, we allow you to pass in
a default value, which will be returned if the key is not found. This is _not_ supported on `load`, however, as `load` 
is intended to return you _exactly_ what is in the database at this moment. If you attempt to use `load` to get a 
document that does not exist, it will throw a `DocumentNotFoundError` object. This allows you to do traditional promise
error handling, as opposed to using `if(result === undefiend)`.

#### Storing Values

* Synchronous
    * `set(value)` - Returns a generated key.
    * `set(key, value)` - Returns `key`.
* Asynchronous
    * `save(value)` - Returns a promise resolved with a generated key.
    * `save(key, value)` - Returns a promise resolved with `key`.

```javascript
// Store a value
const id = db.set({ name: 'foo' });

// Store a value with a specific key
db.set('foo', { name: 'foo' });

// Overwrite the previous value
db.set('foo', { name: 'bar' });

// Asynchronously store a value
db.save({ name: 'foo' })
	.then(function(id)
	{
		// Work with 'id' here.
	});
```

All values in TrivialDB are stored under a key. They _may_ be objects, or primitive types. If you do not pass in a key, 
TrivialDB will generate one for you. (The autogenerated keys are base62 encoded uuids, basically the same algorithm use 
by url shorteners.) In the event you do not pass a key, your will need to look at the return value to know how to 
retrieve your objects.

If you specify a key, it is up to you to ensure it's unique. TrivialDB will silently overwrite any previous value.

TrivialDb supports the `pk` option for setting a primary key. Keys are **always added if your value is an object**, but
 with the `pk` options, you can control what field it is stored under. (By default, it's `id`.)

#### Removing Values

* Synchronous
    * `del(predicate)` - Returns a list of removed values.
* Asynchronous
    * `remove(predicate)` - Returns a promise resolved with a list of removed values.

Removing values works off a lodash predicate, must like [filter][]. This allows for removing multiple documents at the 
same time. However, if you only wish to remove one, you will need to pass in an object that selects your primary key, 
for example:`{ id: 'my_key' }`.

[filter]: https://lodash.com/docs#filter

##### Deleting the database

* `clear()` - Returns a promise resolved once the database is considered 'settled'.

In addition to removing an individual key, you can clear the entire database. This **always** syncs to disk.

### Query API

Instead of exposing a large, complex Query API, TrivialDB exposes [lodash chain][] objects, allowing you to perform 
lodash queries to filter and manipulate your data in any way you want. As this uses lazy evaluation, it's fast and 
efficient even on large datasets.

_Note: TrivialDB currently uses **explicit** chaining, meaning that you must always use `.run()`/`.value()`. Please 
check the [docs](https://lodash.com/docs/#lodash) to understand the full implications of this._

#### Basic Filtering

* `filter(predicate)` - Returns the values that match the predicate.

```javascript
// Simple object filter
const vals = db.filter({ foo: 'bar!' });

// Function filter
const vals2 = db.filter(function(value, key)
{
    // Decide if you want this object
    return value.foo === 'bar!';
});
```

TrivialDB has a simple filter function for when you just want a lodash [filter][]. It works as you would expect, 
filtering all items in the database by the predicate you passed in.

[filter]: https://lodash.com/docs#filter

#### Advanced Queries

* `query()` - Returns a [lodash chain][] object, wrapped around all values in the database.

```javascript
// Query for all admins, sorting by created date
const items = db.query()
	.filter({ admin: true })
	.sortBy('date')
	.run();

// Find the most recently created user
const latestUser = db.query()
	.sortBy('date')
	.last()
	.run();
```

This exposes a [lodash chain][] object, which allows you to run whatever lodash queries you want. It clones the 
database's values, so feel free to make any modifications you desire; you will not affect the data in the database.

_Note:_ As you can see from our example, we execute the query with `.run()`. This alias was removed in Lodash 4. We
jump through a few hoops to extend the prototype of the individual chain object to add this back in there; this should
not leak into the global lodash module. Why did we do this? Because I like the semantics of `.run()`, dammit.

[lodash chain]: https://lodash.com/docs#chain

### Reload

* `reload()` - Returns a promise resolved once the database has been reloaded from disk.

If you need to reload your database for any reason (such as hand-edited JSON files), you can reload the database from
disk with the `reload()` function. This is the same function that is used to load from disk initially.

This function resets the `loading` promise, and emits a `loaded` event once complete.

_Note:_ This will throw an exception on any database with `loadFromDisk: false`.

_Note:_ This will completely throw away all values from in memory. If saving is not settled, changes may be lost.

### Direct Access

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

The `sync` function returns a promise that is resolved once the database has 'settled', as in, there are no more
scheduled writes. Because of this behavior, you should consider whether or not you want to wait on its promise. Under
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

With the release of v2.0.0, v1.x is no longer supported. Additionally, there were large, breaking API changes.

TrivialDB is **stable and production ready** (for the intended use case). I will provide support for v2.x for the 
foreseeable future. I will even attempt to help with v1.x if you're using it in a production product, but I can't make 
any promises.

If you are using this in a production product, please get in touch. Not only would I love to know, but if you need 
direct support, I'd be more than willing to discuss it.

### Updates

Since the code base is small enough, it's relatively immune to the most common forms of 'code rot'. I make improvements 
when they're needed, or if someone files an issue. Just because I haven't touched it in a year or two doesn't mean it's 
dead; if you're concerned, feel free to file an issue and ask if it's still being supported.

## Contributing

While I only work on TrivialDB in my spare time (what little there is), I use it for several of my projects. I'm more than
happy to accept merge requests, and/or any issues filed. If you want to fork it and improve part of the API, I'm ok with
that too, however I ask you open an issue to discuss your proposed changes _first_. And, since it's MIT licensed, you
can of course take the code and use it in your own projects.

## Donations

[![Donate $5](https://img.shields.io/badge/Donate-%245-yellow.svg)](https://paypal.me/morgul/5)

I accept donations for my work. While this is not my primary means of income, by any stretch, I would not mind a 
few bucks if you find the software useful. 

