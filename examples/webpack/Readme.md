# TrivialDB Webpack Example

This is a very simple example demonstrating using TrivialDB inside of a webpack project. Basically, there's no work to
actually do; simple import TrivialDB and use it. There is no special webpack configuration, or other requirements. 

It just works™.

## Reading and Writing

By default, it will attempt to load (via a `GET` request) from `/db/database_name.json`. Writes will make a `POST` to 
the same url. As an example, this project loads `/db/books.json`. Since it does not use a node server, however, it does 
not support writing.

If you want to do something different (like have your data come from inside the bundle, removing latency), you can use
the `readFunc` and `writeFunc` options. The `users` test in this project is a demonstration of that.

## Running the Demo

Just run `npm run dev`, and open [http://localhost:555](http://localhost:555).
