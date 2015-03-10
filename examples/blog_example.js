//----------------------------------------------------------------------------------------------------------------------
// An example of a theoretical blog model. Now, normally, you would just roll the  `Account` and `Author` models
// together, but for demonstration purposes, I have them setup as a one-to-one relationship.
//
// @module blog_example.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');
var trivialdb = require('../trivialdb');

//----------------------------------------------------------------------------------------------------------------------

function pprint(obj)
{
    return util.inspect(obj, {colors: true, depth: null});
} // end pprint

//----------------------------------------------------------------------------------------------------------------------

var Author = trivialdb.defineModel('authors', {
    name: String,
    dob: Date,
    accountName: String
}, { writeToDisk: false });

var Account = trivialdb.defineModel('accounts', {
    username: String,
    email: String,
    authorID: String,
    created: { type: Date, default: Date.now() }
}, { writeToDisk: false, pk: 'username' });

Account.hasOne(Author, 'author', 'authorID', 'id');
Author.hasOne(Account, 'account', 'accountName', 'username');

var Post = trivialdb.defineModel('posts', {
    title: String,
    content: String,
    authorID: String,
    created: { type: Date, default: Date.now() }
}, { writeToDisk: false });

Post.hasOne(Author, 'author', 'authorID', 'id');
Author.hasMany(Post, 'posts', 'id', 'authorID');

//----------------------------------------------------------------------------------------------------------------------

var initialData = [
    (new Author({ name: 'Chris Case', accountName: 'morgul' })).save()
        .then(function(author)
        {
            return trivialdb.Promise.join(
                (new Account({ username: 'morgul', email: 'nope@example.com', authorID: author.id })).save(),
                (new Post({ title: "Test Post 1", authorID: author.id })).save(),
                (new Post({ title: "Test Post 2", authorID: author.id })).save(),
                (new Post({ title: "Test Post 3", authorID: author.id })).save()
            );
        }),
    (new Author({ name: 'Foo Bar', accountName: 'foobz' })).save()
        .then(function(author)
        {
            return trivialdb.Promise.join(
                (new Account({ username: 'foobz', email: 'nadda@example.com', authorID: author.id })).save(),
                (new Post({ title: "Other Post 1", authorID: author.id })).save(),
                (new Post({ title: "Other Post 2", authorID: author.id })).save(),
                (new Post({ title: "Other Post 3", authorID: author.id })).save()
            );
        })
];

//----------------------------------------------------------------------------------------------------------------------

// Save the characters
trivialdb.Promise.all(initialData)
    .then(function()
    {
        return Account.get('morgul', { populate: true })
            .then(function(account)
            {
                console.log('Populated Account:\n%s', pprint(account.toJSON()));
                return account.author.populate()
                    .then(function(author)
                    {
                        console.log('Populated Author:\n%s', pprint(author.toJSON()));
                    });
            });
    })
    .then(function()
    {
        return Account.get('morgul', { populate: true })
            .then(function(account)
            {
                return account.depopulate()
                    .then(function(account)
                    {
                        console.log('Depopulated Account:\n%s', pprint(account.toJSON()));
                    });
            });
    })
    .then(function()
    {
        return Account.get('morgul', { populate: true })
            .then(function(account)
            {
                var post = new Post({ title: "And, another post!" });
                post.author = account.author;

                return post.save().then(function(post)
                {
                    console.log('Post:\n%s', pprint(post.toJSON()));

                    // Get the account again
                    return Account.get('morgul', { populate: true })
                        .then(function(account)
                        {
                            return account.author.populate()
                                .then(function(author)
                                {
                                    console.log('Posts:\n%s', pprint(author.toJSON().posts));
                                });
                        });
                });
            });
    });

//----------------------------------------------------------------------------------------------------------------------