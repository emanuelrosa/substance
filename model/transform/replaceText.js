/* jshint latedef: false */
'use strict';

var each = require('lodash/collection/each');
var extend = require('lodash/object/extend');
var deleteSelection = require('./deleteSelection');
var updateAnnotations = require('./updateAnnotations');

/*
 * TODO: there is a use-case where this implementation does not suffice:
 * When the text of an annotation is selected fully, instead of deleting
 * the text and the annotation, the annotation should be preserved and adapted
 * to the range of the new text.
 */
function replaceText(tx, args) {
  var selection = args.selection;
  if (!selection.isPropertySelection()) {
    return _defaultReplace(tx, args);
  } else {
    return _preservativeReplace(tx, args);
  }
}

function _defaultReplace(tx, args) {
  var out = deleteSelection(tx, extend({}, args, {
    direction: 'right'
  }));
  var selection = out.selection;
  var range = selection.getRange();
  var text = args.text;
  var op = tx.update(range.start.path, { insert: { offset: range.start.offset, value: text } } );
  updateAnnotations(tx, { op: op });
  args.selection = tx.createSelection({
    type: 'property',
    path: range.start.path,
    startOffset: range.start.offset + text.length
  });
  return args;
}

function _preservativeReplace(tx, args) {
  var text = args.text;
  var range = args.selection.getRange();
  var path = range.start.path;
  var startOffset = range.start.offset;
  var endOffset = range.end.offset;
  var newEndOffset = startOffset + text.length;
  // delete the text
  var op = tx.update(path, { delete: { start: startOffset, end: endOffset } });
  // update annos but without deleting annos that cover the same range
  // as the selection
  var tmp = updateAnnotations(tx, { op: op, 'replaceTextSupport': true });
  var preservedAnnos = tmp.ignoredAnnotations;
  // insert text
  op = tx.update(range.start.path, { insert: { offset: range.start.offset, value: text } } );
  // update annos
  updateAnnotations(tx, { op: op, ignoredAnnotations: preservedAnnos });
  // update preserved annotations
  each(preservedAnnos, function(anno) {
    tx.set([anno.id, 'endOffset'], newEndOffset);
  });
  args.selection = tx.createSelection({
    type: 'property',
    path: path,
    startOffset: newEndOffset
  });
  return args;
}

module.exports = replaceText;
