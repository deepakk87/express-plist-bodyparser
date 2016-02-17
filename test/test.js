var assert = require('assert');
var xmlparser = require('./../index.js');
var express = require('express');
var request = require('supertest');
var base64 = require('base64-arraybuffer');
var originalRegexp = xmlparser.regexp;

var plist = '<?xml version="1.0" encoding="UTF-8"?> \
           <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" \
                   "http://www.apple.com/DTDs/PropertyList-1.0.dtd"> \
           <plist version="1.0"> \
           <dict> \
               <key>Year Of Birth</key> \
               <integer>1965</integer> \
               <key>Pets Names</key> \
               <array/> \
               <key>Picture</key> \
               <data>PEKBpYGlmYFCPA==</data> \
               <key>City of Birth</key> \
               <string>Springfield</string> \
               <key>Name</key> \
               <string>John Doe</string> \
               <key>Kids Names</key> \
               <array> \
                   <string>John</string> \
                   <string>Kyra</string> \
               </array> \
           </dict> \
           </plist>';

var plistJson = {
  'Year Of Birth' : 1965,
  'Pets Names' : [],
  'City of Birth': 'Springfield',
  'Name' : 'John Doe',
  'Kids Names' : ['John','Kyra']
}
plistJson['Picture'] = [];
plistJson['Picture'] = base64.decode ('PEKBpYGlmYFCPA==');


describe('XmlParserMiddleware', function () {


  describe('#testMime', function () {

    var regexp = xmlparser.regexp;

    it('should detect common XML mime-types', function () {
      assert.equal(regexp.test('text/xml'), true);
      assert.equal(regexp.test('application/xml'), true);
      assert.equal(regexp.test('application/rss+xml'), true);
      assert.equal(regexp.test('application/atom+xml'), true);
      assert.equal(regexp.test('application/vnd.google-earth.kml+xml'), true);
      assert.equal(regexp.test('application/xhtml+xml'), true);
    });

    it('should not interfere with other body parsers', function () {
      assert.equal(regexp.test('application/json'), false);
      assert.equal(regexp.test('application/x-www-form-urlencoded'), false);
      assert.equal(regexp.test('multipart/form-data'), false);
    });

  });


  describe('#testMiddleware', function () {

    var app = express();

    app.use(xmlparser());

    app.get('/', function (req, res) {
      res.json(req.body);
    });

    app.post('/', function (req, res) {
      res.json(req.body);
    });

    it('should not run if there is no request-body', function (done) {
      request(app)
        .get('/')
        .expect(200, '{}', done);
    });

    it('should not run if there no Content-Type header', function (done) {
      request(app)
        .post('/')
        .send(plist)
        .expect(200, '{}', done);
    });

    it('should not run on empty Content-Type header', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', '')
        .set('Transfer-Encoding', '')
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(res.body, {});
          done();
        });
    });

    it('should throw 411 on fake Transfer-Encoding header', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .set('Transfer-Encoding', '')
        .expect(411, done);
    });

    it('should throw 411 on fake Content-Length header', function (done) {
      request(app).post('/')
        .set('Content-Type', 'application/xml')
        .set('Content-Length', '')
        .expect(411, done);
    });

    it('should throw 411 on empty request body', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('   ')
        .expect(411, done);
    });

    it('should throw 400 on unclosed root tag', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/vendor-spec+xml')
        .send('<xml>this is invalid')
        .expect(400, done);
    });


    it('should throw 400 on invalid char before root tag', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/vendor-spec+xml')
        .send('"<xml>ok</xml>')
        .expect(400, done);
    });


    it('should throw 400 on unexpected end', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/vendor-spec+xml')
        .send('<xml>><')
        .expect(400, done);
    });

    it('should throw 400 on non-XML', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('"johnny b. goode"')
        .expect(400, done);
    });

    it('should send 400 on empty xml root tag', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<xml></xml>')
        .expect(400, function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });
    it('should send 400 on empty plist root tag means null', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<plist></plist>')
        .expect(400, function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('should send 200 on number plist', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<plist><integer>6</integer></plist>')
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(6, res.body);
          done();
        });
    });
    it('should send 200 on real plist', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<plist><real>0.6</real></plist>')
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(0.6, res.body);
          done();
        });
    });
    it('should send 200 on array plist', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<plist><array><true/><integer>5</integer><string>deepak</string></array></plist>')
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual([true, 5, 'deepak'], res.body);
          done();
        });
    });

    it('should send 200 on plist containing whitespaces', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<plist>                                  <true/></plist>')
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(true, res.body);
          done();
        });
    });

    it('should send 200 on plist containing dict object', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send('<plist><dict><key>names</key><array><string>deepak</string></array><key>enabled</key><true/></dict></plist>')
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual({'names': ['deepak'], 'enabled':true}, res.body);
          done();
        });
    });

    it('should throw 400 on invalid xml body', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/vendor-spec+xml')
        .send('<xml>this is invalid')
        .expect(400, done);
    });

    it('should throw 400 on invalid xml body', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/vendor-spec+xml')
        .send('<xml><>')
        .expect(400, done);
    });



    it('should parse plist body', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/vendor-spec+xml')
        .send(plist)
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(plistJson, res.body);
          done();
        });
    });

  });




  describe('#testOtherBodyParser', function () {

    var app = express();
    app.use(function fakeMiddleware(req, res, next) {
      // simulate previous bodyparser by setting req._body = true
      req._body = true;
      req.body = 'fake data';
      next();
    });
    app.use(xmlparser());
    app.post('/', function (req, res) {
      res.json(req.body);
    });

    it('should not parse body if other bodyparser ran before', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send(plist)
        .expect(200, '"fake data"', done);
    });

  });

  describe('#testCustomRegExp', function () {

    var customMimeRegexp = /custom\/mime/i;

    before(function () {
      xmlparser.regexp = customMimeRegexp;
    });

    after(function () {
      xmlparser.regexp = originalRegexp;
    });

    var app = express();
    app.use(xmlparser());
    app.post('/', function (req, res) {
      res.json(req.body);
    });

    it('should permit overloading mime-type regular expression', function () {
      assert.notEqual(originalRegexp, xmlparser.regexp);
      assert.equal(xmlparser.regexp.test('custom/mime'), true);
      assert.equal(xmlparser.regexp.test('application/xml'), false);
    });

    it('should ignore non-matching content-types', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send(plist)
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.deepEqual(res.body, {});
          done();
        });
    });


  });

  describe('#testRouteMiddleware', function () {

    var app = express();
    app.post('/', function (req, res) {
      assert.equal(req.rawBody, undefined);
      res.json(req.body);
    });
    app.post('/xml', xmlparser(), function (req, res) {
      assert.equal(req.rawBody, plist);
      res.json(req.body);
    });

    it('should not act as an app middleware', function (done) {
      request(app)
        .post('/')
        .set('Content-Type', 'application/xml')
        .send(plist)
        .expect(200, function (err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.body, '');
          done();
        });
    });


  });


});
