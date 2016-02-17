var xml2js = require('xml2js');
var http = require('http');
var regexp = /^(text\/xml|application\/([\w!#\$%&\*`\-\.\^~]+\+)?xml)$/i;
var util = require('util');
var DOMParser = require('xmldom').DOMParser;
var base64 = require('base64-arraybuffer');
var sax = require('sax'),
  strict = true, // set to false for html-mode
  parser = sax.parser(strict);

module.exports = plistparser;
module.exports.regexp = regexp;
function parsePlistArray (docElement){
  var arr = [];
  for (var node =  docElement.firstChild; node != null;){
    if (node.nodeValue ){
        if (node.nodeValue.trim() == 0)
          node = node.nextSibling;
        else
          throw new error (400, 'Malformed xml');
    }
    if (node != null){
      arr.push(parsePlistObj(node));
      node = node.nextSibling;
    }
  }
  return arr;
}

function parsePlistDict (docElement){
  var dict = {};
  for ( var node = docElement.firstChild; node != null ;){
    if (node.nodeValue ){
        if (node.nodeValue.trim() == 0)
          node = node.nextSibling;
        else
          throw new error (400, 'Malformed xml');
    }
    if (!node)
      break;

    if (node.tagName!== 'key')
      throw new error (400, 'Malformed xml key expected');
    else{
      var objNode = null;
      if (!node.nextSibling)
        throw new error (400, 'key Value is expected');

      if (node.nextSibling.nodeValue ){
        if (node.nextSibling.nodeValue.trim() == 0)
          objNode = node.nextSibling.nextSibling;
        else
          throw new error (400, 'Malformed xml');
      } else {
        objNode = node.nextSibling;
      }
      var valueobj = parsePlistObj(objNode);
      dict [node.textContent] = valueobj;
    }
    node = objNode.nextSibling;
  }
  return dict;
}

function parsePlistObj (docElement){

  if (docElement != null ){
    if (docElement.nodeValue ){
        if (docElement.nodeValue.trim() == 0)
          docElement = docElement.nextSibling;
        else
          throw new error (400, 'Malformed xml');
    }
    if (docElement.tagName == 'dict') {
      return parsePlistDict(docElement);
    } else if (docElement.tagName == 'array'){
      return parsePlistArray (docElement);
    } else if (docElement.tagName == 'string'){
      return  docElement.textContent;
    } else if (docElement.tagName == 'real'){
      return Number (docElement.textContent);
    } else if (docElement.tagName == 'integer'){
      return Number (docElement.textContent);
    } else if (docElement.tagName == 'date'){
      return new Date (docElement.textContent);
    } else if (docElement.tagName == 'true'){
      return  true;
    } else if (docElement.tagName == 'false'){
      return  false;
    } else if (docElement.tagName == 'data'){
      return  base64.decode(docElement.textContent);
    } else {
      throw new error(400, 'Unknow tagName for plist obj type');
    }
  } else {
    throw new error(400, 'no object found');
  }
}

function parsePlist (doc, cb){
var docElement = doc.documentElement;
  if (docElement == null || docElement.tagName !== 'plist')
    cb (error(400), null);
  else{
    try{
      var obj = null;
      if (docElement.firstChild.nodeValue ){
        if (docElement.firstChild.nodeValue.trim() == 0)
          obj = parsePlistObj( docElement.firstChild.nextSibling);
        else
          cb (new error (400, 'Malformed xml'), null);
      } else {
        obj = parsePlistObj( docElement.firstChild);
      }
      cb (null, obj);
    } catch (e){
      cb (e, null);
    }
  }
}



/**
 * Expose configuration for plist-bodyparser middleware
 *
 * @api public
 * @param {Object} options Parser options
 * @return {plistbodyparser}
 */

function plistparser(options) {

  var parserOptions = util._extend({
      async: false,
      explicitArray: true,
      normalize: true,
      normalizeTags: true,
      trim: true
    }, options || {});

  /**
   * Provide connect/express-style middleware
   *
   * @param {IncomingMessage} req
   * @param {ServerResponse} res
   * @param {Function} next
   * @return {*}
   */


  function plistbodyparser(req, res, next) {

    var data = '';

    /**
     * @param {Error} err
     * @param {Object} xml
     */

    var responseHandler = function (err, xml) {
        if (err) {
          err.status = 400;
          return next(err);
        }
        req.body = xml || req.body;
        req.rawBody = data;
        next();
    };

    if (req._body) {
      return next();
    }

    req.body = req.body || {};

    if (!hasBody(req) || !module.exports.regexp.test(mime(req))) {
      return next();
    }

    req._body = true;

    // explicitly cast incoming to string
    req.setEncoding('utf-8');
    req.on('data', function (chunk) {
      data += chunk;
    });

    // in case `parseString` callback never was called, ensure response is sent

    req.on('end', function () {
      // invalid xml, length required
      if (data.trim().length === 0) {
        return next(error(411));
      }
      var xmlerror = {}
      var parser = new DOMParser({
        errorHandler:function(key,msg){xmlerror[key] = msg}
      });

      var doc = parser.parseFromString(data,'text/xml');
      if (xmlerror.error || xmlerror.fatalError || xmlerror.warning)
        next(error(400));
      else
      parsePlist(doc, responseHandler);
    });
  }

  return plistbodyparser;
}





/**
 * Test whether request has body
 *
 * @see connect.utils
 * @param {IncomingMessage} req
 * @return boolean
 */

function hasBody(req) {
  var encoding = 'transfer-encoding' in req.headers;
  var length = 'content-length' in req.headers && req.headers['content-length'] !== '0';
  return encoding || length;
}

/**
 * Get request mime-type without character encoding
 *
 * @see connect.utils
 * @param {IncomingMessage} req
 * @return string
 */

function mime(req) {
  var str = req.headers['content-type'] || '';
  return str.split(';')[0];
}

/**
 * Factory for new Error with statuscode
 *
 * @see connect.utils
 * @param {number} code
 * @param {*} msg
 * @return {Error}
 */

function error(code, msg) {
  var err = new Error(msg || http.STATUS_CODES[code]);
  err.status = code;
  return err;
}
