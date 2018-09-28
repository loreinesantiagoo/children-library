require('dotenv').config();

var express = require("express");
var bodyParser = require("body-parser");
var mysql = require("mysql");

var sort = require('sort-by');
var paginate = require('express-paginate');

var app = express();

app.use(paginate.middleware(10, 10));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

var pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: process.env.DB_CONLIMIT
    // ,debug: true
})
// console.log(pool);


const findAllBooks = "SELECT id, author_firstname, author_lastname, title, cover_thumbnail FROM books LIMIT ? OFFSET ?";
const findOneBook = "SELECT id, author_firstname, author_lastname, title, cover_thumbnail FROM books WHERE id = ?";
const searchByAuthor = "SELECT  author_firstname, author_lastname FROM books WHERE author_firstname LIKE ? || author_lastname LIKE ?";
const searchBookByTitle = "SELECT  title, cover_thumbnail FROM books WHERE title LIKE ?";
const searchBooksByCriteria = "SELECT id, author_firstname, author_lastname, title, cover_thumbnail FROM books WHERE (title LIKE ?) || (author_firstname LIKE ?) || (author_lastname LIKE ?)";

console.log("DB USER : " + process.env.DB_USER);
console.log("DB NAME : " + process.env.DB_NAME);
// console.log(__dirname);

var makeQuery = (sql, pool)=>{
    console.log(sql);
    
    return  (args)=>{
        var queryPromise = new Promise((resolve, reject)=>{
            pool.getConnection((err, connection)=>{
                console.log("getConn");

                if(err){
                    reject(err);
                    return;
                }
                console.log(args);
                connection.query(sql, args || [], (err, results)=>{
                    connection.release();
                    if(err){
                        reject(err);
                        return;
                    }
                    console.log(">>> "+ results);
                    resolve(results); 
                })
            });
        });
        return queryPromise;
    }
}


var findAll = makeQuery(findAllBooks, pool);
var findOne = makeQuery(findOneBook, pool);
var searchByName = makeQuery(searchByAuthor, pool);
var searchByTitle = makeQuery(searchBookByTitle, pool);
var searchBooks = makeQuery(searchBooksByCriteria, pool);

app.get("/api/books", (req, res, next)=>{
    console.log("/books query !");

    var limit = parseInt(req.query.limit) || 10;
    var offset = parseInt(req.query.offset) || 0;
console.log(">>>" +offset +limit);
    findAll([limit, offset])
    .then((results) =>{console.log(">>>>2");
    let finalResult = [];

    results.forEach((element) => {
        let value = { id: 0, author_firstname: "", author_lastname: "" , title: "", cover_thumbnail:"" };
        value.id = element.id;
        value.author_firstname = element.author_firstname;
        value.author_lastname = element.author_lastname;
        value.title = element.title;
        value.cover_thumbnail = element.cover_thumbnail;
        finalResult.push(value);
    })
    res.json(finalResult);
    })
    .catch((error)=>{
        res.status(500).json(error);
    })
   console.log(">>>>3");
    try {
        const [ results, itemCount ] = await.Promise.all([
            books.find({}).limit(req.query.limit).skip(req.skip).lean().exec(),
            books.count({})
        ]);
        const pageCount = Math.ceil(itemCount / req.query.limit);

        if (req.accepts('json')) {

            res.json({
                object: 'list',
                has_more: paginate.hasNextPages(req)(pageCount),
                data: results
            });
        } else {
            res.render('books', {
                books: results,
                pageCount,
                itemCount,
                pages: paginate.getArrayPages(req)(3, pageCount, req.query.page)
            });
        }console.log("TRY");
    } catch(err) { }
})

app.get("/api/books/:bookId", function (req, res) {
     var id = req.params.bookId;
     findOne([id])
         .then(function (results) {
             res.status(200).json(results);
         })
         .catch(function (err) {
             res.status(500).end();
             console.log(error);
         });
});


app.get("/api/books/search",(req, res) => {
    console.log(req.query);
    var searchType = req.query.searchType;
    var keyword = req.query.keyword;

    if(typeof searchType === 'string') {
        if(searchType=='Title'){
            console.log('search by title');
            var title = "%" + keyword + "%";
            searchByTitle([title])
                .then(function (results) {
                    res.status(200).json(results);
                    console.log(results);
                })
                .catch(function (err) {
                    console.log(err);
                    res.status(500).end();
                });
        }
        else {
            console.log('search by author');
            var authorName = keyword.split(" ");
            if(!authorName[1]) authorName[1] = authorName[0];

            console.log("authorName" + authorName);
            var firstname = "%" + authorName[0] + "%";
            var lastname = "%" + authorName[1] + "%";
                searchByName([firstname, lastname])
                .then(function (results) {
                    res.status(200).json(results);
                    console.log(results);
                })
                .catch(function (err) {
                    console.log(err);
                    res.status(500).end();
                });
        }
    }
    else {
        console.log('search by both');
        var title = "%" + keyword + "%";
        var authorName = keyword.split(" ");
        if(!authorName[1]) authorName[1] = authorName[0];
        var firstname = "%" + authorName[0] + "%";
        var lastname = "%" + authorName[1] + "%";
        console.log(title);
        console.log(firstname);
        console.log(lastname);
        searchBooks([title, firstname, lastname])
            .then(function (results) {
                res.status(200).json(results);
                console.log(results);
            })
            .catch(function (err) {
                console.log(err);
                res.status(500).end();
            });
    }
});

app.use(express.static(__dirname + "thumbnails"));

const PORT = parseInt(process.argv[2]) ||
    parseInt(process.env.APP_PORT) || 3000

app.listen(PORT, () => {
    console.info(`app started on port ${PORT} at ${new Date()}`);
})
