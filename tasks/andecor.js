/*
 * grunt-andecor
 * https://github.com/kalle/andecor
 *
 * Copyright (c) 2014 Valentine Kamenek
 * Licensed under the MIT license.
 */
'use strict';

var esprima = require('esprima');
var escodegen = require('escodegen');

module.exports = function(grunt) {

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('andecor', 'Code decoration via comment annot', function() {

        // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({});

        // Iterate over all specified file groups.
        this.files.forEach(function(f) {

            // Concat specified files.
            var src = f.src.filter(function(filepath) {

                // Warn on and remove invalid source files (if nonull was set).
                if (!grunt.file.exists(filepath)) {
                    grunt.log.warn('Source file "' + filepath + '" not found.');
                    return false;
                } else {
                    return true;
                }
            });

            src.map(function(filepath) {
                var code = grunt.file.read(filepath);
                // console.log(code);
                var parsed;

                try {
                    parsed = esprima.parse(code, {
                        attachComment: true
                    });
                } catch (e) {
                    throw new Error(e + " " + filepath);
                }

                parsed.comments = undefined;

                var inlineTokenList = [];
                var blockTokenList = [];

                function parseNode(token, prevBody, index) {

                    if (!(token instanceof Object)) {
                        return;
                    }
                    var comment;
                    var label;
                    var k;

                    if ((token.type === 'ExpressionStatement' || token.type === "VariableDeclaration") &&
                        token.trailingComments &&
                        token.trailingComments.length) {
                        comment = token.trailingComments[0].value;
                        if (comment.match(/@time\s\w+/)) {
                            inlineTokenList.push({
                                token: token,
                                body: prevBody ? prevBody : [],
                                index: index,
                                label: comment.split(" ").slice(1).join(" ")
                            });
                        }
                    }

                    if (token.type === 'ExpressionStatement' &&
                        token.expression.type === 'CallExpression' &&
                        token.expression.trailingComments &&
                        token.expression.trailingComments.length) {
                        comment = token.expression.trailingComments[0].value;
                        if (comment.match(/@time\s\w+/)) {
                            inlineTokenList.push({
                                token: token,
                                body: prevBody || [],
                                index: index,
                                label: comment.split(" ").slice(1).join(" ")
                            });
                        }
                    }

                    if (token.leadingComments) {
                        for (k = 0; k < token.leadingComments.length; k++) {
                            comment = token.leadingComments[k].value;
                            label = comment.split(" ").slice(1).join(" ");
                            if ((comment.match(/@timestart\s\w+/)) &&
                                label &&
                                (inlineTokenList.filter(function(item) {
                                    return (item.label === label);
                                }).length === 0)
                            ) {

                                blockTokenList.push({
                                    token: token,
                                    body: prevBody || [],
                                    index: index,
                                    label: label,
                                    mod: 'start'
                                });
                            }
                        }
                    }

                    if (token.trailingComments) {
                        for (k = 0; k < token.trailingComments.length; k++) {
                            comment = token.trailingComments[k].value;
                            label = comment.split(" ").slice(1).join(" ");
                            if ((comment.match(/@timeend\s\w+/)) && label) {
                                blockTokenList.push({
                                    token: token,
                                    body: prevBody || [],
                                    label: label,
                                    mod: 'end'
                                });
                            }
                        }
                    }

                    for (var prop in token) {

                        if (prop === "range") {

                        } else if (token[prop] instanceof Array) {
                            (function() {
                                for (var i = 0; i < token[prop].length; i++) {
                                    parseNode(token[prop][i], token[prop], i);
                                }
                            })();
                        } else if (token[prop] instanceof Object) {
                            parseNode(token[prop], false);
                        }
                    }

                }


                function modTree() {
                    var i;
                    var tokenItem;
                    for (i = 0; i < inlineTokenList.length; i++) {
                        tokenItem = inlineTokenList[i];
                        tokenItem.body.splice(tokenItem.body.indexOf(tokenItem.token), 0, esprima.parse('console.time("' + tokenItem.label + '");').body[0]);
                        tokenItem.body.splice(tokenItem.body.indexOf(tokenItem.token) + 1, 0, esprima.parse('console.timeEnd("' + tokenItem.label + '");').body[0]);
                    }
                    for (i = 0; i < blockTokenList.length; i++) {
                        tokenItem = blockTokenList[i];
                        if (tokenItem.mod === "start") {
                            tokenItem.body.splice(tokenItem.body.indexOf(tokenItem.token), 0, esprima.parse('console.time("' + tokenItem.label + '");').body[0]);
                        }
                        if (tokenItem.mod === "end") {
                            tokenItem.body.splice(tokenItem.body.indexOf(tokenItem.token) + 1, 0, esprima.parse('console.timeEnd("' + tokenItem.label + '");').body[0]);
                        }
                    }

                }

                parseNode(parsed, parsed.body);
                modTree();

                var newCode = escodegen.generate(parsed);

                grunt.file.write(filepath, newCode);
                grunt.log.writeln('File "' + filepath + '" decorated.');

            });
        });
    });

};
